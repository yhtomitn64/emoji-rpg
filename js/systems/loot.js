import { MONSTERS } from '../data/monsters.js';
import { ITEMS, SHOP_CATALOG } from '../data/items.js';
import { MINI_DUNGEON_TREASURE_ITEM_POOL } from './miniDungeons.js';
import {
  isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance,
  rollMythicEssenceChance, RING_TOUGHNESS_FLOOR, BOSS_MYTHIC_CHANCE,
} from './itemQuality.js';

export const EQUIPMENT_DROP_CHANCE = 0.10; // flat - toughness already drives
  // *quality* within this roll; scaling the gate too would double-compound
  // the reward for fighting tougher monsters.
export const EQUIPMENT_DROP_POOL = SHOP_CATALOG.filter((id) => ITEMS[id].slot);
export const UNIQUE_EFFECT_ITEM_IDS = ['vampiricFang', 'swiftStrikeCharm', 'emberRing', 'keenEye', 'retributionCharm', 'windfuryRing'];

export const POTION_DROP_CHANCE = 0.08;
// Repeated entries weight the pick toward the cheaper timed buffs and
// rarer for the two pricier one-shots.
export const POTION_DROP_POOL = [
  'strengthDraught', 'strengthDraught', 'strengthDraught',
  'ironSkinTonic', 'ironSkinTonic', 'ironSkinTonic',
  'swiftElixir', 'swiftElixir', 'swiftElixir',
  'vampiricTonic', 'vampiricTonic', 'vampiricTonic',
  'momentumElixir', 'momentumElixir',
  'emberVial', 'emberVial',
  'thornbarkDraught', 'thornbarkDraught',
  'focusTonic', 'focusTonic',
  'berserkerTonic',
  'secondWind',
];

function pickRandom(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
}

// vampiricFang/swiftStrikeCharm/keenEye are never filtered out (no
// ngPlusOnly flag, not a ring slot) - this invariant is what guarantees the
// pool below is never empty, at any toughness/cycle combination.
function eligibleUniqueEffectPool(toughness, ngPlusCycle) {
  return UNIQUE_EFFECT_ITEM_IDS.filter((id) => {
    const item = ITEMS[id];
    if (item.ngPlusOnly && ngPlusCycle < 1) return false;
    if (item.slot === 'ring' && toughness < RING_TOUGHNESS_FLOOR) return false;
    return true;
  });
}

export function getItemSources(itemId) {
  const sources = [];
  if (ITEMS[itemId].startingItem) sources.push('Starting gear');
  for (const monster of Object.values(MONSTERS)) {
    if ((monster.dropTable || []).some((entry) => entry.itemId === itemId)) {
      sources.push(`Dropped by ${monster.name}`);
    }
  }
  if (SHOP_CATALOG.includes(itemId)) sources.push('Available in the shop');
  if (MINI_DUNGEON_TREASURE_ITEM_POOL.includes(itemId)) sources.push('Mini-dungeon treasure');
  if (itemId === 'mythicEssence') sources.push('Rare NG+ monster-kill drop');
  else if (UNIQUE_EFFECT_ITEM_IDS.includes(itemId)) sources.push('Rare monster-kill drop');
  else if (EQUIPMENT_DROP_POOL.includes(itemId)) sources.push('Found on monster kills');
  return sources;
}

export function rollDrop(monster, rng = Math.random, ngPlusCycle = 0) {
  const [minGold, maxGold] = monster.goldRange;
  const gold = minGold + Math.floor(rng() * (maxGold - minGold + 1));

  let item = null;
  let tier;
  // Boss/elite/forceFullBattle monsters keep their own separate, already-
  // guaranteed-exciting drop mechanisms untouched - excluded from every
  // roll below, so an existing named drop like the dragon's dragonFang
  // never picks up a stray tier roll either.
  const eligible = isToughnessEligible(monster);
  const toughness = eligible ? monsterToughness(monster) : 0;

  // Mythic Essence gets first dibs on the "at most one bonus item per kill"
  // slot, but only once ngPlusCycle >= 1 - the short-circuit on that check
  // means zero extra rng() calls at cycle 0, so every pre-NG+ test/player
  // sees identical behavior to before this feature existed.
  if (eligible) {
    if (ngPlusCycle >= 1 && rollMythicEssenceChance(toughness, rng)) {
      item = 'mythicEssence';
    } else if (rollUniqueEffectChance(toughness, rng)) {
      item = pickRandom(eligibleUniqueEffectPool(toughness, ngPlusCycle), rng);
    } else if (rng() < EQUIPMENT_DROP_CHANCE) {
      item = pickRandom(EQUIPMENT_DROP_POOL, rng);
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    }
  }

  if (!item && monster.dropTable && monster.dropTable.length > 0) {
    const roll = rng();
    let cumulative = 0;
    for (const entry of monster.dropTable) {
      cumulative += entry.chance;
      if (roll < cumulative) {
        item = entry.itemId;
        break;
      }
    }
    // An existing named equipment drop (e.g. goblinClub) can still be a
    // better-than-plain copy of itself, but never redirects into an
    // unrelated Unique-effect item - the named drop IS that item.
    if (item && eligible && ITEMS[item].slot) {
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    }
    // Bosses are excluded from the toughness-weighted roll above
    // (isToughnessEligible is false for isBoss), so their named drops never
    // get a tier there - this is the separate mechanism that lets a dragon
    // kill's dragonFang/dragonScaleMail become Mythic in NG+.
    if (item && monster.isBoss && ngPlusCycle >= 1 && ITEMS[item].slot && rng() < BOSS_MYTHIC_CHANCE) {
      tier = 'mythic';
    }
  }

  // Independent of the item/tier roll above (not competing for the "one
  // bonus item per kill" slot) - a kill can grant both a regular item AND
  // a potion in the same roll.
  let potionId = null;
  if (rng() < POTION_DROP_CHANCE) {
    potionId = pickRandom(POTION_DROP_POOL, rng);
  }

  return { gold, item, tier, potionId };
}
