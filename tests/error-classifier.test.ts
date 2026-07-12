import { describe, expect, it } from 'vitest';
import { classifyApiError } from '../services/api/errorClassifier';

describe('API error classification', () => {
  it('classifies auth, quota, unsupported model, safety, empty and retryable network errors', () => {
    expect(classifyApiError(Object.assign(new Error('unauthorized'), { status: 401 })).kind).toBe('authentication');
    expect(classifyApiError(Object.assign(new Error('quota'), { status: 429 }))).toMatchObject({ kind: 'quota', retryable: true });
    expect(classifyApiError(Object.assign(new Error('model not found'), { status: 404 })).kind).toBe('unsupported_model');
    expect(classifyApiError(new Error('response blocked by safety')).kind).toBe('safety');
    expect(classifyApiError(new Error('empty response')).kind).toBe('empty_response');
    expect(classifyApiError(Object.assign(new Error('bad gateway'), { status: 502 })).retryable).toBe(true);
    expect(classifyApiError(Object.assign(new Error('server error'), { status: 500 })).retryable).toBe(false);
  });

  it('honors Retry-After seconds', () => {
    const error = Object.assign(new Error('rate limited'), { status: 429, headers: new Headers({ 'retry-after': '2' }) });
    expect(classifyApiError(error).retryAfterMs).toBe(2000);
  });
});
