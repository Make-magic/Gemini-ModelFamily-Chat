import { describe, expect, it } from 'vitest';
import { createApiKeyFingerprint, redactSensitiveData, redactSensitiveText } from '../utils/security';

describe('security redaction', () => {
  it('removes API keys, bearer tokens, credential fields and URL credentials', () => {
    const key = `AIza${'A'.repeat(32)}`;
    const output = JSON.stringify(redactSensitiveData({ apiKey: key, authorization: `Bearer secret-token`, url: 'https://user:pass@example.com/?key=secret' }));
    expect(output).not.toContain(key);
    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('user:pass');
    expect(redactSensitiveText(`Authorization: Bearer abc.def ${key}`)).not.toContain(key);
  });

  it('creates a non-plaintext short fingerprint', async () => {
    const key = `AIza${'B'.repeat(32)}`;
    const fingerprint = await createApiKeyFingerprint(key);
    expect(fingerprint).toContain(`${key.slice(0, 4)}…${key.slice(-4)}`);
    expect(fingerprint).not.toContain(key);
  });
});
