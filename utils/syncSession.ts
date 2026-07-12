import type {
  SavedChatSession,
  SessionSyncDecision,
  SyncClientState,
  SyncDirection,
  SyncedItemState,
  UploadedFile,
} from '../types';

const TRANSIENT_FILE_KEYS = new Set([
  'abortController',
  'dataUrl',
  'error',
  'failureStage',
  'fileApiName',
  'fileUri',
  'isProcessing',
  'progress',
  'rawFile',
  'retryCount',
  'syncBlobId',
  'syncBlobSize',
  'syncData',
  'uploadSpeed',
  'uploadState',
]);

const TRANSIENT_MESSAGE_KEYS = new Set([
  'audioSrc',
  'generationEndTime',
  'generationStartTime',
  'isGeneratingSuggestions',
  'isLoading',
]);

const blobDigestCache = new WeakMap<Blob, Promise<string>>();

const bytesToHex = (bytes: Uint8Array): string => (
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
);

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotateRight = (value: number, amount: number): number => (value >>> amount) | (value << (32 - amount));

class Sha256Accumulator {
  private readonly hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly words = new Uint32Array(64);
  private readonly buffer = new Uint8Array(64);
  private bufferLength = 0;
  private bytesHashed = 0;

  private processBlock(bytes: Uint8Array, offset: number): void {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 64);
    for (let index = 0; index < 16; index += 1) this.words[index] = view.getUint32(index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const left = this.words[index - 15];
      const right = this.words[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      this.words[index] = (this.words[index - 16] + sigma0 + this.words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = this.hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + this.words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    this.hash[0] = (this.hash[0] + a) >>> 0;
    this.hash[1] = (this.hash[1] + b) >>> 0;
    this.hash[2] = (this.hash[2] + c) >>> 0;
    this.hash[3] = (this.hash[3] + d) >>> 0;
    this.hash[4] = (this.hash[4] + e) >>> 0;
    this.hash[5] = (this.hash[5] + f) >>> 0;
    this.hash[6] = (this.hash[6] + g) >>> 0;
    this.hash[7] = (this.hash[7] + h) >>> 0;
  }

  update(bytes: Uint8Array): void {
    this.bytesHashed += bytes.byteLength;
    let offset = 0;

    if (this.bufferLength) {
      const needed = 64 - this.bufferLength;
      const available = Math.min(needed, bytes.byteLength);
      this.buffer.set(bytes.subarray(0, available), this.bufferLength);
      this.bufferLength += available;
      offset += available;
      if (this.bufferLength === 64) {
        this.processBlock(this.buffer, 0);
        this.bufferLength = 0;
      }
    }

    while (offset + 64 <= bytes.byteLength) {
      this.processBlock(bytes, offset);
      offset += 64;
    }

    if (offset < bytes.byteLength) {
      this.buffer.set(bytes.subarray(offset), 0);
      this.bufferLength = bytes.byteLength - offset;
    }
  }

  digest(): string {
    const bitLength = this.bytesHashed * 8;
    this.buffer[this.bufferLength] = 0x80;
    this.bufferLength += 1;
    if (this.bufferLength > 56) {
      this.buffer.fill(0, this.bufferLength);
      this.processBlock(this.buffer, 0);
      this.buffer.fill(0);
    } else {
      this.buffer.fill(0, this.bufferLength, 56);
    }
    const view = new DataView(this.buffer.buffer);
    view.setUint32(56, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(60, bitLength >>> 0, false);
    this.processBlock(this.buffer, 0);
    return Array.from(this.hash, word => word.toString(16).padStart(8, '0')).join('');
  }
}

export const sha256BytesFallback = (bytes: Uint8Array): string => {
  const accumulator = new Sha256Accumulator();
  accumulator.update(bytes);
  return accumulator.digest();
};

const sha256Bytes = async (bytes: Uint8Array): Promise<string> => {
  if (globalThis.crypto?.subtle) {
    try {
      const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const digest = await globalThis.crypto.subtle.digest('SHA-256', source);
      return bytesToHex(new Uint8Array(digest));
    } catch {
      // HTTP LAN origins may not expose SubtleCrypto even though the rest of the app is usable.
    }
  }
  return sha256BytesFallback(bytes);
};

const sha256Text = (value: string): Promise<string> => sha256Bytes(new TextEncoder().encode(value));

const sha256Blob = (blob: Blob): Promise<string> => {
  const cached = blobDigestCache.get(blob);
  if (cached) return cached;
  const digest = (async () => {
    if (blob.size <= 16 * 1024 * 1024) {
      return sha256Bytes(new Uint8Array(await blob.arrayBuffer()));
    }
    const accumulator = new Sha256Accumulator();
    const reader = blob.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulator.update(value);
    }
    return accumulator.digest();
  })();
  blobDigestCache.set(blob, digest);
  return digest;
};

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const stableValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
};

export const stableStringify = (value: unknown): string => JSON.stringify(stableValue(value));

const getFileContentDigest = async (file: UploadedFile): Promise<string | null> => {
  if (file.syncBlobId) return file.syncBlobId.toLowerCase();
  if (file.rawFile instanceof Blob) return sha256Blob(file.rawFile);
  if (file.syncData) return sha256Bytes(decodeBase64(file.syncData));
  if (file.textContent !== undefined) return sha256Text(file.textContent);
  const durableUrl = file.dataUrl && !file.dataUrl.startsWith('blob:') && !file.dataUrl.startsWith('data:')
    ? file.dataUrl
    : file.fileUri;
  return durableUrl ? sha256Text(durableUrl) : null;
};

const normalizeFile = async (file: UploadedFile): Promise<Record<string, unknown>> => {
  const normalized = Object.fromEntries(
    Object.entries(file).filter(([key, value]) => !TRANSIENT_FILE_KEYS.has(key) && value !== undefined),
  );
  normalized.contentDigest = await getFileContentDigest(file);
  return normalized;
};

export const normalizeSessionForFingerprint = async (
  session: SavedChatSession,
  options: { ignoreIdentity?: boolean; ignoreTitle?: boolean } = {},
): Promise<Record<string, unknown>> => {
  const normalizedMessages = await Promise.all(session.messages.map(async message => {
    const normalized = Object.fromEntries(
      Object.entries(message).filter(([key, value]) => !TRANSIENT_MESSAGE_KEYS.has(key) && key !== 'files' && value !== undefined),
    );
    if (message.files?.length) normalized.files = await Promise.all(message.files.map(normalizeFile));
    return normalized;
  }));

  const normalized: Record<string, unknown> = {
    ...session,
    messages: normalizedMessages,
  };
  delete normalized.updatedAt;
  if (options.ignoreIdentity) delete normalized.id;
  if (options.ignoreTitle) delete normalized.title;
  return normalized;
};

export const fingerprintSession = async (
  session: SavedChatSession,
  options?: { ignoreIdentity?: boolean; ignoreTitle?: boolean },
): Promise<string> => sha256Text(stableStringify(await normalizeSessionForFingerprint(session, options)));

export interface SessionDecisionInput {
  direction: SyncDirection;
  known?: SyncedItemState;
  localFingerprint: string;
  remoteFingerprint: string;
  remoteRevision: string;
  legacyLocalChanged?: boolean;
}

export const decideSessionSync = ({
  direction,
  known,
  localFingerprint,
  remoteFingerprint,
  remoteRevision,
  legacyLocalChanged = false,
}: SessionDecisionInput): SessionSyncDecision => {
  if (localFingerprint === remoteFingerprint) return 'same';
  if (!known) return direction === 'push' ? 'bootstrap_local' : 'bootstrap_remote';

  const remoteChanged = known.revision !== remoteRevision;
  const localChanged = known.baseFingerprint
    ? known.baseFingerprint !== localFingerprint
    : legacyLocalChanged;

  if (localChanged && remoteChanged) return 'conflict';
  if (localChanged) return 'local_only';
  if (remoteChanged) return 'remote_only';
  return 'unchanged';
};

interface LegacySyncClientState extends Omit<SyncClientState, 'version'> {
  version: 1;
}

const emptyItemState = (): SyncedItemState => ({ revision: null, lastSyncedAt: 0, localUpdatedAt: 0 });

export const createEmptySyncClientState = (): SyncClientState => ({
  version: 2,
  sessions: {},
  globals: { groups: emptyItemState(), settings: emptyItemState(), scenarios: emptyItemState() },
  baseSnapshots: {},
  knownTombstones: {},
});

export const migrateSyncClientState = (value: unknown): SyncClientState => {
  if (!value || typeof value !== 'object') return createEmptySyncClientState();
  const candidate = value as SyncClientState | LegacySyncClientState;
  if (candidate.version !== 1 && candidate.version !== 2) return createEmptySyncClientState();
  return {
    ...createEmptySyncClientState(),
    ...candidate,
    version: 2,
    sessions: { ...(candidate.sessions || {}) },
    globals: { ...createEmptySyncClientState().globals, ...(candidate.globals || {}) },
    baseSnapshots: { ...(candidate.baseSnapshots || {}) },
    knownTombstones: { ...(candidate.knownTombstones || {}) },
  };
};

export const createConflictCopy = (
  session: SavedChatSession,
  source: 'local' | 'remote',
  now = Date.now(),
): SavedChatSession => ({
  ...session,
  id: `${session.id}-${source}-${now}`,
  title: `${session.title}${source === 'local' ? '（本地冲突副本）' : '（远端冲突副本）'}`,
  updatedAt: now,
});

const GENERATED_COPY_PATTERN = /^(.*)-(local|remote)-(\d+)$/;

export const findRedundantConflictCopyIds = async (sessions: SavedChatSession[]): Promise<string[]> => {
  const byId = new Map(sessions.map(item => [item.id, item]));
  const baseFingerprints = new Map<string, Promise<string>>();
  const redundant: string[] = [];

  for (const candidate of sessions) {
    const match = candidate.id.match(GENERATED_COPY_PATTERN);
    if (!match) continue;
    const [, baseId, source] = match;
    const expectedSuffix = source === 'local' ? '（本地冲突副本）' : '（远端冲突副本）';
    if (!candidate.title.endsWith(expectedSuffix)) continue;
    const base = byId.get(baseId);
    if (!base) continue;

    let baseFingerprint = baseFingerprints.get(baseId);
    if (!baseFingerprint) {
      baseFingerprint = fingerprintSession(base, { ignoreIdentity: true, ignoreTitle: true });
      baseFingerprints.set(baseId, baseFingerprint);
    }
    const candidateFingerprint = await fingerprintSession(candidate, { ignoreIdentity: true, ignoreTitle: true });
    if (candidateFingerprint === await baseFingerprint) redundant.push(candidate.id);
  }

  return redundant;
};

export const planSessionPush = (
  sessions: SavedChatSession[],
  knownSessionIds: Iterable<string>,
  pendingDeletionIds: Iterable<string>,
): { sessions: SavedChatSession[]; deletionIds: string[] } => {
  const pending = new Set(pendingDeletionIds);
  const activeSessions = sessions.filter(session => !pending.has(session.id));
  const activeIds = new Set(activeSessions.map(session => session.id));
  const deletionIds = new Set(pending);
  for (const id of knownSessionIds) {
    if (!activeIds.has(id)) deletionIds.add(id);
  }
  return { sessions: activeSessions, deletionIds: [...deletionIds] };
};
