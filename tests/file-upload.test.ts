// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/logService', () => ({ logService: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../services/api/baseApi', () => ({ getConfiguredApiClient: vi.fn() }));

import { uploadFileApi } from '../services/api/fileApi';

describe('resumable file upload', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uploads in 8MB chunks and reports only acknowledged bytes', async () => {
    const total = 20 * 1024 * 1024;
    const responses = [
      new Response(null, { status: 200, headers: { 'x-goog-upload-url': 'https://upload.test/session' } }),
      new Response(null, { status: 200 }),
      new Response(null, { status: 200 }),
      new Response(JSON.stringify({ file: { name: 'files/result', state: 'ACTIVE' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ];
    const uploadBodies: Blob[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body instanceof Blob) uploadBodies.push(init.body);
      return responses.shift()!;
    });
    vi.stubGlobal('fetch', fetchMock);
    const progress: number[] = [];
    const file = new File([new Uint8Array(total)], 'large.bin', { type: 'application/octet-stream' });
    const result = await uploadFileApi('key', file, file.type, file.name, new AbortController().signal, loaded => progress.push(loaded));
    expect(result.name).toBe('files/result');
    expect(progress).toEqual([8 * 1024 * 1024, 16 * 1024 * 1024, total]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(uploadBodies[0].size).toBe(8 * 1024 * 1024);
    expect(uploadBodies[2].size).toBe(4 * 1024 * 1024);
  });

  it('does not start a request when already cancelled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(uploadFileApi('key', new File(['x'], 'x.txt'), 'text/plain', 'x.txt', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
