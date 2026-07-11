import type { AppSettings } from './settings';
import type { ChatGroup, SavedScenario } from './chat';

export interface SyncItemMetadata {
  updatedAt: number;
  revision: string | null;
  size: number;
}

export interface SyncTombstone {
  deletedAt: number;
  revision: string;
}

export interface SyncMetadata {
  version: 2;
  updatedAt: number;
  sessions: Record<string, SyncItemMetadata>;
  globals: {
    groups: SyncItemMetadata;
    settings: SyncItemMetadata;
    scenarios: SyncItemMetadata;
  };
  tombstones: { sessions: Record<string, SyncTombstone> };
}

export interface SyncedItemState {
  revision: string | null;
  lastSyncedAt: number;
  localUpdatedAt: number;
}

export interface SyncClientState {
  version: 1;
  sessions: Record<string, SyncedItemState>;
  globals: Record<'groups' | 'settings' | 'scenarios', SyncedItemState>;
  baseSnapshots: {
    groups?: ChatGroup[];
    settings?: AppSettings;
    scenarios?: SavedScenario[];
  };
  knownTombstones: Record<string, SyncTombstone>;
}

export type SyncConflictChoice = 'keep_both' | 'use_remote' | 'overwrite_remote';

export interface SyncConflictRequest {
  id: string;
  itemType: 'session' | 'groups' | 'settings' | 'scenarios';
  title: string;
  detail: string;
  defaultChoice: SyncConflictChoice;
}
