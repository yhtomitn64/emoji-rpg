export function markVisited(visited, screenId, x, y) {
  const key = `${x},${y}`;
  const screenVisited = { ...(visited[screenId] || {}), [key]: true };
  return { ...visited, [screenId]: screenVisited };
}

export function isVisited(visited, screenId, x, y) {
  return Boolean(visited[screenId] && visited[screenId][`${x},${y}`]);
}
