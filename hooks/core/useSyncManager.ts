import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { dbService } from '../../utils/db';
import {
    AppSettings,
    SavedChatSession,
    ChatGroup,
    SavedScenario,
    UploadedFile,
    SyncClientState,
    SyncConflictChoice,
    SyncConflictRequest,
    SyncMetadata,
    SyncItemMetadata,
} from '../../types';
import { logService } from '../../utils/appUtils';
import { fileToBase64, base64ToBlob } from '../../utils/fileHelpers';
import { createManagedObjectUrl, releaseSessionObjectUrls } from '../../utils/objectUrlManager';
import { mergeEntitiesThreeWay, mergeSettingsThreeWay } from '../../utils/syncMerge';
import {
    createConflictCopy,
    decideSessionSync,
    findRedundantConflictCopyIds,
    fingerprintSession,
    migrateSyncClientState,
    stableStringify,
} from '../../utils/syncSession';

const MAX_INLINE_SYNC_FILE_BYTES = 5 * 1024 * 1024;
const SYNC_BLOB_ID_PATTERN = /^[A-Fa-f0-9]{64}$/;
const SYSTEM_SCENARIO_IDS = new Set([
    'succinct-scenario-default', 'socratic-scenario-default', 'default-scenario-default',
    'Gemini3-scenario-default', 'reasoner-scenario-default', 'voxel-designer-scenario-default',
    'standard-prompt-scenario-default', 'absolute-truth-scenario-default', 'demo-scenario-showcase',
]);

type SyncItemType = 'session' | 'groups' | 'settings' | 'scenarios';
type GlobalSyncType = Exclude<SyncItemType, 'session'>;

interface SyncBlobUploadResult { blobId: string; size: number }
interface PushResult { success: true; revision: string }

interface SyncManagerProps {
    appSettings: AppSettings;
    setAppSettings: Dispatch<SetStateAction<AppSettings>>;
    savedSessions: SavedChatSession[];
    setSavedSessions: Dispatch<SetStateAction<SavedChatSession[]>>;
    savedGroups: ChatGroup[];
    setSavedGroups: Dispatch<SetStateAction<ChatGroup[]>>;
    savedScenarios: SavedScenario[];
    setSavedScenarios: Dispatch<SetStateAction<SavedScenario[]>>;
    isSettingsLoaded: boolean;
    isHistoryLoaded: boolean;
    activeSessionId: string | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const sessionUpdatedAt = (session: SavedChatSession): number => session.updatedAt || session.timestamp || 0;
const groupsUpdatedAt = (groups: ChatGroup[]): number => Math.max(...groups.map(item => item.updatedAt || item.timestamp || 0), 0);
const scenariosUpdatedAt = (scenarios: SavedScenario[]): number => Math.max(...scenarios.map(item => item.updatedAt || 0), 0);
const same = (left: unknown, right: unknown): boolean => stableStringify(left) === stableStringify(right);
const clone = <T,>(value: T): T => structuredClone(value);
const globalUpdatedAt = (type: GlobalSyncType, value: AppSettings | ChatGroup[] | SavedScenario[]): number => {
    if (type === 'settings') return (value as AppSettings).updatedAt || 0;
    if (type === 'groups') return groupsUpdatedAt(value as ChatGroup[]);
    return scenariosUpdatedAt(value as SavedScenario[]);
};
export const useSyncManager = ({
    appSettings,
    setAppSettings,
    savedSessions,
    setSavedSessions,
    savedGroups,
    setSavedGroups,
    savedScenarios,
    setSavedScenarios,
    isSettingsLoaded,
    isHistoryLoaded,
    activeSessionId,
}: SyncManagerProps) => {
    const [pullStatus, setPullStatus] = useState<SyncStatus>('idle');
    const [pushStatus, setPushStatus] = useState<SyncStatus>('idle');
    const [lastPullTime, setLastPullTime] = useState<number | null>(null);
    const [lastPushTime, setLastPushTime] = useState<number | null>(null);
    const [syncConflict, setSyncConflict] = useState<SyncConflictRequest | null>(null);
    const conflictResolverRef = useRef<((choice: SyncConflictChoice) => void) | null>(null);
    const syncInProgressRef = useRef(false);

    const isDev = import.meta.env.DEV;
    const syncPort = isDev ? '8889' : (window.location.port || '3000');
    const syncServerUrl = `${window.location.protocol}//${window.location.hostname}:${syncPort}`;
    const buildSyncHeaders = useCallback((includeJson = false): Record<string, string> => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    }), []);

    const loadClientState = useCallback(async (): Promise<SyncClientState> => {
        const state = await dbService.getSyncClientState();
        const migrated = migrateSyncClientState(state);
        if (!state || (state as { version?: number }).version !== migrated.version) {
            await dbService.setSyncClientState(migrated);
        }
        return migrated;
    }, []);

    const persistClientState = useCallback(async (state: SyncClientState) => {
        await dbService.setSyncClientState(clone(state));
    }, []);

    const requestConflictChoice = useCallback((request: Omit<SyncConflictRequest, 'id'>): Promise<SyncConflictChoice> => (
        new Promise(resolve => {
            conflictResolverRef.current = resolve;
            setSyncConflict({ ...request, id: `${request.itemType}-${Date.now()}` });
        })
    ), []);

    const resolveSyncConflict = useCallback((choice: SyncConflictChoice) => {
        const resolve = conflictResolverRef.current;
        conflictResolverRef.current = null;
        setSyncConflict(null);
        resolve?.(choice);
    }, []);

    const uploadSyncBlob = useCallback(async (rawFile: Blob): Promise<SyncBlobUploadResult> => {
        const response = await fetch(`${syncServerUrl}/api/sync/blob`, {
            method: 'POST',
            headers: { 'Content-Type': rawFile.type || 'application/octet-stream' },
            body: rawFile,
        });
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.error || `Blob upload failed (${response.status})`);
        }
        const result = await response.json() as SyncBlobUploadResult;
        if (!SYNC_BLOB_ID_PATTERN.test(result.blobId) || result.size !== rawFile.size) {
            throw new Error('Sync server returned invalid blob metadata.');
        }
        return result;
    }, [syncServerUrl]);

    const rehydrateSyncedSession = useCallback(async (session: SavedChatSession): Promise<SavedChatSession> => {
        const shouldMaterializePreview = session.id === activeSessionId;
        const messages = await Promise.all(session.messages.map(async message => {
            if (!message.files?.length) return message;
            const files = await Promise.all(message.files.map(async file => {
                if (file.syncBlobId) {
                    if (!SYNC_BLOB_ID_PATTERN.test(file.syncBlobId)) throw new Error(`Invalid synced blob id for file: ${file.name}`);
                    const response = await fetch(`${syncServerUrl}/api/sync/blob/${encodeURIComponent(file.syncBlobId)}`, { headers: buildSyncHeaders() });
                    if (!response.ok) throw new Error(`Blob download failed for ${file.name} (${response.status})`);
                    const blob = await response.blob();
                    if (file.syncBlobSize !== undefined && blob.size !== file.syncBlobSize) throw new Error(`Blob size mismatch for file: ${file.name}`);
                    const rawFile = new File([blob], file.name, { type: file.type || blob.type });
                    return { ...file, rawFile, dataUrl: shouldMaterializePreview ? createManagedObjectUrl(rawFile) : undefined } as UploadedFile;
                }
                if (file.syncData && typeof file.syncData === 'string') {
                    const blob = base64ToBlob(file.syncData, file.type);
                    const rawFile = new File([blob], file.name, { type: file.type || blob.type });
                    const { syncData: _syncData, ...rest } = file;
                    return { ...rest, rawFile, dataUrl: shouldMaterializePreview ? createManagedObjectUrl(rawFile) : undefined } as UploadedFile;
                }
                return file;
            }));
            return { ...message, files };
        }));
        return { ...session, messages };
    }, [activeSessionId, syncServerUrl, buildSyncHeaders]);

    const prepareSessionForSync = useCallback(async (session: SavedChatSession): Promise<SavedChatSession> => {
        const messages = await Promise.all(session.messages.map(async message => {
            if (!message.files?.length) return message;
            const files = await Promise.all(message.files.map(async file => {
                if (file.rawFile instanceof Blob) {
                    const { rawFile, syncData: _syncData, syncBlobId: _syncBlobId, syncBlobSize: _syncBlobSize, ...serializableFile } = file;
                    const dataUrl = file.dataUrl?.startsWith('data:') || file.dataUrl?.startsWith('blob:') ? undefined : file.dataUrl;
                    if (rawFile.size > MAX_INLINE_SYNC_FILE_BYTES) {
                        const blob = await uploadSyncBlob(rawFile);
                        return { ...serializableFile, dataUrl, syncBlobId: blob.blobId, syncBlobSize: blob.size };
                    }
                    return { ...serializableFile, dataUrl, syncData: await fileToBase64(rawFile as File) };
                }
                const dataUrl = file.dataUrl?.startsWith('data:') || file.dataUrl?.startsWith('blob:') ? undefined : file.dataUrl;
                return { ...file, dataUrl };
            }));
            return { ...message, files };
        }));
        return { ...session, messages };
    }, [uploadSyncBlob]);

    const fetchMetadata = useCallback(async (): Promise<SyncMetadata> => {
        const response = await fetch(`${syncServerUrl}/api/sync/metadata`, { headers: buildSyncHeaders() });
        if (!response.ok) throw new Error(`Sync server unavailable (${response.status})`);
        const metadata = await response.json() as SyncMetadata;
        if (metadata.version !== 2 || !metadata.globals || !metadata.tombstones) throw new Error('Sync server metadata must be upgraded to version 2.');
        return metadata;
    }, [syncServerUrl, buildSyncHeaders]);

    const pullRawItem = useCallback(async <T,>(type: SyncItemType, id?: string): Promise<T | null> => {
        const query = new URLSearchParams({ type });
        if (id) query.set('id', id);
        const response = await fetch(`${syncServerUrl}/api/sync/pull?${query.toString()}`, { headers: buildSyncHeaders() });
        if (!response.ok) throw new Error(`Pull failed for ${type} (${response.status})`);
        return await response.json() as T | null;
    }, [syncServerUrl, buildSyncHeaders]);

    const pushItem = useCallback(async (type: SyncItemType, data: unknown, baseRevision: string | null): Promise<PushResult> => {
        const syncData = type === 'session' ? await prepareSessionForSync(data as SavedChatSession) : data;
        const response = await fetch(`${syncServerUrl}/api/sync/push`, {
            method: 'POST',
            headers: buildSyncHeaders(true),
            body: JSON.stringify({ type, data: syncData, baseRevision }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const error = new Error(body?.error || `Push failed for ${type} (${response.status})`) as Error & { status?: number; currentRevision?: string | null };
            error.status = response.status;
            error.currentRevision = body?.currentRevision;
            throw error;
        }
        return body as PushResult;
    }, [syncServerUrl, buildSyncHeaders, prepareSessionForSync]);

    const deleteRemoteSession = useCallback(async (id: string, baseRevision: string | null) => {
        const query = new URLSearchParams({ type: 'session', id, baseRevision: baseRevision ?? 'null' });
        const response = await fetch(`${syncServerUrl}/api/sync/delete?${query.toString()}`, { method: 'DELETE', headers: buildSyncHeaders() });
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.error || `Delete failed for session (${response.status})`);
        }
        return response.json() as Promise<{ revision: string; deletedAt: number }>;
    }, [syncServerUrl, buildSyncHeaders]);

    const savePulledSession = useCallback(async (session: SavedChatSession) => {
        setSavedSessions(previous => {
            const existing = previous.find(item => item.id === session.id);
            if (existing) releaseSessionObjectUrls(existing.messages);
            return existing ? previous.map(item => item.id === session.id ? session : item) : [session, ...previous];
        });
        await dbService.saveSession(session);
    }, [setSavedSessions]);

    const removeLocalSession = useCallback(async (id: string) => {
        setSavedSessions(previous => {
            const existing = previous.find(item => item.id === id);
            if (existing) releaseSessionObjectUrls(existing.messages);
            return previous.filter(item => item.id !== id);
        });
        await dbService.deleteSession(id);
    }, [setSavedSessions]);

    const markSessionSynced = useCallback(async (
        state: SyncClientState,
        session: SavedChatSession,
        revision: string,
        baseFingerprint: string,
    ) => {
        state.sessions[session.id] = {
            revision,
            lastSyncedAt: Date.now(),
            localUpdatedAt: sessionUpdatedAt(session),
            baseFingerprint,
        };
        delete state.knownTombstones[session.id];
        await persistClientState(state);
    }, [persistClientState]);

    const markSessionDeleted = useCallback(async (
        state: SyncClientState,
        id: string,
        tombstone: { revision: string; deletedAt: number },
    ) => {
        delete state.sessions[id];
        state.knownTombstones[id] = tombstone;
        await persistClientState(state);
    }, [persistClientState]);

    const applyGlobalValue = useCallback(async (type: GlobalSyncType, value: AppSettings | ChatGroup[] | SavedScenario[]) => {
        if (type === 'settings') {
            const settings = value as AppSettings;
            setAppSettings(settings);
            await dbService.setAppSettings(settings);
        } else if (type === 'groups') {
            const groups = value as ChatGroup[];
            setSavedGroups(groups);
            await dbService.setAllGroups(groups);
        } else {
            const scenarios = (value as SavedScenario[]).filter(item => !SYSTEM_SCENARIO_IDS.has(item.id));
            setSavedScenarios(scenarios);
            await dbService.setAllScenarios(scenarios);
        }
    }, [setAppSettings, setSavedGroups, setSavedScenarios]);

    const getGlobalLocal = useCallback((type: GlobalSyncType): AppSettings | ChatGroup[] | SavedScenario[] => {
        if (type === 'settings') return appSettings;
        if (type === 'groups') return savedGroups;
        return savedScenarios;
    }, [appSettings, savedGroups, savedScenarios]);

    const markGlobalSynced = useCallback((state: SyncClientState, type: GlobalSyncType, metadata: SyncItemMetadata, value: AppSettings | ChatGroup[] | SavedScenario[]) => {
        state.globals[type] = {
            revision: metadata.revision,
            lastSyncedAt: Date.now(),
            localUpdatedAt: globalUpdatedAt(type, value),
            baseFingerprint: stableStringify(value),
        };
        if (type === 'settings') state.baseSnapshots.settings = clone(value as AppSettings);
        else if (type === 'groups') state.baseSnapshots.groups = clone(value as ChatGroup[]);
        else state.baseSnapshots.scenarios = clone(value as SavedScenario[]);
    }, []);

    const pullGlobal = useCallback(async (type: GlobalSyncType, metadata: SyncItemMetadata, state: SyncClientState) => {
        if (!metadata.revision) return;
        const known = state.globals[type];
        const local = getGlobalLocal(type);
        const base = state.baseSnapshots[type] as never;
        const remoteChanged = known.revision !== metadata.revision;
        const localChanged = base !== undefined && !same(local, base);
        if (!remoteChanged) return;
        const remote = await pullRawItem<AppSettings | ChatGroup[] | SavedScenario[]>(type);
        if (!remote) return;

        if (base === undefined) {
            const value = same(local, remote) ? local : remote;
            if (!same(value, local)) await applyGlobalValue(type, value);
            markGlobalSynced(state, type, metadata, value);
            await persistClientState(state);
            return;
        }

        let merged: AppSettings | ChatGroup[] | SavedScenario[] = remote;
        let conflicts: string[] = [];
        if (type === 'settings') {
            const result = mergeSettingsThreeWay(base as AppSettings | undefined, local as AppSettings, remote as AppSettings);
            merged = result.value;
            conflicts = result.conflicts;
        } else if (type === 'groups') {
            const result = mergeEntitiesThreeWay(base as ChatGroup[] | undefined, local as ChatGroup[], remote as ChatGroup[]);
            merged = result.value;
            conflicts = result.conflicts;
        } else {
            const result = mergeEntitiesThreeWay(base as SavedScenario[] | undefined, local as SavedScenario[], remote as SavedScenario[]);
            merged = result.value;
            conflicts = result.conflicts;
        }

        if (localChanged && conflicts.length) {
            const choice = await requestConflictChoice({
                itemType: type,
                title: `同步冲突：${type}`,
                detail: `${conflicts.length} 个字段或条目在本地和远端都被修改。`,
                defaultChoice: 'keep_both',
            });
            if (choice === 'use_remote') merged = remote;
            if (choice === 'overwrite_remote') merged = local;
        }

        await applyGlobalValue(type, merged);
        let revision = metadata.revision;
        if (!same(merged, remote)) revision = (await pushItem(type, merged, metadata.revision)).revision;
        markGlobalSynced(state, type, { ...metadata, revision }, merged);
        await persistClientState(state);
    }, [applyGlobalValue, getGlobalLocal, markGlobalSynced, persistClientState, pullRawItem, pushItem, requestConflictChoice]);

    const pullFromServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded || syncInProgressRef.current) return;
        syncInProgressRef.current = true;
        setPullStatus('syncing');
        try {
            const [metadata, state] = await Promise.all([fetchMetadata(), loadClientState()]);

            for (const [id, tombstone] of Object.entries(metadata.tombstones.sessions)) {
                if (savedSessions.some(session => session.id === id)) await removeLocalSession(id);
                await markSessionDeleted(state, id, tombstone);
            }

            for (const [id, remoteMetadata] of Object.entries(metadata.sessions)) {
                const local = savedSessions.find(session => session.id === id);
                const known = state.sessions[id];
                if (!remoteMetadata.revision) continue;
                if (!local) {
                    const remote = await pullRawItem<SavedChatSession>('session', id);
                    if (!remote) continue;
                    const remoteFingerprint = await fingerprintSession(remote);
                    const hydrated = await rehydrateSyncedSession(remote);
                    await savePulledSession(hydrated);
                    await markSessionSynced(state, hydrated, remoteMetadata.revision, remoteFingerprint);
                    continue;
                }

                if (known?.revision === remoteMetadata.revision && known.baseFingerprint) continue;

                const [localFingerprint, remote] = await Promise.all([
                    fingerprintSession(local),
                    pullRawItem<SavedChatSession>('session', id),
                ]);
                if (!remote) continue;
                const remoteFingerprint = await fingerprintSession(remote);
                const legacyLocalChanged = Boolean(
                    known && !known.baseFingerprint && (
                        known.revision === remoteMetadata.revision || sessionUpdatedAt(local) > known.localUpdatedAt
                    ),
                );
                const decision = decideSessionSync({
                    direction: 'pull',
                    known,
                    localFingerprint,
                    remoteFingerprint,
                    remoteRevision: remoteMetadata.revision,
                    legacyLocalChanged,
                });

                if (decision === 'same') {
                    await markSessionSynced(state, local, remoteMetadata.revision, remoteFingerprint);
                    continue;
                }

                if (decision === 'bootstrap_remote' || decision === 'remote_only') {
                    const hydrated = await rehydrateSyncedSession(remote);
                    await savePulledSession(hydrated);
                    await markSessionSynced(state, hydrated, remoteMetadata.revision, remoteFingerprint);
                    continue;
                }

                if (decision === 'local_only' || decision === 'unchanged') {
                    if (known && !known.baseFingerprint) {
                        known.baseFingerprint = remoteFingerprint;
                        await persistClientState(state);
                    }
                    continue;
                }

                const choice = await requestConflictChoice({
                    itemType: 'session',
                    title: `会话冲突：${local.title}`,
                    detail: '此会话在上次成功同步后，本地和远端都发生了不同修改。',
                    defaultChoice: 'keep_both',
                });
                if (choice === 'overwrite_remote') {
                    const result = await pushItem('session', local, remoteMetadata.revision);
                    await markSessionSynced(state, local, result.revision, localFingerprint);
                    continue;
                }
                if (choice === 'keep_both') {
                    const duplicate = createConflictCopy(local, 'local');
                    const duplicateFingerprint = await fingerprintSession(duplicate);
                    await dbService.saveSession(duplicate);
                    setSavedSessions(previous => [duplicate, ...previous]);
                    const result = await pushItem('session', duplicate, null);
                    await markSessionSynced(state, duplicate, result.revision, duplicateFingerprint);
                }
                const hydrated = await rehydrateSyncedSession(remote);
                await savePulledSession(hydrated);
                await markSessionSynced(state, hydrated, remoteMetadata.revision, remoteFingerprint);
            }

            await pullGlobal('groups', metadata.globals.groups, state);
            await pullGlobal('settings', metadata.globals.settings, state);
            await pullGlobal('scenarios', metadata.globals.scenarios, state);
            await persistClientState(state);
            setPullStatus('success');
            setLastPullTime(Date.now());
            window.setTimeout(() => setPullStatus('idle'), 3000);
        } catch (error) {
            logService.error('Pull from server failed', { error });
            setPullStatus('error');
            window.setTimeout(() => setPullStatus('idle'), 5000);
        } finally {
            syncInProgressRef.current = false;
        }
    }, [fetchMetadata, isHistoryLoaded, isSettingsLoaded, loadClientState, markSessionDeleted, markSessionSynced, persistClientState, pullGlobal, pullRawItem, pushItem, rehydrateSyncedSession, removeLocalSession, requestConflictChoice, savePulledSession, savedSessions, setSavedSessions]);

    const pushGlobal = useCallback(async (type: GlobalSyncType, remoteMetadata: SyncItemMetadata, state: SyncClientState) => {
        const local = getGlobalLocal(type);
        const base = state.baseSnapshots[type];
        const known = state.globals[type];
        const localChanged = base === undefined || !same(local, base);
        if (!localChanged) return;

        if (base === undefined) {
            if (remoteMetadata.revision) {
                const remote = await pullRawItem<AppSettings | ChatGroup[] | SavedScenario[]>(type);
                if (remote && same(local, remote)) {
                    markGlobalSynced(state, type, remoteMetadata, local);
                    await persistClientState(state);
                    return;
                }
            }
            const result = await pushItem(type, local, remoteMetadata.revision);
            markGlobalSynced(state, type, { ...remoteMetadata, revision: result.revision }, local);
            await persistClientState(state);
            return;
        }
        if (known.revision !== remoteMetadata.revision && remoteMetadata.revision) {
            await pullGlobal(type, remoteMetadata, state);
            return;
        }
        const result = await pushItem(type, local, known.revision);
        markGlobalSynced(state, type, { ...remoteMetadata, revision: result.revision }, local);
        await persistClientState(state);
    }, [getGlobalLocal, markGlobalSynced, persistClientState, pullGlobal, pullRawItem, pushItem]);

    const pushToServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded || syncInProgressRef.current) return;
        syncInProgressRef.current = true;
        setPushStatus('syncing');
        try {
            const [metadata, state] = await Promise.all([fetchMetadata(), loadClientState()]);
            const redundantCopyIds = new Set(await findRedundantConflictCopyIds(savedSessions));
            for (const id of redundantCopyIds) {
                await removeLocalSession(id);
                const known = state.sessions[id];
                const existingTombstone = metadata.tombstones.sessions[id];
                if (existingTombstone) {
                    await markSessionDeleted(state, id, existingTombstone);
                    continue;
                }
                const currentRevision = metadata.sessions[id]?.revision ?? known?.revision ?? null;
                const deletion = await deleteRemoteSession(id, currentRevision);
                await markSessionDeleted(state, id, deletion);
            }
            if (redundantCopyIds.size) {
                logService.info(`Removed ${redundantCopyIds.size} identical generated sync conflict copies.`);
            }

            const sessionsForPush = savedSessions.filter(session => !redundantCopyIds.has(session.id));
            const localById = new Map(sessionsForPush.map(session => [session.id, session]));

            for (const [id, known] of Object.entries(state.sessions)) {
                if (localById.has(id)) continue;
                if (metadata.tombstones.sessions[id]) {
                    await markSessionDeleted(state, id, metadata.tombstones.sessions[id]);
                    continue;
                }
                const currentRemoteRevision = metadata.sessions[id]?.revision ?? known.revision;
                const result = await deleteRemoteSession(id, currentRemoteRevision);
                await markSessionDeleted(state, id, result);
            }

            for (const session of sessionsForPush) {
                const id = session.id;
                if (metadata.tombstones.sessions[id]) {
                    await removeLocalSession(id);
                    await markSessionDeleted(state, id, metadata.tombstones.sessions[id]);
                    continue;
                }
                const known = state.sessions[id];
                const remoteMetadata = metadata.sessions[id];
                const localFingerprint = await fingerprintSession(session);

                if (!remoteMetadata?.revision) {
                    const result = await pushItem('session', session, null);
                    await markSessionSynced(state, session, result.revision, localFingerprint);
                    continue;
                }

                if (known?.baseFingerprint && known.revision === remoteMetadata.revision) {
                    if (known.baseFingerprint === localFingerprint) continue;
                    const result = await pushItem('session', session, remoteMetadata.revision);
                    await markSessionSynced(state, session, result.revision, localFingerprint);
                    continue;
                }

                const remote = await pullRawItem<SavedChatSession>('session', id);
                if (!remote) continue;
                const remoteFingerprint = await fingerprintSession(remote);
                const legacyLocalChanged = Boolean(
                    known && !known.baseFingerprint && (
                        known.revision === remoteMetadata.revision || sessionUpdatedAt(session) > known.localUpdatedAt
                    ),
                );
                const decision = decideSessionSync({
                    direction: 'push',
                    known,
                    localFingerprint,
                    remoteFingerprint,
                    remoteRevision: remoteMetadata.revision,
                    legacyLocalChanged,
                });

                if (decision === 'same') {
                    await markSessionSynced(state, session, remoteMetadata.revision, remoteFingerprint);
                    continue;
                }

                if (decision === 'bootstrap_local' || decision === 'local_only') {
                    const result = await pushItem('session', session, remoteMetadata.revision);
                    await markSessionSynced(state, session, result.revision, localFingerprint);
                    continue;
                }

                if (decision === 'remote_only') {
                    logService.info(`Push skipped for ${session.title}: the server has a newer version. Pull to download it.`);
                    continue;
                }

                if (decision === 'unchanged') {
                    if (known && !known.baseFingerprint) {
                        known.baseFingerprint = remoteFingerprint;
                        await persistClientState(state);
                    }
                    continue;
                }

                const choice = await requestConflictChoice({
                    itemType: 'session',
                    title: `会话冲突：${session.title}`,
                    detail: '此会话在上次成功同步后，本地和远端都发生了不同修改。',
                    defaultChoice: 'keep_both',
                });
                if (choice === 'use_remote') {
                    const hydrated = await rehydrateSyncedSession(remote);
                    await savePulledSession(hydrated);
                    await markSessionSynced(state, hydrated, remoteMetadata.revision, remoteFingerprint);
                    continue;
                }
                if (choice === 'keep_both') {
                    const remoteCopyRaw = createConflictCopy(remote, 'remote');
                    const remoteCopyFingerprint = await fingerprintSession(remoteCopyRaw);
                    const remoteCopy = await rehydrateSyncedSession(remoteCopyRaw);
                    await dbService.saveSession(remoteCopy);
                    setSavedSessions(previous => [remoteCopy, ...previous]);

                    const originalResult = await pushItem('session', session, remoteMetadata.revision);
                    await markSessionSynced(state, session, originalResult.revision, localFingerprint);
                    const copyResult = await pushItem('session', remoteCopy, null);
                    await markSessionSynced(state, remoteCopy, copyResult.revision, remoteCopyFingerprint);
                    continue;
                }
                const result = await pushItem('session', session, remoteMetadata.revision);
                await markSessionSynced(state, session, result.revision, localFingerprint);
            }

            await pushGlobal('groups', metadata.globals.groups, state);
            await pushGlobal('settings', metadata.globals.settings, state);
            await pushGlobal('scenarios', metadata.globals.scenarios, state);
            await persistClientState(state);
            setPushStatus('success');
            setLastPushTime(Date.now());
            window.setTimeout(() => setPushStatus('idle'), 3000);
        } catch (error) {
            logService.error('Push to server failed', { error });
            setPushStatus('error');
            window.setTimeout(() => setPushStatus('idle'), 5000);
        } finally {
            syncInProgressRef.current = false;
        }
    }, [deleteRemoteSession, fetchMetadata, isHistoryLoaded, isSettingsLoaded, loadClientState, markSessionDeleted, markSessionSynced, persistClientState, pullRawItem, pushGlobal, pushItem, rehydrateSyncedSession, removeLocalSession, requestConflictChoice, savePulledSession, savedSessions, setSavedSessions]);

    return {
        pullStatus,
        pushStatus,
        lastPullTime,
        lastPushTime,
        pullFromServer,
        pushToServer,
        syncConflict,
        resolveSyncConflict,
    };
};
