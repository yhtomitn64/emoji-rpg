import { MONSTERS } from '../data/monsters.js';
import { ITEMS, SHOP_CATALOG } from '../data/items.js';
import { MINI_DUNGEON_TREASURE_ITEM_POOL } from './miniDungeons.js';
import { isToughnessEligible, monsterToughness, rollQualityTier, rollUniqueEffectChance } from './itemQuality.js';

export const EQUIPMENT_DROP_CHANCE = 0.10; // flat - toughness already drives
  // *quality* within this roll; scaling the gate too would double-compound
  // the reward for fighting tougher monsters.
export const EQUIPMENT_DROP_POOL = SHOP_CATALOG.filter((id) => ITEMS[id].slot);
export const UNIQUE_EFFECT_ITEM_IDS = ['vampiricFang', 'swiftStrikeCharm', 'emberRing', 'keenEye'];

function pickRandom(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
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
  if (UNIQUE_EFFECT_ITEM_IDS.includes(itemId)) sources.push('Rare monster-kill drop');
  else if (EQUIPMENT_DROP_POOL.includes(itemId)) sources.push('Found on monster kills');
  return sources;
}

export function rollDrop(monster, rng = Math.random) {
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

  // These toughness-weighted rolls run BEFORE the monster's own dropTable
  // roll (not after) so NG+'s scaleDropTable rescaling - which can boost a
  // dropTable's chances up to a full 100% at high cycles - can never starve
  // these rolls to 0%. Still at most one bonus item per kill: the
  // dropTable is only consulted if both of these miss.
  if (eligible) {
    if (rollUniqueEffectChance(toughness, rng)) {
      item = pickRandom(UNIQUE_EFFECT_ITEM_IDS, rng);
    } else if (rng() < EQUIPMENT_DROP_CHANCE) {
      item = pickRandom(EQUIPMENT_DROP_POOL, rng);
      const quality = rollQualityTier(toughness, rng);
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
      const quality = rollQualityTier(toughness, rng);
      if (quality !== 'plain') tier = quality;
    }
  }

  return { gold, item, tier };
}
