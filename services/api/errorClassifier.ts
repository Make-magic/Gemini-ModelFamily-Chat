import type { ApiErrorKind, ClassifiedApiError } from '../../types';

const getStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const direct = Number((error as { status?: unknown }).status);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const message = String((error as { message?: unknown }).message ?? '');
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? Number(match[1]) : undefined;
};

const getRetryAfterMs = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const headers = (error as { headers?: unknown; response?: { headers?: unknown } }).headers
    ?? (error as { response?: { headers?: unknown } }).response?.headers;
  let value: string | null | undefined;
  if (headers instanceof Headers) value = headers.get('retry-after');
  else if (headers && typeof headers === 'object') value = String((headers as Record<string, unknown>)['retry-after'] ?? (headers as Record<string, unknown>)['Retry-After'] ?? '');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
};

export const classifyApiError = (error: unknown): ClassifiedApiError => {
  const source = error instanceof Error ? error : new Error(String(error || 'Unknown API error'));
  const message = source.message.toLowerCase();
  const status = getStatus(error);
  let kind: ApiErrorKind = 'unknown';

  if (source.name === 'AbortError' || message.includes('aborted') || message.includes('cancelled')) kind = 'aborted';
  else if (status === 401 || status === 403 || message.includes('api key') || message.includes('unauth')) kind = 'authentication';
  else if (status === 429 || message.includes('quota') || message.includes('resource_exhausted')) kind = 'quota';
  else if (status === 404 || message.includes('model') && (message.includes('not found') || message.includes('unsupported'))) kind = 'unsupported_model';
  else if (message.includes('safety') || message.includes('blocked') || message.includes('prohibited')) kind = 'safety';
  else if (message.includes('empty response') || message.includes('no response content')) kind = 'empty_response';
  else if (source instanceof TypeError || (status !== undefined && status >= 500) || message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('connection')) kind = 'network';

  const classified = source as ClassifiedApiError;
  classified.kind = kind;
  classified.status = status;
  classified.retryable = status === 429 || status === 502 || status === 503 || status === 504 || (kind === 'network' && status === undefined);
  classified.retryAfterMs = getRetryAfterMs(error);
  return classified;
};

export const waitForRetry = (delayMs: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal.aborted) {
    const error = new Error('aborted');
    error.name = 'AbortError';
    reject(error);
    return;
  }
  const timer = window.setTimeout(() => {
    signal.removeEventListener('abort', onAbort);
    resolve();
  }, delayMs);
  const onAbort = () => {
    window.clearTimeout(timer);
    const error = new Error('aborted');
    error.name = 'AbortError';
    reject(error);
  };
  signal.addEventListener('abort', onAbort, { once: true });
});
