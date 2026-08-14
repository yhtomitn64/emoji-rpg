import { TILES } from '../tiles.js';

export function isWalkableAt(map, x, y) {
  const row = map.rows[y];
  if (!row) return false;
  const char = row[x];
  if (!char) return false;
  const tile = TILES[map.legend[char]];
  return Boolean(tile && tile.walkable);
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
