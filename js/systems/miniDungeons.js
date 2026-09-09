// Raised 2026-09-05: "the random dungeons offering more gold is so silly...
// let's drop that mechanic for now... leave the plumbing for the future."
// A single flag rather than touching every wilderness map file's own
// miniDungeonChance (js/maps/wilderness/*.js) - flip back to true to
// restore new mini-dungeon discovery exactly as it was. Entrances already
// recorded on an existing save (state.miniDungeons) still work regardless -
// see shouldRevealMiniDungeon below and js/systems/discovery.js's own
// hasMiniDungeonEntrance check, which this flag never touches - this only
// gates *new* ones from being revealed going forward.
export const MINI_DUNGEONS_ENABLED = false;

export const MINI_DUNGEON_CAP_PER_SCREEN = 1;
export const MINI_DUNGEON_VARIANT_IDS = ['miniDungeonA', 'miniDungeonB', 'miniDungeonC', 'miniDungeonD', 'miniDungeonE'];
export const MINI_DUNGEON_TREASURE_ITEM_POOL = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves', 'powerRing', 'luckyCharm',
];

export function hasMiniDungeonEntrance(miniDungeons, screenId, x, y) {
  return Boolean(miniDungeons[screenId] && miniDungeons[screenId][`${x},${y}`]);
}

export function countMiniDungeonEntrances(miniDungeons, screenId) {
  return miniDungeons[screenId] ? Object.keys(miniDungeons[screenId]).length : 0;
}

export function getMiniDungeonEntrance(miniDungeons, screenId, x, y) {
  return miniDungeons[screenId] ? miniDungeons[screenId][`${x},${y}`] : undefined;
}

export function isTreasureTaken(miniDungeons, screenId, x, y) {
  const entrance = getMiniDungeonEntrance(miniDungeons, screenId, x, y);
  return Boolean(entrance && entrance.treasureTaken);
}

export function recordMiniDungeonEntrance(miniDungeons, screenId, x, y, variantId) {
  const key = `${x},${y}`;
  const screenEntrances = { ...(miniDungeons[screenId] || {}), [key]: { variantId, treasureTaken: false } };
  return { ...miniDungeons, [screenId]: screenEntrances };
}

export function markTreasureTaken(miniDungeons, screenId, x, y) {
  const key = `${x},${y}`;
  const existing = miniDungeons[screenId][key];
  const screenEntrances = { ...miniDungeons[screenId], [key]: { ...existing, treasureTaken: true } };
  return { ...miniDungeons, [screenId]: screenEntrances };
}

// isChokepoint(x, y), when supplied, should report whether blocking this
// tile would cut off some other part of the screen with no way around -
// placing a mini-dungeon entrance there would force walking through its
// interior on every single crossing (see js/screens/mapScreen.js's
// screenChokepointCheck for the real implementation). Defaults to "never a
// chokepoint" so callers that don't care about this (e.g. existing tests)
// are unaffected.
//
// Split from shouldRevealMiniDungeon below on purpose: this is the real
// cap/chokepoint/chance logic, fully testable and exercised by
// tests/miniDungeons.test.js regardless of MINI_DUNGEONS_ENABLED, so
// flipping that flag back on later doesn't mean flying blind on whether the
// underlying logic still works - it was never untested, just gated.
export function wouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng = Math.random, isChokepoint = () => false) {
  return !hasMiniDungeonEntrance(miniDungeons, screenId, x, y)
    && countMiniDungeonEntrances(miniDungeons, screenId) < MINI_DUNGEON_CAP_PER_SCREEN
    && rng() < chance
    && !isChokepoint(x, y);
}

// MINI_DUNGEONS_ENABLED is applied on top of wouldRevealMiniDungeon's
// result, not by skipping the call to it - short-circuiting on the flag
// before evaluating wouldRevealMiniDungeon would skip its rng() < chance
// roll entirely while disabled, shifting every rng() call after this one in
// js/systems/discovery.js's own sequence (cache roll, then js/main.js's own
// encounter/elite/species rolls downstream) by one slot. Always calling
// wouldRevealMiniDungeon (and thus always consuming its roll) means
// re-enabling the flag later doesn't change anything about the surrounding
// roll sequence's timing/order.
export function shouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng = Math.random, isChokepoint = () => false) {
  const wouldReveal = wouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng, isChokepoint);
  return wouldReveal && MINI_DUNGEONS_ENABLED;
}

export function pickMiniDungeonVariant(rng = Math.random) {
  return MINI_DUNGEON_VARIANT_IDS[Math.floor(rng() * MINI_DUNGEON_VARIANT_IDS.length)];
}

export function rollMiniDungeonTreasure(rng = Math.random) {
  const gold = 25 + Math.floor(rng() * 26);
  const item = MINI_DUNGEON_TREASURE_ITEM_POOL[Math.floor(rng() * MINI_DUNGEON_TREASURE_ITEM_POOL.length)];
  return { gold, item };
}
