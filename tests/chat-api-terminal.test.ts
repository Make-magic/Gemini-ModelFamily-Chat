import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/logService', () => ({
  logService: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('../services/api/baseApi', () => ({ getConfiguredApiClient: vi.fn() }));

import { getConfiguredApiClient } from '../services/api/baseApi';
import { sendStatelessMessageNonStreamApi } from '../services/api/chatApi';

const generateContent = vi.fn();

describe('non-stream chat terminal result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfiguredApiClient).mockResolvedValue({
      models: { generateContent },
    } as never);
  });

  it('emits success exactly once even when the terminal callback throws', async () => {
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'done' }] } }],
    });
    const onTerminal = vi.fn(() => {
      throw new Error('consumer failure');
    });

    await sendStatelessMessageNonStreamApi(
      'key', 'model', [], [{ text: 'hello' }], {}, new AbortController().signal, onTerminal,
    );

    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  it('emits abort exactly once', async () => {
    const controller = new AbortController();
    controller.abort();
    const onTerminal = vi.fn();

    await sendStatelessMessageNonStreamApi(
      'key', 'model', [], [{ text: 'hello' }], {}, controller.signal, onTerminal,
    );

    expect(generateContent).not.toHaveBeenCalled();
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: 'abort' }));
  });

  it('emits error exactly once', async () => {
    generateContent.mockRejectedValue(new Error('request failed'));
    const onTerminal = vi.fn();

    await sendStatelessMessageNonStreamApi(
      'key', 'model', [], [{ text: 'hello' }], {}, new AbortController().signal, onTerminal,
    );

    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });
});
