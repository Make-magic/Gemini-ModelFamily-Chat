export interface ThreeWayMergeResult<T> {
  value: T;
  conflicts: string[];
}

const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

export const mergeSettingsThreeWay = <T extends object>(
  base: T | undefined,
  local: T,
  remote: T,
): ThreeWayMergeResult<T> => {
  if (!base) return { value: remote, conflicts: [] };
  const value: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const baseRecord = base as Record<string, unknown>;
  const localRecord = local as Record<string, unknown>;
  const remoteRecord = remote as Record<string, unknown>;
  const keys = new Set([...Object.keys(baseRecord), ...Object.keys(localRecord), ...Object.keys(remoteRecord)]);

  for (const key of keys) {
    const baseValue = baseRecord[key];
    const localValue = localRecord[key];
    const remoteValue = remoteRecord[key];
    if (equal(localValue, remoteValue) || equal(remoteValue, baseValue)) value[key] = localValue;
    else if (equal(localValue, baseValue)) value[key] = remoteValue;
    else {
      value[key] = localValue;
      conflicts.push(key);
    }
  }

  return { value: value as T, conflicts };
};

export const mergeEntitiesThreeWay = <T extends { id: string }>(
  base: T[] | undefined,
  local: T[],
  remote: T[],
): ThreeWayMergeResult<T[]> => {
  if (!base) return { value: remote, conflicts: [] };
  const baseMap = new Map(base.map(item => [item.id, item]));
  const localMap = new Map(local.map(item => [item.id, item]));
  const remoteMap = new Map(remote.map(item => [item.id, item]));
  const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  const value: T[] = [];
  const conflicts: string[] = [];

  for (const id of ids) {
    const baseItem = baseMap.get(id);
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);
    if (equal(localItem, remoteItem) || equal(remoteItem, baseItem)) {
      if (localItem) value.push(localItem);
    } else if (equal(localItem, baseItem)) {
      if (remoteItem) value.push(remoteItem);
    } else {
      if (localItem) value.push(localItem);
      conflicts.push(id);
    }
  }

  return { value, conflicts };
};
