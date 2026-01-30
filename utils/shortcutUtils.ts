
export const isShortcutPressed = (event: KeyboardEvent | React.KeyboardEvent, keys: string[] = []): boolean => {
    if (!keys || keys.length === 0) return false;

    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    // Check modifiers
    const hasCtrl = event.ctrlKey;
    const hasMeta = event.metaKey;
    const hasAlt = event.altKey;
    const hasShift = event.shiftKey;

    // Expected modifiers
    let expectCtrl = keys.includes('Ctrl') || keys.includes('Control');
    let expectMeta = keys.includes('Meta');
    let expectAlt = keys.includes('Alt');
    let expectShift = keys.includes('Shift');
    const expectMod = keys.includes('Mod');

    if (expectMod) {
        if (isMac) expectMeta = true;
        else expectCtrl = true;
    }

    if (hasCtrl !== expectCtrl) return false;
    if (hasMeta !== expectMeta) return false;
    if (hasAlt !== expectAlt) return false;
    if (hasShift !== expectShift) return false;

    // Check primary key
    // The last key in the array is usually the primary key (not a modifier)
    // But we need to find the non-modifier key to check against event.key
    const modifiers = ['Ctrl', 'Control', 'Meta', 'Alt', 'Shift', 'Mod'];
    const primaryKeys = keys.filter(k => !modifiers.includes(k));

    if (primaryKeys.length === 0) {
        // Only modifiers? If input is only modifiers, exact match is hard because event maps to one key.
        // But for shortcuts usually we want keydown on the non-modifier.
        // If the shortcut is JUST modifiers (unlikely for "pressed"), we might return true if only those are held?
        // But usually event.key would be 'Control' etc.
        // Let's assume standard shortcuts have a primary key.
        return true;
    }

    // Check against event.key
    // Normalize: 'n' vs 'N'. event.key is case sensitive? 
    // Usually shortcuts are defined as 'n' or 'N' but imply the key itself.
    // If Shift is pressed, event.key might be 'N'. If not, 'n'.
    // We should compare case-insensitively or rely on the configured string.

    const pressedKey = event.key.toLowerCase();

    return primaryKeys.some(k => k.toLowerCase() === pressedKey);
};
