import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { dbService } from '../../utils/db';
import { AppSettings, SavedChatSession, ChatGroup, SavedScenario, UploadedFile } from '../../types';
import { logService } from '../../utils/appUtils';
import { fileToBase64, base64ToBlob } from '../../utils/fileHelpers';

const MAX_INLINE_SYNC_FILE_BYTES = 5 * 1024 * 1024;
const SYNC_BLOB_ID_PATTERN = /^[A-Fa-f0-9]{64}$/;

type SyncItemType = 'session' | 'groups' | 'settings' | 'scenarios';

interface SyncMetadata {
    sessions: Record<string, number>;
    groups: { updatedAt: number };
    settings: { updatedAt: number };
    scenarios: { updatedAt: number };
    revisions?: {
        sessions?: Record<string, string>;
        groups?: string | null;
        settings?: string | null;
        scenarios?: string | null;
    };
}

interface SyncBlobUploadResult {
    blobId: string;
    size: number;
}

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
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

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
    isHistoryLoaded
}: SyncManagerProps) => {
    const [pullStatus, setPullStatus] = useState<SyncStatus>('idle');
    const [pushStatus, setPushStatus] = useState<SyncStatus>('idle');
    const [lastPullTime, setLastPullTime] = useState<number | null>(null);
    const [lastPushTime, setLastPushTime] = useState<number | null>(null);
    
    // Strict environment detection using Vite's built-in env vars
    // In DEV mode (npm run dev), we ALWAYS use port 8889 for the backend sync server.
    // In PROD mode (packaged EXE), we use the same port as the UI (window.location.port).
    const isDev = import.meta.env.DEV;
    const syncPort = isDev ? '8889' : (window.location.port || '3000');
    const syncServerUrl = `${window.location.protocol}//${window.location.hostname}:${syncPort}`;
    const buildSyncHeaders = useCallback((includeJson = false): Record<string, string> => ({
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    }), []);

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

    // Helper to process session data after pull (restore Base64 or independent Blob files).
    const rehydrateSyncedSession = useCallback(async (session: SavedChatSession): Promise<SavedChatSession> => {
        const newMessages = await Promise.all(session.messages.map(async msg => {
            if (!msg.files?.length) return msg;
            const newFiles = await Promise.all(msg.files.map(async file => {
                if (file.syncBlobId) {
                    if (!SYNC_BLOB_ID_PATTERN.test(file.syncBlobId)) {
                        throw new Error(`Invalid synced blob id for file: ${file.name}`);
                    }
                    const response = await fetch(`${syncServerUrl}/api/sync/blob/${encodeURIComponent(file.syncBlobId)}`, {
                        headers: buildSyncHeaders(),
                    });
                    if (!response.ok) {
                        throw new Error(`Blob download failed for ${file.name} (${response.status})`);
                    }
                    const blob = await response.blob();
                    if (file.syncBlobSize !== undefined && blob.size !== file.syncBlobSize) {
                        throw new Error(`Blob size mismatch for file: ${file.name}`);
                    }
                    const rawFile = new File([blob], file.name, { type: file.type || blob.type });
                    return { ...file, rawFile, dataUrl: URL.createObjectURL(rawFile) } as UploadedFile;
                }

                // If file has syncData (Base64), convert it back to a File for local IndexedDB.
                if (file.syncData && typeof file.syncData === 'string') {
                    const blob = base64ToBlob(file.syncData, file.type);
                    const rawFile = new File([blob], file.name, { type: file.type || blob.type });
                    const { syncData, ...rest } = file;
                    return { ...rest, rawFile, dataUrl: URL.createObjectURL(rawFile) } as UploadedFile;
                }
                return file;
            }));
            return { ...msg, files: newFiles };
        }));
        return { ...session, messages: newMessages };
    }, [syncServerUrl, buildSyncHeaders]);

    // Helper to process session data before push (small files use Base64; large files use Blob storage).
    const prepareSessionForSync = useCallback(async (session: SavedChatSession): Promise<SavedChatSession> => {
        const newMessages = await Promise.all(session.messages.map(async (msg) => {
            if (!msg.files?.length) return msg;
            const newFiles = await Promise.all(msg.files.map(async (file) => {
                if (file.rawFile instanceof Blob) {
                    const {
                        rawFile,
                        syncData: _syncData,
                        syncBlobId: _syncBlobId,
                        syncBlobSize: _syncBlobSize,
                        syncSkipped: _legacySyncSkipped,
                        ...serializableFile
                    } = file as UploadedFile & { syncSkipped?: boolean };
                    const safeDataUrl = file.dataUrl?.startsWith('data:') || file.dataUrl?.startsWith('blob:')
                        ? undefined
                        : file.dataUrl;

                    if (rawFile.size > MAX_INLINE_SYNC_FILE_BYTES) {
                        try {
                            const blob = await uploadSyncBlob(rawFile);
                            return {
                                ...serializableFile,
                                dataUrl: safeDataUrl,
                                syncBlobId: blob.blobId,
                                syncBlobSize: blob.size,
                            };
                        } catch (error) {
                            logService.error(`Failed to upload sync blob for ${file.name}`, error);
                            throw error;
                        }
                    }

                    try {
                        const base64 = await fileToBase64(rawFile as File);
                        return { ...serializableFile, dataUrl: safeDataUrl, syncData: base64 };
                    } catch (error) {
                        logService.error(`Failed to serialize file ${file.name} for sync`, error);
                        throw error;
                    }
                }

                const { syncSkipped: _legacySyncSkipped, ...serializableFile } = file as UploadedFile & { syncSkipped?: boolean };
                const safeDataUrl = file.dataUrl?.startsWith('data:') || file.dataUrl?.startsWith('blob:')
                    ? undefined
                    : file.dataUrl;
                return { ...serializableFile, dataUrl: safeDataUrl };
            }));
            return { ...msg, files: newFiles };
        }));
        return { ...session, messages: newMessages };
    }, [uploadSyncBlob]);

    const pullItem = useCallback(async (type: SyncItemType, id?: string, remoteTimestamp?: number) => {
        const query = new URLSearchParams({ type });
        if (id) query.set('id', id);
        const response = await fetch(`${syncServerUrl}/api/sync/pull?${query.toString()}`, {
            headers: buildSyncHeaders(),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!data) return;

        if (type === 'session') {
            let session = data as SavedChatSession;
            session = await rehydrateSyncedSession(session);

            if (typeof setSavedSessions !== 'function') {
                logService.error("setSavedSessions is not a function in pullItem");
                return;
            }
            setSavedSessions(prev => {
                const existing = prev.find(s => s.id === session.id);
                const remoteUpdate = remoteTimestamp || session.updatedAt || session.timestamp || 0;
                const localUpdate = existing ? (existing.updatedAt || existing.timestamp || 0) : -1;

                if (!existing || remoteUpdate > localUpdate) {
                    logService.info(`Syncing session: ${session.title}`);
                    dbService.saveSession(session);
                    return prev.some(s => s.id === session.id) 
                        ? prev.map(s => s.id === session.id ? session : s)
                        : [session, ...prev];
                }
                return prev;
            });
        } else if (type === 'groups') {
            const groups = data as ChatGroup[];
            if (!Array.isArray(groups)) return;
            if (typeof setSavedGroups !== 'function') return;
            
            logService.info(`Syncing ${groups.length} groups from server.`);
            dbService.setAllGroups(groups);
            setSavedGroups(groups);
        } else if (type === 'settings') {
            const settings = data as AppSettings;
            logService.info(`Syncing settings from server.`);
            setAppSettings(settings);
        } else if (type === 'scenarios') {
            const scenarios = data as SavedScenario[];
            if (!Array.isArray(scenarios)) return;
            if (typeof setSavedScenarios !== 'function') return;

            const SYSTEM_SCENARIO_IDS = [
                'succinct-scenario-default', 
                'socratic-scenario-default', 
                'default-scenario-default', 
                'Gemini3-scenario-default', 
                'reasoner-scenario-default', 
                'voxel-designer-scenario-default', 
                'standard-prompt-scenario-default', 
                'absolute-truth-scenario-default',
                'demo-scenario-showcase'
            ];
            const userScenariosOnly = scenarios.filter(s => !SYSTEM_SCENARIO_IDS.includes(s.id));
            
            logService.info(`Syncing ${userScenariosOnly.length} user scenarios from server.`);
            dbService.setAllScenarios(userScenariosOnly);
            setSavedScenarios(userScenariosOnly);
        }
    }, [syncServerUrl, buildSyncHeaders, setSavedSessions, setSavedGroups, setAppSettings, setSavedScenarios, rehydrateSyncedSession]);

    const pushItem = useCallback(async (type: SyncItemType, data: unknown, baseRevision: string | null) => {
        let syncData = data;
        if (type === 'session') {
            syncData = await prepareSessionForSync(data as SavedChatSession);
        }

        const response = await fetch(`${syncServerUrl}/api/sync/push`, {
            method: 'POST',
            headers: buildSyncHeaders(true),
            body: JSON.stringify({ type, data: syncData, baseRevision })
        });
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.error || `Push failed for ${type} (${response.status})`);
        }
    }, [syncServerUrl, buildSyncHeaders, prepareSessionForSync]);

    const pullFromServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded) {
            logService.warn("Pull ignored: Settings or History not yet loaded.");
            return;
        }
        setPullStatus('syncing');
        try {
            const metaRes = await fetch(`${syncServerUrl}/api/sync/metadata`, { headers: buildSyncHeaders() });
            if (!metaRes.ok) throw new Error("Server offline");
            const metadata = await metaRes.json() as SyncMetadata;

            logService.info("Metadata from server:", metadata);

            // 1. Pull Sessions
            const sessionPullPromises = [];
            for (const [id, remoteUpdatedAt] of Object.entries(metadata.sessions)) {
                const localSession = savedSessions.find(s => s.id === id);
                const localUpdate = localSession ? (localSession.updatedAt || localSession.timestamp || 0) : -1;
                if (!localSession || (remoteUpdatedAt as number) > localUpdate) {
                    sessionPullPromises.push(pullItem('session', id, remoteUpdatedAt as number));
                }
            }
            await Promise.all(sessionPullPromises);

            // 2. Pull Groups
            const localGroupsMax = Math.max(...savedGroups.map(g => g.updatedAt || g.timestamp || 0), 0);
            if (metadata.groups.updatedAt > localGroupsMax || (metadata.groups.updatedAt > 0 && savedGroups.length === 0)) {
                await pullItem('groups');
            }
            // 3. Pull Settings
            const localSettings = await dbService.getAppSettings();
            if (metadata.settings.updatedAt > (localSettings?.updatedAt || 0)) {
                await pullItem('settings');
            }
            // 4. Pull Scenarios
            const localScenariosMax = Math.max(...savedScenarios.map(s => s.updatedAt || 0), 0);
            if (metadata.scenarios.updatedAt > localScenariosMax || (metadata.scenarios.updatedAt > 0 && localScenariosMax === 0)) {
                await pullItem('scenarios');
            }

            setPullStatus('success');
            setLastPullTime(Date.now());
            setTimeout(() => setPullStatus('idle'), 3000);
        } catch (error) {
            logService.error("Pull from server failed", { error });
            setPullStatus('error');
            setTimeout(() => setPullStatus('idle'), 5000);
        }
    }, [isSettingsLoaded, isHistoryLoaded, syncServerUrl, buildSyncHeaders, savedSessions, savedGroups, savedScenarios, pullItem]);

    const pushToServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded) {
            logService.warn("Push ignored: Settings or History not yet loaded.");
            return;
        }
        setPushStatus('syncing');
        try {
            const metaRes = await fetch(`${syncServerUrl}/api/sync/metadata`, { headers: buildSyncHeaders() });
            if (!metaRes.ok) throw new Error("Server offline");
            const metadata = await metaRes.json() as SyncMetadata;

            let pushCount = 0;
            let sessionFailCount = 0;

            // 1. Push Sessions (Individual Items) - Atomic Try-Catch
            for (const session of savedSessions) {
                try {
                    const remoteUpdate = metadata.sessions[session.id] || 0;
                    const localUpdate = session.updatedAt || session.timestamp || 0;
                    if (localUpdate > remoteUpdate) {
                        await pushItem('session', session, metadata.revisions?.sessions?.[session.id] ?? null);
                        pushCount++;
                    }
                } catch (e) {
                    sessionFailCount++;
                    logService.error(`Failed to push session: ${session.title}`, e);
                }
            }

            // 2. Push Global State (Critical Files) - Separate calls to ensure partial success
            let globalFailCount = 0;
            const localGroupsMax = Math.max(...savedGroups.map(g => g.updatedAt || g.timestamp || 0), 0);
            if (localGroupsMax > metadata.groups.updatedAt || metadata.groups.updatedAt === 0) {
                try { await pushItem('groups', savedGroups, metadata.revisions?.groups ?? null); pushCount++; } catch(e) { globalFailCount++; logService.error("Failed to push groups", e); }
            }

            const localSettings = await dbService.getAppSettings();
            if ((localSettings?.updatedAt || 0) > metadata.settings.updatedAt || metadata.settings.updatedAt === 0) {
                try { await pushItem('settings', appSettings, metadata.revisions?.settings ?? null); pushCount++; } catch(e) { globalFailCount++; logService.error("Failed to push settings", e); }
            }

            const localScenariosMax = Math.max(...savedScenarios.map(s => s.updatedAt || 0), 0);
            if (localScenariosMax > metadata.scenarios.updatedAt || metadata.scenarios.updatedAt === 0) {
                try { await pushItem('scenarios', savedScenarios, metadata.revisions?.scenarios ?? null); pushCount++; } catch(e) { globalFailCount++; logService.error("Failed to push scenarios", e); }
            }

            if (sessionFailCount > 0 || globalFailCount > 0) {
                throw new Error(`Pushed ${pushCount} items, but ${sessionFailCount + globalFailCount} items failed or conflicted.`);
            }
            logService.info(`Successfully pushed ${pushCount} items to server.`);

            setPushStatus('success');
            setLastPushTime(Date.now());
            setTimeout(() => setPushStatus('idle'), 3000);
        } catch (error) {
            logService.error("Push to server failed", { error });
            setPushStatus('error');
            setTimeout(() => setPushStatus('idle'), 5000);
        }
    }, [isSettingsLoaded, isHistoryLoaded, syncServerUrl, buildSyncHeaders, savedSessions, savedGroups, savedScenarios, appSettings, pushItem]);

    return {
        pullStatus,
        pushStatus,
        lastPullTime,
        lastPushTime,
        pullFromServer,
        pushToServer
    };
};
