import { ITEMS } from '../data/items.js';

// One-shot potions (guaranteed-crit, Second Wind) apply once and clear a
// flag rather than running on a duration - see js/screens/battleScreen.js's
// consumeGuaranteedCritBonus() and the Second Wind check inside
// monsterAttack(). Timed buffs (the other 8) all set `buffDurationMs` on
// their ITEMS entry and use their own `stats` as the bonus - same shape
// and source of truth as equipped gear (js/systems/inventory.js's
// getEquipmentBonuses). See docs/superpowers/specs/2026-08-31-buff-
// potions-design.md.
export const ONE_SHOT_POTION_IDS = ['berserkerTonic', 'secondWind'];

export function isTimedBuffPotion(itemId) {
  const item = ITEMS[itemId];
  return !!item && item.type === 'consumable' && !!item.buffDurationMs;
}

export function createActiveBuffs() {
  return [];
}

// Drinking a potion whose buff is already active refreshes its duration
// instead of stacking a second copy of the same stat bonus - stacking is
// for *different* potion types running together (e.g. Strength Draught +
// Swift Elixir), not multiple charges of the same one.
export function activateTimedBuff(activeBuffs, itemId) {
  const withoutExisting = activeBuffs.filter((buff) => buff.itemId !== itemId);
  return [...withoutExisting, { itemId, remainingMs: ITEMS[itemId].buffDurationMs }];
}

export function tickActiveBuffs(activeBuffs, dt) {
  return activeBuffs
    .map((buff) => ({ ...buff, remainingMs: Math.max(0, buff.remainingMs - dt) }))
    .filter((buff) => buff.remainingMs > 0);
}

// Sums every active buff's own `stats` (its ITEMS entry) into one bonus
// object - same shape as getEquipmentBonuses' return value, so it can be
// added directly onto it (see combineBonuses).
export function getActiveBuffBonuses(activeBuffs) {
  const bonuses = {};
  for (const buff of activeBuffs) {
    const stats = ITEMS[buff.itemId].stats || {};
    for (const [stat, value] of Object.entries(stats)) {
      bonuses[stat] = (bonuses[stat] || 0) + value;
    }
  }
  return bonuses;
}

// Adds `extra`'s stats on top of `base` (a full STAT_KEYS-shaped object,
// e.g. the equipment-only bonuses from getEquipmentBonuses) - only base's
// own keys are read, so `extra` doesn't need to carry every key.
export function combineBonuses(base, extra) {
  const combined = { ...base };
  for (const stat of Object.keys(base)) {
    combined[stat] += extra[stat] || 0;
  }
  return combined;
}
