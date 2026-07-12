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
  /** Stable fingerprint of the last content known to be shared by this client and the server. */
  baseFingerprint?: string;
}

export interface SyncClientState {
  version: 2;
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

export type SyncDirection = 'pull' | 'push';

export type SessionSyncDecision =
  | 'same'
  | 'bootstrap_local'
  | 'bootstrap_remote'
  | 'local_only'
  | 'remote_only'
  | 'conflict'
  | 'unchanged';
