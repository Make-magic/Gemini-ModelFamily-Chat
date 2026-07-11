import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SyncService } = require('../backend/sync-server.cjs');
const roots: string[] = [];
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const registry = { broadcast() {} };

afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

describe('sync metadata v2', () => {
  it('rebuilds a legacy directory once, persists incremental metadata, and keeps tombstones permanent', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'amc-sync-'));
    roots.push(root);
    await mkdir(path.join(root, 'sessions'), { recursive: true });
    const legacy = { id: 'legacy-session', title: 'Legacy', timestamp: 10, updatedAt: 20, messages: [], settings: {} };
    await writeFile(path.join(root, 'sessions', 'legacy-session.json'), JSON.stringify(legacy));

    const service = new SyncService(logger, registry, { storagePath: root });
    await service.init();
    const metadata = await service.getMetadata();
    expect(metadata.version).toBe(2);
    expect(metadata.sessions['legacy-session'].updatedAt).toBe(20);
    expect(metadata.sessions['legacy-session'].revision).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(await readFile(path.join(root, 'metadata.json'), 'utf8')).version).toBe(2);

    const settingsResult = await service.saveItem('settings', { updatedAt: 30, themeId: 'onyx' }, null);
    expect((await service.getMetadata()).globals.settings.revision).toBe(settingsResult.revision);
    await expect(service.saveItem('settings', { updatedAt: 31 }, null)).rejects.toMatchObject({ statusCode: 409 });

    const revision = metadata.sessions['legacy-session'].revision;
    const deletion = await service.deleteItem('session', 'legacy-session', revision);
    expect((await service.getMetadata()).tombstones.sessions['legacy-session'].revision).toBe(deletion.revision);
    await expect(service.saveItem('session', legacy, null)).rejects.toMatchObject({ statusCode: 410 });

    const restarted = new SyncService(logger, registry, { storagePath: root });
    await restarted.init();
    expect((await restarted.getMetadata()).tombstones.sessions['legacy-session']).toBeTruthy();
  });
});
