import { MONSTERS } from '../data/monsters.js';
import { ITEMS, SHOP_CATALOG } from '../data/items.js';
import { MINI_DUNGEON_TREASURE_ITEM_POOL } from './miniDungeons.js';
import {
  isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance,
  rollMythicEssenceChance, RING_TOUGHNESS_FLOOR,
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
  // Boss/elite/forceFullBattle monsters still keep their own separate,
  // already-guaranteed-exciting drop *mechanisms* untouched (no bonus
  // Unique-effect/generic-equipment roll layered on top below) - but their
  // named drop's *quality tier* is no longer excluded (see the named-drop
  // block below). toughness is computed unconditionally now: monsterToughness
  // just clamps against the regular roster's xp range, so a boss/elite's
  // way-above-range xp (dragon: 200 vs. a top eligible xp of 63) safely
  // clamps to the toughest tier odds, same as the hardest regular monster -
  // no special-casing needed.
  const eligible = isToughnessEligible(monster);
  const toughness = monsterToughness(monster);

  // Mythic Essence gets first dibs on the "at most one bonus item per kill"
  // slot, but only once ngPlusCycle >= 1 - the short-circuit on that check
  // means zero extra rng() calls at cycle 0, so every pre-NG+ test/player
  // sees identical behavior to before this feature existed.
  if (eligible) {
    if (ngPlusCycle >= 1 && rollMythicEssenceChance(toughness, rng)) {
      item = 'mythicEssence';
    } else if (rollUniqueEffectChance(toughness, rng)) {
      // Raised 2026-09-10: Unique-effect items used to never roll a tier at
      // all ("uniques aren't tiered - they ARE the rare tier", the original
      // design's own words) - but once the Superior -> Mythic reforge system
      // landed, that meant a Unique-effect item could never be reforged,
      // permanently missing the tier multiplier a plain Iron Sword could
      // reach via reforge. Folding uniques into the same roll closes that
      // gap with no new mechanism.
      item = pickRandom(eligibleUniqueEffectPool(toughness, ngPlusCycle), rng);
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    } else if (rng() < EQUIPMENT_DROP_CHANCE) {
      item = pickRandom(EQUIPMENT_DROP_POOL, rng);
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    }
  }

  if (!item && monster.dropTable && monster.dropTable.length > 0) {
    const roll = rng();
    let cumulative = 0;
    let matchedEntry = null;
    for (const entry of monster.dropTable) {
      cumulative += entry.chance;
      if (roll < cumulative) {
        item = entry.itemId;
        matchedEntry = entry;
        break;
      }
    }
    // An existing named equipment drop (e.g. goblinClub, or a boss's own
    // dragonFang/dragonScaleMail) can still be a better-than-plain copy of
    // itself, but never redirects into an unrelated Unique-effect item -
    // the named drop IS that item. Raised 2026-09-10: this used to be
    // gated on `eligible`, which excluded boss/elite named drops from ever
    // getting a tier at all (they had their own separate, much narrower
    // mechanism below - now removed). A named drop's tier no longer
    // depends on whether its monster gets the *bonus* rolls above; those
    // stay eligible-gated on purpose (a boss shouldn't also roll a random
    // second item on top of its own guaranteed drop table), but the
    // *tier* of the drop it already has is a different question.
    if (item && ITEMS[item].slot) {
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    }
    // A dropTable entry can name its own guaranteed tier directly (e.g. a
    // superboss's chance:1 drop at tier: 'apex') - bypasses the random
    // roll above entirely (overwriting whatever it produced), since a
    // guaranteed drop should never randomly land below its intended floor.
    if (item && matchedEntry.tier) {
      tier = matchedEntry.tier;
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
