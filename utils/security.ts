const SENSITIVE_KEY_PATTERN = /(?:api[_-]?key|authorization|password|passwd|secret|access[_-]?token|refresh[_-]?token|credential|lockedApiKey)/i;
const API_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const URL_CREDENTIAL_PATTERN = /(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/gi;
const URL_SECRET_QUERY_PATTERN = /([?&](?:key|api[_-]?key|token|access[_-]?token|auth)=)[^&#\s]+/gi;

export const redactSensitiveText = (value: string): string => value
  .replace(API_KEY_PATTERN, '[REDACTED_API_KEY]')
  .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
  .replace(URL_CREDENTIAL_PATTERN, '$1[REDACTED]@')
  .replace(URL_SECRET_QUERY_PATTERN, '$1[REDACTED]');

export const redactSensitiveData = (value: unknown): unknown => {
  const seen = new WeakSet<object>();
  const visit = (input: unknown, key = ''): unknown => {
    if (SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
    if (typeof input === 'string') return redactSensitiveText(input);
    if (!input || typeof input !== 'object') return input;
    if (input instanceof Date) return input.toISOString();
    if (input instanceof Error) {
      return {
        name: input.name,
        message: redactSensitiveText(input.message),
        stack: input.stack ? redactSensitiveText(input.stack) : undefined,
        cause: visit(input.cause, 'cause'),
      };
    }
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    if (Array.isArray(input)) return input.map(item => visit(item));
    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(input as Record<string, unknown>)) {
      result[entryKey] = visit(entryValue, entryKey);
    }
    return result;
  };
  return visit(value);
};

const toHex = (bytes: Uint8Array): string => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

export const createApiKeyFingerprint = async (apiKey: string): Promise<string> => {
  const normalized = apiKey.trim();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const hash = toHex(new Uint8Array(digest)).slice(0, 12);
  const prefix = normalized.slice(0, 4) || 'key';
  const suffix = normalized.slice(-4) || 'none';
  return `${prefix}…${suffix} · ${hash}`;
};
