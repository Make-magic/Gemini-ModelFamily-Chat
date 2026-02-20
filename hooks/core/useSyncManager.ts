import { useState, useCallback } from 'react';
import { dbService } from '../../utils/db';
import { AppSettings, SavedChatSession, ChatGroup, SavedScenario } from '../../types';
import { logService } from '../../utils/appUtils';

interface SyncManagerProps {
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    savedSessions: SavedChatSession[];
    setSavedSessions: (updater: (prev: SavedChatSession[]) => SavedChatSession[]) => void;
    savedGroups: ChatGroup[];
    setSavedGroups: (updater: (prev: ChatGroup[]) => ChatGroup[]) => void;
    savedScenarios: SavedScenario[];
    setSavedScenarios: (updater: (prev: SavedScenario[]) => SavedScenario[]) => void;
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
    
    const syncServerUrl = `http://${window.location.hostname}:8889`;

    const pullItem = useCallback(async (type: string, id?: string, remoteTimestamp?: number) => {
        const url = id ? `${syncServerUrl}/api/sync/pull?type=${type}&id=${id}` : `${syncServerUrl}/api/sync/pull?type=${type}`;
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        if (!data) return;

        if (type === 'session') {
            const session = data as SavedChatSession;
            if (typeof setSavedSessions !== 'function') {
                logService.error("setSavedSessions is not a function in pullItem");
                return;
            }
            setSavedSessions(prev => {
                const existing = prev.find(s => s.id === session.id);
                // Use provided remoteTimestamp, internal updatedAt, or timestamp for comparison
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
    }, [syncServerUrl, setSavedSessions, setSavedGroups, setAppSettings, setSavedScenarios]);

    const pushItem = useCallback(async (type: string, data: any) => {
        const response = await fetch(`${syncServerUrl}/api/sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, data })
        });
        if (!response.ok) throw new Error(`Push failed for ${type}`);
    }, [syncServerUrl]);

    const pullFromServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded) {
            logService.warn("Pull ignored: Settings or History not yet loaded.");
            return;
        }
        setPullStatus('syncing');
        try {
            const metaRes = await fetch(`${syncServerUrl}/api/sync/metadata`);
            if (!metaRes.ok) throw new Error("Server offline");
            const metadata = await metaRes.json();

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
            // savedScenarios prop contains system scenarios (0 timestamp)
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
    }, [isSettingsLoaded, isHistoryLoaded, syncServerUrl, savedSessions, savedGroups, savedScenarios, pullItem]);

    const pushToServer = useCallback(async () => {
        if (!isSettingsLoaded || !isHistoryLoaded) {
            logService.warn("Push ignored: Settings or History not yet loaded.");
            return;
        }
        setPushStatus('syncing');
        try {
            const metaRes = await fetch(`${syncServerUrl}/api/sync/metadata`);
            if (!metaRes.ok) throw new Error("Server offline");
            const metadata = await metaRes.json();

            let pushCount = 0;

            // Push Sessions
            for (const session of savedSessions) {
                const remoteUpdate = metadata.sessions[session.id] || 0;
                const localUpdate = session.updatedAt || session.timestamp || 0;
                if (localUpdate > remoteUpdate) {
                    await pushItem('session', session);
                    pushCount++;
                }
            }
            // Push Groups
            const localGroupsMax = Math.max(...savedGroups.map(g => g.updatedAt || g.timestamp || 0), 0);
            if (localGroupsMax > metadata.groups.updatedAt || metadata.groups.updatedAt === 0) {
                await pushItem('groups', savedGroups);
                pushCount++;
            }
            // Push Settings
            const localSettings = await dbService.getAppSettings();
            if ((localSettings?.updatedAt || 0) > metadata.settings.updatedAt || metadata.settings.updatedAt === 0) {
                await pushItem('settings', appSettings);
                pushCount++;
            }
            // Push Scenarios
            const localScenariosMax = Math.max(...savedScenarios.map(s => s.updatedAt || 0), 0);
            if (localScenariosMax > metadata.scenarios.updatedAt || metadata.scenarios.updatedAt === 0) {
                // When pushing scenarios, we push the computed savedScenarios list which contains both system and user ones.
                // This is fine because pullItem filters them out.
                await pushItem('scenarios', savedScenarios);
                pushCount++;
            }

            logService.info(`Pushed ${pushCount} items to server.`);
            setPushStatus('success');
            setLastPushTime(Date.now());
            setTimeout(() => setPushStatus('idle'), 3000);
        } catch (error) {
            logService.error("Push to server failed", { error });
            setPushStatus('error');
            setTimeout(() => setPushStatus('idle'), 5000);
        }
    }, [isSettingsLoaded, isHistoryLoaded, syncServerUrl, savedSessions, savedGroups, savedScenarios, appSettings, pushItem]);

    return {
        pullStatus,
        pushStatus,
        lastPullTime,
        lastPushTime,
        pullFromServer,
        pushToServer
    };
};
