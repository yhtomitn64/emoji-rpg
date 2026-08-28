import { ITEMS } from '../data/items.js';
import { QUALITY_TIER_MULTIPLIERS } from './itemQuality.js';

export const UPGRADE_BASE_COST = 20;
export const MAX_UPGRADE_LEVEL = 3;

const STAT_KEYS = [
  'attack', 'defense', 'maxHp', 'speed', 'enemySlowPercent',
  'lifestealPercent', 'extraSwingChance', 'elementalProcChance', 'elementalProcDamage',
];

function zeroStats() {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
}

export function addGold(state, amount) {
  return { ...state, player: { ...state.player, gold: state.player.gold + amount } };
}

export function spendGold(state, amount) {
  if (state.player.gold < amount) throw new Error('Not enough gold');
  return { ...state, player: { ...state.player, gold: state.player.gold - amount } };
}

export function addItem(state, itemId, quantity = 1, tier) {
  const inventory = state.inventory.map((entry) => ({ ...entry }));
  const existing = inventory.find((entry) => entry.itemId === itemId && entry.tier === tier);
  if (existing) {
    existing.quantity += quantity;
  } else {
    inventory.push({ itemId, quantity, tier });
  }
  return { ...state, inventory };
}

export function removeItem(state, itemId, quantity = 1, tier) {
  const inventory = state.inventory
    .map((entry) => (entry.itemId === itemId && entry.tier === tier ? { ...entry, quantity: entry.quantity - quantity } : entry))
    .filter((entry) => entry.quantity > 0);
  return { ...state, inventory };
}

export function equipItem(state, itemId, slot, tier) {
  const inventoryEntry = state.inventory.find((entry) => entry.itemId === itemId && entry.tier === tier && entry.quantity > 0);
  if (!inventoryEntry) throw new Error(`Item ${itemId} not in inventory`);

  const previouslyEquipped = state.equipment[slot];
  const previousTier = state.equipmentTiers?.[slot];
  let next = removeItem(state, itemId, 1, tier);
  next = {
    ...next,
    equipment: { ...next.equipment, [slot]: itemId },
    equipmentTiers: { ...next.equipmentTiers, [slot]: tier },
  };
  if (previouslyEquipped) {
    next = addItem(next, previouslyEquipped, 1, previousTier);
  }
  return next;
}

export function unequipItem(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);
  const tier = state.equipmentTiers?.[slot];
  let next = {
    ...state,
    equipment: { ...state.equipment, [slot]: null },
    equipmentTiers: { ...state.equipmentTiers, [slot]: undefined },
  };
  next = addItem(next, itemId, 1, tier);
  return next;
}

export function applyHeal(hp, maxHp, amount) {
  return Math.min(maxHp, hp + amount);
}

export function sellPrice(price) {
  return Math.floor(price / 2);
}

export function maxAffordableQuantity(gold, price, requested) {
  if (price <= 0) return requested;
  return Math.min(requested, Math.floor(gold / price));
}

export function describeItem(itemId, tier) {
  const item = ITEMS[itemId];
  if (item.description) return `${item.name}: ${item.description}`;
  if (item.stats) {
    const tierMultiplier = tier ? QUALITY_TIER_MULTIPLIERS[tier] : 1;
    const statsText = Object.entries(item.stats)
      .map(([stat, value]) => `${stat} +${Math.round(value * tierMultiplier)}`)
      .join(', ');
    if (statsText) return `${item.name}: ${statsText}`;
  }
  if (item.heal) return `${item.name}: heals ${item.heal} HP`;
  if (item.upgradeSlot) return `${item.name}: upgrade material for ${item.upgradeSlot} gear`;
  return item.name;
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

export function getItemEffectiveStats(itemId, upgradeLevel = 0, tier) {
  const item = ITEMS[itemId];
  const stats = zeroStats();
  const tierMultiplier = tier ? QUALITY_TIER_MULTIPLIERS[tier] : 1;
  for (const stat of STAT_KEYS) {
    const base = (item.stats?.[stat] || 0) * tierMultiplier;
    stats[stat] = base + base * 0.25 * upgradeLevel;
  }
  return stats;
}

export function getEquipmentBonuses(state) {
  const bonuses = zeroStats();
  for (const slot of Object.keys(state.equipment)) {
    const itemId = state.equipment[slot];
    if (!itemId) continue;
    const upgradeLevel = state.upgrades?.[itemId] || 0;
    const tier = state.equipmentTiers?.[slot];
    const itemStats = getItemEffectiveStats(itemId, upgradeLevel, tier);
    for (const stat of STAT_KEYS) {
      bonuses[stat] += itemStats[stat];
    }
  }
  // Upgrade/tier scaling is fractional for most items; round each total once
  // so callers only ever see integer stats (HUD, battle, saved HP).
  for (const stat of STAT_KEYS) {
    bonuses[stat] = Math.round(bonuses[stat]);
  }
  return bonuses;
}

export function getItemStatDelta(state, itemId, tier) {
  const item = ITEMS[itemId];
  const currentItemId = state.equipment[item.slot];
  const currentUpgrade = currentItemId ? (state.upgrades?.[currentItemId] || 0) : 0;
  const currentTier = currentItemId ? state.equipmentTiers?.[item.slot] : undefined;
  const newUpgrade = state.upgrades?.[itemId] || 0;
  const currentStats = currentItemId
    ? getItemEffectiveStats(currentItemId, currentUpgrade, currentTier)
    : zeroStats();
  const newStats = getItemEffectiveStats(itemId, newUpgrade, tier);
  const delta = {};
  for (const stat of Object.keys(newStats)) {
    delta[stat] = Math.round(newStats[stat] - currentStats[stat]);
  }
  return delta;
}
