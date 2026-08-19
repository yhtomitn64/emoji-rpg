export const CORNER_SCREEN_IDS = ['northeast', 'northwest', 'southeast', 'southwest'];

export function pickRandomEntrancePosition(cornerMaps, rng = Math.random) {
  const screenId = CORNER_SCREEN_IDS[Math.floor(rng() * CORNER_SCREEN_IDS.length)];
  const map = cornerMaps[screenId];
  const grassTiles = [];
  for (let y = 0; y < map.rows.length; y++) {
    for (let x = 0; x < map.rows[y].length; x++) {
      if (map.legend[map.rows[y][x]] === 'grass') {
        grassTiles.push({ x, y });
      }
    }
  }
  const { x, y } = grassTiles[Math.floor(rng() * grassTiles.length)];
  return { screenId, x, y };
}
