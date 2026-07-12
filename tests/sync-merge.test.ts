import { describe, expect, it } from 'vitest';
import { mergeEntitiesThreeWay, mergeSettingsThreeWay } from '../utils/syncMerge';

describe('three-way sync merge', () => {
  it('merges independent settings fields and reports same-field conflicts', () => {
    const result = mergeSettingsThreeWay(
      { theme: 'dark', language: 'en' },
      { theme: 'light', language: 'en' },
      { theme: 'dark', language: 'zh' },
    );
    expect(result.value).toEqual({ theme: 'light', language: 'zh' });
    expect(result.conflicts).toEqual([]);

    const conflict = mergeSettingsThreeWay({ theme: 'dark' }, { theme: 'light' }, { theme: 'system' });
    expect(conflict.conflicts).toEqual(['theme']);
  });

  it('merges groups/scenarios by id and reports concurrent entity edits', () => {
    const result = mergeEntitiesThreeWay(
      [{ id: 'a', value: 1 }, { id: 'b', value: 1 }],
      [{ id: 'a', value: 2 }, { id: 'b', value: 1 }],
      [{ id: 'a', value: 1 }, { id: 'b', value: 2 }],
    );
    expect(result.value).toEqual([{ id: 'a', value: 2 }, { id: 'b', value: 2 }]);
    expect(result.conflicts).toEqual([]);
  });
});
