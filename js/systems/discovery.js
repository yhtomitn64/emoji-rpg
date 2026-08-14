import { hasMiniDungeonEntrance, shouldRevealMiniDungeon, pickMiniDungeonVariant, recordMiniDungeonEntrance } from './miniDungeons.js';
import { shouldRevealCache, recordCache, rollCacheLoot } from './caches.js';

export function resolveStepDiscovery(state, mapConfig, x, y, tile, rng = Math.random) {
  if (!tile.encounter) {
    return { outcome: 'none' };
  }
  if (hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, x, y)) {
    return { outcome: 'enterMiniDungeon' };
  }
  if (shouldRevealMiniDungeon(state.miniDungeons, mapConfig.id, x, y, mapConfig.miniDungeonChance, rng)) {
    const variantId = pickMiniDungeonVariant(rng);
    return {
      outcome: 'enterMiniDungeon',
      miniDungeons: recordMiniDungeonEntrance(state.miniDungeons, mapConfig.id, x, y, variantId),
    };
  }
  if (shouldRevealCache(state.caches, mapConfig.id, x, y, mapConfig.cacheChance, rng)) {
    return {
      outcome: 'cache',
      caches: recordCache(state.caches, mapConfig.id, x, y),
      cacheLoot: rollCacheLoot(rng),
    };
  }
  return { outcome: 'none' };
}
