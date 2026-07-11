import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { SavedChatSession, SyncedItemState } from '../types';
import {
  createConflictCopy,
  decideSessionSync,
  findRedundantConflictCopyIds,
  fingerprintSession,
  migrateSyncClientState,
  sha256BytesFallback,
} from '../utils/syncSession';

const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

const session = (content = 'hello'): SavedChatSession => ({
  id: 'session-1',
  title: 'Session',
  timestamp: 100,
  updatedAt: 200,
  settings: {} as SavedChatSession['settings'],
  messages: [{
    id: 'message-1',
    role: 'user',
    content,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
  }],
});

describe('session sync fingerprints', () => {
  it('keeps SHA-256 available when SubtleCrypto is unavailable on an HTTP LAN origin', () => {
    expect(sha256BytesFallback(new TextEncoder().encode('hello'))).toBe(HELLO_SHA256);
    for (const length of [0, 1, 55, 56, 63, 64, 65, 1000]) {
      const bytes = new Uint8Array(length).map((_, index) => index % 251);
      expect(sha256BytesFallback(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  it('ignores timestamps and runtime-only upload state', async () => {
    const left = session();
    left.messages[0].isLoading = true;
    left.messages[0].files = [{
      id: 'file-1', name: 'hello.txt', type: 'text/plain', size: 5,
      rawFile: new Blob(['hello'], { type: 'text/plain' }), progress: 20, uploadState: 'uploading',
    }];

    const right = session();
    right.updatedAt = 999;
    right.messages[0].files = [{
      id: 'file-1', name: 'hello.txt', type: 'text/plain', size: 5,
      syncData: 'aGVsbG8=', progress: 100, uploadState: 'active',
    }];

    await expect(fingerprintSession(left)).resolves.toBe(await fingerprintSession(right));

    right.messages[0].files = [{
      id: 'file-1', name: 'hello.txt', type: 'text/plain', size: 5,
      syncBlobId: HELLO_SHA256, syncBlobSize: 5,
    }];
    await expect(fingerprintSession(left)).resolves.toBe(await fingerprintSession(right));
  });

  it('treats a generated conflict copy as the same payload when identity and title are ignored', async () => {
    const original = session();
    const copy = createConflictCopy(original, 'local', 1234);
    const options = { ignoreIdentity: true, ignoreTitle: true };
    expect(await fingerprintSession(copy, options)).toBe(await fingerprintSession(original, options));
  });

  it('only marks generated copies redundant when their payload still matches the base session', async () => {
    const original = session();
    const identicalCopy = createConflictCopy(original, 'local', 1234);
    const editedCopy = createConflictCopy(session(), 'remote', 5678);
    editedCopy.messages[0].content = 'different';
    await expect(findRedundantConflictCopyIds([original, identicalCopy, editedCopy])).resolves.toEqual([identicalCopy.id]);
  });
});

describe('session sync decision state machine', () => {
  const known = (overrides: Partial<SyncedItemState> = {}): SyncedItemState => ({
    revision: 'revision-a',
    lastSyncedAt: 10,
    localUpdatedAt: 10,
    baseFingerprint: 'base',
    ...overrides,
  });

  it('silently links identical first-sync content', () => {
    expect(decideSessionSync({
      direction: 'pull', localFingerprint: 'same', remoteFingerprint: 'same', remoteRevision: 'revision-a',
    })).toBe('same');
  });

  it('uses the clicked direction when no baseline exists and content differs', () => {
    expect(decideSessionSync({
      direction: 'pull', localFingerprint: 'local', remoteFingerprint: 'remote', remoteRevision: 'revision-a',
    })).toBe('bootstrap_remote');
    expect(decideSessionSync({
      direction: 'push', localFingerprint: 'local', remoteFingerprint: 'remote', remoteRevision: 'revision-a',
    })).toBe('bootstrap_local');
  });

  it('only reports conflict when both sides changed from the shared baseline', () => {
    expect(decideSessionSync({
      direction: 'push', known: known(), localFingerprint: 'local', remoteFingerprint: 'base', remoteRevision: 'revision-a',
    })).toBe('local_only');
    expect(decideSessionSync({
      direction: 'pull', known: known(), localFingerprint: 'base', remoteFingerprint: 'remote', remoteRevision: 'revision-b',
    })).toBe('remote_only');
    expect(decideSessionSync({
      direction: 'pull', known: known(), localFingerprint: 'local', remoteFingerprint: 'remote', remoteRevision: 'revision-b',
    })).toBe('conflict');
  });

  it('migrates version 1 state without inventing a baseline fingerprint', () => {
    const migrated = migrateSyncClientState({
      version: 1,
      sessions: { 'session-1': { revision: 'revision-a', lastSyncedAt: 1, localUpdatedAt: 2 } },
      globals: {
        groups: { revision: null, lastSyncedAt: 0, localUpdatedAt: 0 },
        settings: { revision: null, lastSyncedAt: 0, localUpdatedAt: 0 },
        scenarios: { revision: null, lastSyncedAt: 0, localUpdatedAt: 0 },
      },
      baseSnapshots: {},
      knownTombstones: {},
    });
    expect(migrated.version).toBe(2);
    expect(migrated.sessions['session-1']).toMatchObject({ revision: 'revision-a', localUpdatedAt: 2 });
    expect(migrated.sessions['session-1'].baseFingerprint).toBeUndefined();
  });
});
