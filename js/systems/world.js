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

const CARDINAL_DELTAS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Whether blocking (x, y) would cut the screen's passable area into pieces
// with no way around - the standard articulation-point test, restricted to
// this one candidate tile. isPassable(x, y) reflects live game state (e.g.
// a tool-gated tile counts as passable once the player owns that tool), not
// just raw tile data, so "is there a way around it" always means "can the
// player currently go around it." Pure and DOM-free so it's directly unit
// testable - see js/screens/mapScreen.js's isScreenChokepoint for the real
// caller, which supplies isPassable from live map/inventory state.
export function isChokepointTile(width, height, x, y, isPassable) {
  const inBounds = (px, py) => px >= 0 && px < width && py >= 0 && py < height;
  const neighbors = CARDINAL_DELTAS
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((p) => inBounds(p.x, p.y) && isPassable(p.x, p.y));
  if (neighbors.length < 2) return false;
  const [start, ...rest] = neighbors;
  const reached = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const [dx, dy] of CARDINAL_DELTAS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx === x && ny === y) continue; // the candidate tile stays blocked
      if (!inBounds(nx, ny)) continue;
      const key = `${nx},${ny}`;
      if (reached.has(key)) continue;
      if (!isPassable(nx, ny)) continue;
      reached.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return rest.some((p) => !reached.has(`${p.x},${p.y}`));
}

export function computeEdgeLandingPosition(direction, currentPosition, neighborMap) {
  if (direction === 'east') return { x: 0, y: currentPosition.y };
  if (direction === 'west') return { x: neighborMap.rows[0].length - 1, y: currentPosition.y };
  if (direction === 'south') return { x: currentPosition.x, y: 0 };
  return { x: currentPosition.x, y: neighborMap.rows.length - 1 };
}
