import { ITEMS } from '../data/items.js';
import { QUALITY_TIER_MULTIPLIERS } from './itemQuality.js';

export const UPGRADE_BASE_COST = 20;
export const MAX_UPGRADE_LEVEL = 3;

const STAT_KEYS = [
  'attack', 'defense', 'maxHp', 'speed', 'enemySlowPercent',
  'lifestealPercent', 'extraSwingChance', 'elementalProcChance', 'elementalProcDamage',
  'critChancePercent', 'thornsPercent',
];

function zeroStats() {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
}

// Raised 2026-08-31 (Rung-3 gear cleanup follow-up): formatDelta used to be
// duplicated identically in inventoryScreen.js and shopScreen.js, printing
// raw camelCase stat keys straight into the UI once an effect stat was
// nonzero (e.g. "lifestealPercent +15"). One shared label map fixes the
// display and the duplication in the same move - also reused by
// describeItem below, which had the same underlying bug for any
// unique-effect item's tooltip.
export const STAT_LABELS = {
  attack: 'Attack',
  defense: 'Defense',
  maxHp: 'Max HP',
  speed: 'Speed',
  enemySlowPercent: 'Enemy Slow %',
  lifestealPercent: 'Lifesteal %',
  extraSwingChance: 'Extra Swing Chance %',
  elementalProcChance: 'Elemental Proc Chance %',
  elementalProcDamage: 'Elemental Proc Damage',
  critChancePercent: 'Crit Chance %',
  thornsPercent: 'Thorns %',
};

export function formatStatDelta(delta) {
  return Object.entries(delta)
    .filter(([, value]) => value !== 0)
    .map(([stat, value]) => `${STAT_LABELS[stat] || stat} ${value > 0 ? '+' : ''}${value}`)
    .join(', ');
}

// Raised 2026-08-29: state.upgrades used to be keyed by bare itemId, so a
// Fine/Superior copy of an item silently inherited whatever smith-upgrade
// level a Plain (or any) copy had already reached - equipping a freshly
// found Fine Iron Helm showed it already maxed. Keying on itemId+tier
// instead gives every tier its own independent upgrade level.
export function upgradeKey(itemId, tier) {
  return `${itemId}:${tier || 'plain'}`;
}

export function getUpgradeLevel(state, itemId, tier) {
  return state.upgrades?.[upgradeKey(itemId, tier)] || 0;
}

// One-time migration for saves from before the itemId+tier key split above.
// Best-effort: if the item is currently equipped, its legacy level migrates
// to that slot's real tier (the tier the player has actually been
// experiencing); anything else defaults to Plain, since that was always the
// only tier that existed before quality tiers shipped. Idempotent - an
// already-migrated save has no bare keys left to find.
export function migrateUpgradesToPerTier(state) {
  const legacyKeys = Object.keys(state.upgrades || {}).filter((key) => !key.includes(':'));
  if (legacyKeys.length === 0) return state;
  const upgrades = { ...state.upgrades };
  for (const itemId of legacyKeys) {
    const level = upgrades[itemId];
    const equippedSlot = Object.keys(state.equipment).find((slot) => state.equipment[slot] === itemId);
    const tier = equippedSlot ? state.equipmentTiers?.[equippedSlot] : undefined;
    const key = upgradeKey(itemId, tier);
    if (upgrades[key] === undefined) upgrades[key] = level;
    delete upgrades[itemId];
  }
  return { ...state, upgrades };
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

// Rings are a slot *type* ('ring' on the item), not a physical equipment
// key - this resolves which of the two physical slots (ring1/ring2) an
// equip action should target. Returns null when both are already occupied,
// which callers (inventoryScreen.js) use to offer an explicit choice
// instead of guessing which ring to replace.
export function resolveRingEquipSlot(state) {
  if (!state.equipment.ring1) return 'ring1';
  if (!state.equipment.ring2) return 'ring2';
  return null;
}

// Resolves an item's slot *type* (item.slot) to the physical equipment key
// to compare against. Non-ring items pass through unchanged (item.slot IS
// already the physical key for those). Ring items resolve via
// resolveRingEquipSlot - when both rings are already occupied (null
// returned), falls back to comparing against ring1 specifically, so the
// comparison is always well-defined rather than silently comparing against
// nothing.
export function resolvePhysicalSlot(state, item) {
  if (item.slot !== 'ring') return item.slot;
  return resolveRingEquipSlot(state) ?? 'ring1';
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

// Raised 2026-08-29: "add a sell duplicates button... auto sells all your
// dupes to clean up INV." Equipping an item already removes its one copy
// from state.inventory (see equipItem above), so a gear entry's quantity
// can only ever be >1 here from owning multiple *unequipped* copies of the
// exact same itemId+tier - the first copy isn't a duplicate, so this keeps
// one and sells the rest at half price, same as a normal shop sale.
// Deliberately gear-only (`ITEMS[entry.itemId].slot` is only set on
// equippable items) - materials/potions are meant to stack past 1, that's
// not a "duplicate" in the same sense, and materials have no price/sell
// path at all yet (see the still-open "sell unneeded crafting materials"
// backlog item).
export function sellDuplicateGear(state) {
  let next = state;
  let soldCount = 0;
  let goldEarned = 0;
  for (const entry of state.inventory) {
    const item = ITEMS[entry.itemId];
    if (!item.slot || entry.quantity <= 1) continue;
    const excess = entry.quantity - 1;
    const earned = sellPrice(item.price) * excess;
    next = removeItem(next, entry.itemId, excess, entry.tier);
    next = addGold(next, earned);
    soldCount += excess;
    goldEarned += earned;
  }
  return { state: next, soldCount, goldEarned };
}

export function maxAffordableQuantity(gold, price, requested) {
  if (price <= 0) return requested;
  return Math.min(requested, Math.floor(gold / price));
}

// Takes state (not just tier) so the tooltip can factor in the item's own
// smith-upgrade level, not just its tier - see the "describeItem factors in
// the item's own smith-upgrade level" test for the bug this used to be.
export function describeItem(state, itemId, tier) {
  const item = ITEMS[itemId];
  if (item.description) return `${item.name}: ${item.description}`;
  if (item.stats) {
    const upgradeLevel = getUpgradeLevel(state, itemId, tier);
    const effectiveStats = getItemEffectiveStats(itemId, upgradeLevel, tier);
    const statsText = Object.keys(item.stats)
      .map((stat) => `${STAT_LABELS[stat] || stat} +${Math.round(effectiveStats[stat])}`)
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
  const tier = state.equipmentTiers?.[slot];

  if (getUpgradeLevel(state, itemId, tier) >= MAX_UPGRADE_LEVEL) throw new Error(`${itemId} is already at max upgrade level`);

  if (ITEMS[materialId].upgradeSlot !== slot) throw new Error(`${materialId} cannot upgrade the ${slot} slot`);

  const hasMaterial = state.inventory.some((entry) => entry.itemId === materialId && entry.quantity > 0);
  if (!hasMaterial) throw new Error('Missing required material');
  if (state.player.gold < cost) throw new Error('Not enough gold');

  let next = spendGold(state, cost);
  next = removeItem(next, materialId, 1);
  const upgradeLevel = getUpgradeLevel(next, itemId, tier) + 1;
  next = { ...next, upgrades: { ...next.upgrades, [upgradeKey(itemId, tier)]: upgradeLevel } };
  return next;
}

// Reforge: Superior -> Mythic, gold + Mythic Essence, gated to NG+ by the
// caller (smithScreen.js only shows this once ngPlusCycle >= 1). Starting
// numbers, not final balance - see the design spec.
export const REFORGE_GOLD_COST = 400;
export const REFORGE_ESSENCE_COST = 3;

export function canReforgeToMythic(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) return false;
  return state.equipmentTiers?.[slot] === 'superior';
}

// Carries the item's current (Superior-tier) upgrade level over to its new
// Mythic-tier key, rather than resetting to 0 - it's the same physical
// item being reforged, not a fresh copy, so losing smith-upgrade progress
// on reforge would make this a straight downgrade until re-upgraded.
export function reforgeToMythic(state, slot) {
  const itemId = state.equipment[slot];
  if (!itemId) throw new Error(`No item equipped in slot ${slot}`);
  const tier = state.equipmentTiers?.[slot];
  if (tier !== 'superior') throw new Error(`${itemId} must be Superior tier to reforge`);

  const essenceCount = state.inventory.find((entry) => entry.itemId === 'mythicEssence')?.quantity || 0;
  if (essenceCount < REFORGE_ESSENCE_COST) throw new Error('Not enough Mythic Essence');
  if (state.player.gold < REFORGE_GOLD_COST) throw new Error('Not enough gold');

  let next = spendGold(state, REFORGE_GOLD_COST);
  next = removeItem(next, 'mythicEssence', REFORGE_ESSENCE_COST);
  const carriedUpgradeLevel = getUpgradeLevel(next, itemId, tier);
  next = {
    ...next,
    equipmentTiers: { ...next.equipmentTiers, [slot]: 'mythic' },
    upgrades: { ...next.upgrades, [upgradeKey(itemId, 'mythic')]: carriedUpgradeLevel },
  };
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
    const tier = state.equipmentTiers?.[slot];
    const upgradeLevel = getUpgradeLevel(state, itemId, tier);
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
  const physicalSlot = resolvePhysicalSlot(state, item);
  const currentItemId = state.equipment[physicalSlot];
  const currentTier = currentItemId ? state.equipmentTiers?.[physicalSlot] : undefined;
  const currentUpgrade = currentItemId ? getUpgradeLevel(state, currentItemId, currentTier) : 0;
  const newUpgrade = getUpgradeLevel(state, itemId, tier);
  const currentStats = currentItemId
    ? getItemEffectiveStats(currentItemId, currentUpgrade, currentTier)
    : zeroStats();
  const newStats = getItemEffectiveStats(itemId, newUpgrade, tier);
  const delta = {};
  // Rounds each side before subtracting (not the raw difference) so two
  // candidates whose real stats differ - e.g. a Plain and Fine copy of the
  // same base item - can never collide onto the same displayed delta just
  // because their unrounded gap was smaller than the rounding granularity.
  for (const stat of Object.keys(newStats)) {
    delta[stat] = Math.round(newStats[stat]) - Math.round(currentStats[stat]);
  }
  return delta;
}
