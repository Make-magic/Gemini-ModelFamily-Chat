// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createManagedObjectUrl, downloadBlob, getManagedObjectUrlCount, releaseFilesObjectUrls, revokeAllManagedObjectUrls } from '../utils/objectUrlManager';

describe('object URL manager', () => {
  beforeEach(() => {
    revokeAllManagedObjectUrls();
    let id = 0;
    URL.createObjectURL = vi.fn(() => `blob:test-${++id}`);
    URL.revokeObjectURL = vi.fn();
  });

  it('returns to baseline after attachment removal and global cleanup', () => {
    const baseline = getManagedObjectUrlCount();
    const first = createManagedObjectUrl(new Blob(['a']));
    createManagedObjectUrl(new Blob(['b']));
    expect(getManagedObjectUrlCount()).toBe(baseline + 2);
    releaseFilesObjectUrls([{ id: '1', name: 'a', type: 'text/plain', size: 1, dataUrl: first }]);
    expect(getManagedObjectUrlCount()).toBe(baseline + 1);
    revokeAllManagedObjectUrls();
    expect(getManagedObjectUrlCount()).toBe(baseline);
  });

  it('delays download URL revocation', () => {
    vi.useFakeTimers();
    HTMLAnchorElement.prototype.click = vi.fn();
    downloadBlob(new Blob(['x']), 'x.txt', 1000);
    expect(getManagedObjectUrlCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(getManagedObjectUrlCount()).toBe(0);
    vi.useRealTimers();
  });
});
