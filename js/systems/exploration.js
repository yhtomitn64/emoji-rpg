export function markVisited(visited, screenId, x, y) {
  const key = `${x},${y}`;
  const screenVisited = { ...(visited[screenId] || {}) };
  screenVisited[key] = getVisitCount(visited, screenId, x, y) + 1;
  return { ...visited, [screenId]: screenVisited };
}

export function isVisited(visited, screenId, x, y) {
  return getVisitCount(visited, screenId, x, y) > 0;
}

export function getVisitCount(visited, screenId, x, y) {
  const raw = visited[screenId] && visited[screenId][`${x},${y}`];
  if (raw === true) return 1; // legacy saves stored a boolean
  return raw || 0;
}
