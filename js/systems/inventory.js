import { ITEMS } from '../data/items.js';

export const UPGRADE_BASE_COST = 20;
export const MAX_UPGRADE_LEVEL = 3;

export function addGold(state, amount) {
  return { ...state, player: { ...state.player, gold: state.player.gold + amount } };
}

export function spendGold(state, amount) {
  if (state.player.gold < amount) throw new Error('Not enough gold');
  return { ...state, player: { ...state.player, gold: state.player.gold - amount } };
}

export function addItem(state, itemId, quantity = 1) {
  const inventory = state.inventory.map((entry) => ({ ...entry }));
  const existing = inventory.find((entry) => entry.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    inventory.push({ itemId, quantity });
  }
  return { ...state, inventory };
}

export function removeItem(state, itemId, quantity = 1) {
  const inventory = state.inventory
    .map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity - quantity } : entry))
    .filter((entry) => entry.quantity > 0);
  return { ...state, inventory };
}

export function equipItem(state, itemId, slot) {
  const inventoryEntry = state.inventory.find((entry) => entry.itemId === itemId && entry.quantity > 0);
  if (!inventoryEntry) throw new Error(`Item ${itemId} not in inventory`);

  const previouslyEquipped = state.equipment[slot];
  let next = removeItem(state, itemId, 1);
  next = { ...next, equipment: { ...next.equipment, [slot]: itemId } };
  if (previouslyEquipped) {
    next = addItem(next, previouslyEquipped, 1);
  }
  return next;
}

export function unequipItem(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);
  let next = { ...state, equipment: { ...state.equipment, [slot]: null } };
  next = addItem(next, itemId, 1);
  return next;
}

export function upgradeCost(currentLevel) {
  return UPGRADE_BASE_COST * (currentLevel + 1);
}

export function upgradeItem(state, slot, materialId, cost) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);

  if ((state.upgrades?.[itemId] || 0) >= MAX_UPGRADE_LEVEL) throw new Error(`${itemId} is already at max upgrade level`);

  if (ITEMS[materialId].upgradeSlot !== slot) throw new Error(`${materialId} cannot upgrade the ${slot} slot`);

  const hasMaterial = state.inventory.some((entry) => entry.itemId === materialId && entry.quantity > 0);
  if (!hasMaterial) throw new Error('Missing required material');
  if (state.player.gold < cost) throw new Error('Not enough gold');

  let next = spendGold(state, cost);
  next = removeItem(next, materialId, 1);
  const upgradeLevel = (next.upgrades?.[itemId] || 0) + 1;
  next = { ...next, upgrades: { ...next.upgrades, [itemId]: upgradeLevel } };
  return next;
}

export function getItemEffectiveStats(itemId, upgradeLevel = 0) {
  const item = ITEMS[itemId];
  const stats = { attack: 0, defense: 0, maxHp: 0, speed: 0 };
  for (const stat of Object.keys(stats)) {
    const base = item.stats?.[stat] || 0;
    stats[stat] = base + base * 0.25 * upgradeLevel;
  }
  return stats;
}

export function getEquipmentBonuses(state) {
  const bonuses = { attack: 0, defense: 0, maxHp: 0, speed: 0 };
  for (const slot of Object.keys(state.equipment)) {
    const itemId = state.equipment[slot];
    if (!itemId) continue;
    const upgradeLevel = state.upgrades?.[itemId] || 0;
    const itemStats = getItemEffectiveStats(itemId, upgradeLevel);
    for (const stat of Object.keys(bonuses)) {
      bonuses[stat] += itemStats[stat];
    }
  }
  // Upgrade scaling (0.25/level) is fractional for most items; round each total
  // once so callers only ever see integer stats (HUD, battle, saved HP).
  for (const stat of Object.keys(bonuses)) {
    bonuses[stat] = Math.round(bonuses[stat]);
  }
  return bonuses;
}

export function getItemStatDelta(state, itemId) {
  const item = ITEMS[itemId];
  const currentItemId = state.equipment[item.slot];
  const currentUpgrade = currentItemId ? (state.upgrades?.[currentItemId] || 0) : 0;
  const newUpgrade = state.upgrades?.[itemId] || 0;
  const currentStats = currentItemId
    ? getItemEffectiveStats(currentItemId, currentUpgrade)
    : { attack: 0, defense: 0, maxHp: 0, speed: 0 };
  const newStats = getItemEffectiveStats(itemId, newUpgrade);
  const delta = {};
  for (const stat of Object.keys(newStats)) {
    delta[stat] = Math.round(newStats[stat] - currentStats[stat]);
  }
  return delta;
}
