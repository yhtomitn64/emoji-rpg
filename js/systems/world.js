import { TILES } from '../tiles.js';

// Deterministic per-tile pick, not Math.random() - the same (x, y) must always
// render the same variant, or it'd flicker/change on every re-render as the
// player moves around instead of looking like a stable, varied map. A plain
// linear combination of x/y (e.g. x*31 + y*17) produces visible diagonal
// stripes across the grid instead of natural-looking scatter, so this mixes
// the bits (xxhash-style) before reducing to an index.
export function pickTileVariant(tile, x, y) {
  if (!tile.variants || tile.variants.length === 0) return tile.emoji;
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  const index = Math.abs(h) % tile.variants.length;
  return tile.variants[index];
}

// Same deterministic bit-mixing as pickTileVariant above, reduced to a
// stable float in [0, 1) instead of an array index - used wherever a tile
// needs its own random-but-stable value (e.g. obstacle size in
// js/screens/mapScreen.js) rather than picking from a fixed list.
export function hash01(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (Math.abs(h) % 1000) / 1000;
}

export function isWalkableAt(map, x, y) {
  const row = map.rows[y];
  if (!row) return false;
  const char = row[x];
  if (!char) return false;
  const tile = TILES[map.legend[char]];
  return Boolean(tile && tile.walkable);
}

export function isValidSavedPosition(map, x, y) {
  const row = map.rows[y];
  if (!row) return false;
  const char = row[x];
  if (!char) return false;
  const tile = TILES[map.legend[char]];
  return Boolean(tile && (tile.walkable || tile.requiresTool));
}

export function directionFromDelta(dx, dy) {
  if (dx === 1) return 'east';
  if (dx === -1) return 'west';
  if (dy === 1) return 'south';
  if (dy === -1) return 'north';
  return null;
}

export function computeEdgeLandingPosition(direction, currentPosition, neighborMap) {
  if (direction === 'east') return { x: 0, y: currentPosition.y };
  if (direction === 'west') return { x: neighborMap.rows[0].length - 1, y: currentPosition.y };
  if (direction === 'south') return { x: currentPosition.x, y: 0 };
  return { x: currentPosition.x, y: neighborMap.rows.length - 1 };
}
