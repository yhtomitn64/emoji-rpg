export const MINI_DUNGEON_CAP_PER_SCREEN = 1;
export const MINI_DUNGEON_VARIANT_IDS = ['miniDungeonA', 'miniDungeonB', 'miniDungeonC'];
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

export function shouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng = Math.random) {
  return !hasMiniDungeonEntrance(miniDungeons, screenId, x, y)
    && countMiniDungeonEntrances(miniDungeons, screenId) < MINI_DUNGEON_CAP_PER_SCREEN
    && rng() < chance;
}

export function pickMiniDungeonVariant(rng = Math.random) {
  return MINI_DUNGEON_VARIANT_IDS[Math.floor(rng() * MINI_DUNGEON_VARIANT_IDS.length)];
}

export function rollMiniDungeonTreasure(rng = Math.random) {
  const gold = 25 + Math.floor(rng() * 26);
  const item = MINI_DUNGEON_TREASURE_ITEM_POOL[Math.floor(rng() * MINI_DUNGEON_TREASURE_ITEM_POOL.length)];
  return { gold, item };
}
