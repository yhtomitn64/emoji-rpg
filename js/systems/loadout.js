export const LOADOUT_SIZE = 4;

export function createEmptyLoadout() {
  return Array(LOADOUT_SIZE).fill(null);
}

// Also clears itemId from any OTHER slot it already occupied, so the same
// potion can never occupy two slots at once - the 4-slot cap is about
// choosing 4 *distinct* potions to bring, not filling every slot with the
// same one.
export function setLoadoutSlot(loadout, slotIndex, itemId) {
  const next = loadout.map((slotItemId) => (slotItemId === itemId ? null : slotItemId));
  next[slotIndex] = itemId;
  return next;
}

export function clearLoadoutSlot(loadout, slotIndex) {
  const next = [...loadout];
  next[slotIndex] = null;
  return next;
}

// Which slot(s) (if any) a given item currently occupies - a Potions-tab
// row uses this to light up its own numbered toggle buttons.
export function loadoutSlotsForItem(loadout, itemId) {
  return loadout.reduce((slots, slotItemId, index) => {
    if (slotItemId === itemId) slots.push(index);
    return slots;
  }, []);
}
