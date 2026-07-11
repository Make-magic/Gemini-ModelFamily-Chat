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

const emptyItemState = () => ({ revision: null, lastSyncedAt: 0, localUpdatedAt: 0 });
const createEmptyClientState = (): SyncClientState => ({
    version: 1,
    sessions: {},
    globals: { groups: emptyItemState(), settings: emptyItemState(), scenarios: emptyItemState() },
    baseSnapshots: {},
    knownTombstones: {},
});

const sessionUpdatedAt = (session: SavedChatSession): number => session.updatedAt || session.timestamp || 0;
const groupsUpdatedAt = (groups: ChatGroup[]): number => Math.max(...groups.map(item => item.updatedAt || item.timestamp || 0), 0);
const scenariosUpdatedAt = (scenarios: SavedScenario[]): number => Math.max(...scenarios.map(item => item.updatedAt || 0), 0);
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const clone = <T,>(value: T): T => structuredClone(value);
const combineWithoutBase = (
    type: GlobalSyncType,
    local: AppSettings | ChatGroup[] | SavedScenario[],
    remote: AppSettings | ChatGroup[] | SavedScenario[],
): AppSettings | ChatGroup[] | SavedScenario[] => {
    if (type === 'settings') return { ...(remote as AppSettings), ...(local as AppSettings) };
    const remoteItems = remote as Array<ChatGroup | SavedScenario>;
    const localItems = local as Array<ChatGroup | SavedScenario>;
    const combined = [...remoteItems];
    const remoteById = new Map(remoteItems.map(item => [item.id, item]));
    localItems.forEach((item, index) => {
        const remoteItem = remoteById.get(item.id);
        if (!remoteItem) combined.push(item);
        else if (!same(remoteItem, item)) combined.push({ ...item, id: `${item.id}-local-${Date.now()}-${index}` });
    });
    return combined as ChatGroup[] | SavedScenario[];
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

    const isDev = import.meta.env.DEV;
    const syncPort = isDev ? '8889' : (window.location.port || '3000');
    const syncServerUrl = `${window.location.protocol}//${window.location.hostname}:${syncPort}`;
    const buildSyncHeaders = useCallback((includeJson = false): Record<string, string> => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    }), []);

    const loadClientState = useCallback(async (): Promise<SyncClientState> => {
        const state = await dbService.getSyncClientState();
        return state?.version === 1 ? state : createEmptyClientState();
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

    const getGlobalUpdatedAt = useCallback((type: GlobalSyncType): number => {
        if (type === 'settings') return appSettings.updatedAt || 0;
        if (type === 'groups') return groupsUpdatedAt(savedGroups);
        return scenariosUpdatedAt(savedScenarios);
    }, [appSettings, savedGroups, savedScenarios]);

    const markGlobalSynced = useCallback((state: SyncClientState, type: GlobalSyncType, metadata: SyncItemMetadata, value: AppSettings | ChatGroup[] | SavedScenario[]) => {
        state.globals[type] = { revision: metadata.revision, lastSyncedAt: Date.now(), localUpdatedAt: getGlobalUpdatedAt(type) };
        if (type === 'settings') state.baseSnapshots.settings = clone(value as AppSettings);
        else if (type === 'groups') state.baseSnapshots.groups = clone(value as ChatGroup[]);
        else state.baseSnapshots.scenarios = clone(value as SavedScenario[]);
    }, [getGlobalUpdatedAt]);

    const pullGlobal = useCallback(async (type: GlobalSyncType, metadata: SyncItemMetadata, state: SyncClientState) => {
        if (!metadata.revision) return;
        const known = state.globals[type];
        const local = getGlobalLocal(type);
        const base = state.baseSnapshots[type] as never;
        const remoteChanged = known.revision !== metadata.revision;
        const localChanged = base === undefined || !same(local, base);
        if (!remoteChanged) return;
        const remote = await pullRawItem<AppSettings | ChatGroup[] | SavedScenario[]>(type);
        if (!remote) return;

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

        if (localChanged && (conflicts.length || base === undefined)) {
            const choice = await requestConflictChoice({
                itemType: type,
                title: `同步冲突：${type}`,
                detail: `${conflicts.length} 个字段或条目在本地和远端都被修改。`,
                defaultChoice: 'keep_both',
            });
            if (choice === 'use_remote') merged = remote;
            if (choice === 'overwrite_remote') merged = local;
            if (choice === 'keep_both' && base === undefined) merged = combineWithoutBase(type, local, remote);
        }

        await applyGlobalValue(type, merged);
        let revision = metadata.revision;
        if (!same(merged, remote)) revision = (await pushItem(type, merged, metadata.revision)).revision;
        markGlobalSynced(state, type, { ...metadata, revision }, merged);
    }, [applyGlobalValue, getGlobalLocal, markGlobalSynced, pullRawItem, pushItem, requestConflictChoice]);

    const pullFromServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded) return;
        setPullStatus('syncing');
        try {
            const [metadata, state] = await Promise.all([fetchMetadata(), loadClientState()]);

            for (const [id, tombstone] of Object.entries(metadata.tombstones.sessions)) {
                state.knownTombstones[id] = tombstone;
                delete state.sessions[id];
                if (savedSessions.some(session => session.id === id)) await removeLocalSession(id);
            }

            for (const [id, remoteMetadata] of Object.entries(metadata.sessions)) {
                const local = savedSessions.find(session => session.id === id);
                const known = state.sessions[id];
                const remoteChanged = known?.revision !== remoteMetadata.revision;
                const localChanged = local ? (!known || sessionUpdatedAt(local) > known.localUpdatedAt) : false;
                if (!local) {
                    const remote = await pullRawItem<SavedChatSession>('session', id);
                    if (!remote) continue;
                    const hydrated = await rehydrateSyncedSession(remote);
                    await savePulledSession(hydrated);
                    state.sessions[id] = { revision: remoteMetadata.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(hydrated) };
                    continue;
                }
                if (!remoteChanged) continue;

                if (localChanged) {
                    const choice = await requestConflictChoice({
                        itemType: 'session',
                        title: `会话冲突：${local.title}`,
                        detail: '本地和远端都修改了此会话。默认保留两份，避免任何一侧内容丢失。',
                        defaultChoice: 'keep_both',
                    });
                    if (choice === 'overwrite_remote') {
                        const result = await pushItem('session', local, remoteMetadata.revision);
                        state.sessions[id] = { revision: result.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(local) };
                        continue;
                    }
                    const remote = await pullRawItem<SavedChatSession>('session', id);
                    if (!remote) continue;
                    const hydrated = await rehydrateSyncedSession(remote);
                    if (choice === 'keep_both') {
                        const duplicate = { ...local, id: `${local.id}-local-${Date.now()}`, title: `${local.title}（本地冲突副本）`, updatedAt: Date.now() };
                        await dbService.saveSession(duplicate);
                        setSavedSessions(previous => [duplicate, ...previous.filter(item => item.id !== id)]);
                        const result = await pushItem('session', duplicate, null);
                        state.sessions[duplicate.id] = { revision: result.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(duplicate) };
                    }
                    await savePulledSession(hydrated);
                    state.sessions[id] = { revision: remoteMetadata.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(hydrated) };
                } else {
                    const remote = await pullRawItem<SavedChatSession>('session', id);
                    if (!remote) continue;
                    const hydrated = await rehydrateSyncedSession(remote);
                    await savePulledSession(hydrated);
                    state.sessions[id] = { revision: remoteMetadata.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(hydrated) };
                }
            }

            await pullGlobal('groups', metadata.globals.groups, state);
            await pullGlobal('settings', metadata.globals.settings, state);
            await pullGlobal('scenarios', metadata.globals.scenarios, state);
            await dbService.setSyncClientState(state);
            setPullStatus('success');
            setLastPullTime(Date.now());
            window.setTimeout(() => setPullStatus('idle'), 3000);
        } catch (error) {
            logService.error('Pull from server failed', { error });
            setPullStatus('error');
            window.setTimeout(() => setPullStatus('idle'), 5000);
        }
    }, [fetchMetadata, isHistoryLoaded, isSettingsLoaded, loadClientState, pullGlobal, pullRawItem, rehydrateSyncedSession, removeLocalSession, requestConflictChoice, savePulledSession, savedSessions, setSavedSessions, pushItem]);

    const pushGlobal = useCallback(async (type: GlobalSyncType, remoteMetadata: SyncItemMetadata, state: SyncClientState) => {
        const local = getGlobalLocal(type);
        const base = state.baseSnapshots[type];
        const known = state.globals[type];
        const localChanged = base === undefined || !same(local, base);
        if (!localChanged) return;

        if (base === undefined && remoteMetadata.revision) {
            const choice = await requestConflictChoice({
                itemType: type,
                title: `同步冲突：${type}`,
                detail: '本地和远端都存在尚未建立共同基础的数据。',
                defaultChoice: 'keep_both',
            });
            if (choice === 'use_remote') {
                await pullGlobal(type, remoteMetadata, state);
                return;
            }
            let value = local;
            if (choice === 'keep_both') {
                const remote = await pullRawItem<AppSettings | ChatGroup[] | SavedScenario[]>(type);
                if (remote) value = combineWithoutBase(type, local, remote);
                await applyGlobalValue(type, value);
            }
            const result = await pushItem(type, value, remoteMetadata.revision);
            markGlobalSynced(state, type, { ...remoteMetadata, revision: result.revision }, value);
            return;
        }
        if (known.revision !== remoteMetadata.revision && remoteMetadata.revision) {
            await pullGlobal(type, remoteMetadata, state);
            return;
        }
        const result = await pushItem(type, local, known.revision);
        markGlobalSynced(state, type, { ...remoteMetadata, revision: result.revision }, local);
    }, [applyGlobalValue, getGlobalLocal, markGlobalSynced, pullGlobal, pullRawItem, pushItem, requestConflictChoice]);

    const pushToServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded) return;
        setPushStatus('syncing');
        try {
            const [metadata, state] = await Promise.all([fetchMetadata(), loadClientState()]);
            const localById = new Map(savedSessions.map(session => [session.id, session]));

            for (const [id, known] of Object.entries(state.sessions)) {
                if (localById.has(id)) continue;
                if (metadata.tombstones.sessions[id]) {
                    delete state.sessions[id];
                    state.knownTombstones[id] = metadata.tombstones.sessions[id];
                    continue;
                }
                const result = await deleteRemoteSession(id, known.revision);
                state.knownTombstones[id] = { deletedAt: result.deletedAt, revision: result.revision };
                delete state.sessions[id];
            }

            for (const session of savedSessions) {
                const id = session.id;
                if (metadata.tombstones.sessions[id]) {
                    await removeLocalSession(id);
                    state.knownTombstones[id] = metadata.tombstones.sessions[id];
                    delete state.sessions[id];
                    continue;
                }
                const known = state.sessions[id];
                const remote = metadata.sessions[id];
                const localChanged = !known || sessionUpdatedAt(session) > known.localUpdatedAt;
                if (!localChanged) continue;
                if (remote && (!known || remote.revision !== known.revision)) {
                    const choice = await requestConflictChoice({
                        itemType: 'session',
                        title: `会话冲突：${session.title}`,
                        detail: '远端自上次同步后已变化。默认保留两份。',
                        defaultChoice: 'keep_both',
                    });
                    if (choice === 'use_remote') {
                        const remoteSession = await pullRawItem<SavedChatSession>('session', id);
                        if (remoteSession) {
                            const hydrated = await rehydrateSyncedSession(remoteSession);
                            await savePulledSession(hydrated);
                            state.sessions[id] = { revision: remote.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(hydrated) };
                        }
                        continue;
                    }
                    if (choice === 'keep_both') {
                        const duplicate = { ...session, id: `${session.id}-local-${Date.now()}`, title: `${session.title}（本地冲突副本）`, updatedAt: Date.now() };
                        await dbService.saveSession(duplicate);
                        setSavedSessions(previous => [duplicate, ...previous]);
                        const result = await pushItem('session', duplicate, null);
                        state.sessions[duplicate.id] = { revision: result.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(duplicate) };
                        continue;
                    }
                }
                const result = await pushItem('session', session, known?.revision ?? null);
                state.sessions[id] = { revision: result.revision, lastSyncedAt: Date.now(), localUpdatedAt: sessionUpdatedAt(session) };
            }

            await pushGlobal('groups', metadata.globals.groups, state);
            await pushGlobal('settings', metadata.globals.settings, state);
            await pushGlobal('scenarios', metadata.globals.scenarios, state);
            await dbService.setSyncClientState(state);
            setPushStatus('success');
            setLastPushTime(Date.now());
            window.setTimeout(() => setPushStatus('idle'), 3000);
        } catch (error) {
            logService.error('Push to server failed', { error });
            setPushStatus('error');
            window.setTimeout(() => setPushStatus('idle'), 5000);
        }
    }, [deleteRemoteSession, fetchMetadata, isHistoryLoaded, isSettingsLoaded, loadClientState, pullRawItem, pushGlobal, pushItem, rehydrateSyncedSession, removeLocalSession, requestConflictChoice, savePulledSession, savedSessions, setSavedSessions]);

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
