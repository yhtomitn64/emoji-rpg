// A tile's stored entry has taken three shapes over time, oldest first:
// `true` (a boolean visited set), a plain `number` (a walk count), and now
// `{ count, dirs }` (walk count plus which edges have actually been
// crossed at that tile - see markDirection). Every reader goes through
// this so old saves upgrade gracefully with no explicit migration step:
// legacy shapes normalize to a real count and an empty dirs array.
function normalizeEntry(raw) {
  if (raw === true) return { count: 1, dirs: [] };
  if (typeof raw === 'number') return { count: raw, dirs: [] };
  if (raw && typeof raw === 'object') return { count: raw.count || 0, dirs: raw.dirs || [] };
  return { count: 0, dirs: [] };
}

// `dir` (one of 'n'/'s'/'e'/'w', or omitted) is the edge the player entered
// this tile through - omitted for the one case where there isn't one: the
// very first tile on a screen, landed on without a preceding move.
export function markVisited(visited, screenId, x, y, dir) {
  const key = `${x},${y}`;
  const existing = normalizeEntry(visited[screenId] && visited[screenId][key]);
  const dirs = dir && !existing.dirs.includes(dir) ? [...existing.dirs, dir] : existing.dirs;
  const screenVisited = { ...(visited[screenId] || {}), [key]: { count: existing.count + 1, dirs } };
  return { ...visited, [screenId]: screenVisited };
}

// Records the edge a tile was *left* through, without counting it as a new
// visit - moving away from a tile isn't visiting it again. Called on the
// tile the player is stepping off of, alongside markVisited on the tile
// they're stepping onto, so a single move marks both halves of the
// connection it creates.
export function markDirection(visited, screenId, x, y, dir) {
  const key = `${x},${y}`;
  const existing = normalizeEntry(visited[screenId] && visited[screenId][key]);
  if (existing.dirs.includes(dir)) return visited;
  const screenVisited = { ...(visited[screenId] || {}), [key]: { count: existing.count, dirs: [...existing.dirs, dir] } };
  return { ...visited, [screenId]: screenVisited };
}

export function isVisited(visited, screenId, x, y) {
  return getVisitCount(visited, screenId, x, y) > 0;
}

export function getVisitCount(visited, screenId, x, y) {
  const raw = visited[screenId] && visited[screenId][`${x},${y}`];
  return normalizeEntry(raw).count;
}

// Which edges of this tile have actually been crossed by the player, ever -
// the source of truth for which directions a trail stroke should reach
// toward (see js/screens/mapScreen.js's render()). Never inferred from a
// neighbor's own state; always exactly what was recorded here.
export function getVisitDirs(visited, screenId, x, y) {
  const raw = visited[screenId] && visited[screenId][`${x},${y}`];
  return normalizeEntry(raw).dirs;
}
