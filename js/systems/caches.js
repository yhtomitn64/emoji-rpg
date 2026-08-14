export const CACHE_CAP_PER_SCREEN = 3;
export const CACHE_ITEM_CHANCE = 0.3;
export const CACHE_ITEM_POOL = [
  'potion', 'leatherScrap', 'batWing', 'snakeFang', 'ironScrap', 'wolfPelt', 'spiderSilk', 'orcTusk', 'wraithEssence',
];

export function hasCache(caches, screenId, x, y) {
  return Boolean(caches[screenId] && caches[screenId][`${x},${y}`]);
}

export function countCaches(caches, screenId) {
  return caches[screenId] ? Object.keys(caches[screenId]).length : 0;
}

export function recordCache(caches, screenId, x, y) {
  const key = `${x},${y}`;
  const screenCaches = { ...(caches[screenId] || {}), [key]: true };
  return { ...caches, [screenId]: screenCaches };
}

export function shouldRevealCache(caches, screenId, x, y, cacheChance, rng = Math.random) {
  return !hasCache(caches, screenId, x, y)
    && countCaches(caches, screenId) < CACHE_CAP_PER_SCREEN
    && rng() < cacheChance;
}

export function rollCacheLoot(rng = Math.random) {
  const gold = 5 + Math.floor(rng() * 11);
  let item = null;
  if (rng() < CACHE_ITEM_CHANCE) {
    item = CACHE_ITEM_POOL[Math.floor(rng() * CACHE_ITEM_POOL.length)];
  }
  return { gold, item };
}
