// Stitches a set of screens - each with its own local rows/legend, linked
// via a `neighbors` field the way js/maps/wilderness/*.js already declares
// them - into one global tile-coordinate space per connected cluster. A
// screen with no `neighbors` at all (town, a dungeon) is its own
// one-screen cluster. Assumes every screen within one cluster shares the
// same width/height (true today for all 25 wilderness screens - see this
// plan's Global Constraints).
const DIRECTION_DELTA = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

export function buildWorldGrid(maps) {
  const clusterIdOfScreen = {};
  const originByScreen = {};
  const screensByCluster = {};

  for (const rootId of Object.keys(maps)) {
    if (clusterIdOfScreen[rootId]) continue;
    const clusterId = rootId;
    const rootMap = maps[rootId];
    originByScreen[rootId] = { gx: 0, gy: 0, width: rootMap.rows[0].length, height: rootMap.rows.length };
    clusterIdOfScreen[rootId] = clusterId;
    screensByCluster[clusterId] = [rootId];

    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift();
      const map = maps[id];
      const origin = originByScreen[id];
      if (!map.neighbors) continue;
      for (const [dir, neighborId] of Object.entries(map.neighbors)) {
        if (!neighborId || clusterIdOfScreen[neighborId]) continue;
        const neighborMap = maps[neighborId];
        const [dx, dy] = DIRECTION_DELTA[dir];
        const neighborWidth = neighborMap.rows[0].length;
        const neighborHeight = neighborMap.rows.length;
        const gx = dx === 1 ? origin.gx + origin.width : dx === -1 ? origin.gx - neighborWidth : origin.gx;
        const gy = dy === 1 ? origin.gy + origin.height : dy === -1 ? origin.gy - neighborHeight : origin.gy;
        originByScreen[neighborId] = { gx, gy, width: neighborWidth, height: neighborHeight };
        clusterIdOfScreen[neighborId] = clusterId;
        screensByCluster[clusterId].push(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return { originByScreen, clusterIdOfScreen, screensByCluster };
}

export function screenToGlobal(grid, screenId, localX, localY) {
  const origin = grid.originByScreen[screenId];
  return { gx: origin.gx + localX, gy: origin.gy + localY };
}

// `screenId` only anchors which cluster to search - the returned screenId
// may be a different screen in that same cluster. Returns null past the
// cluster's outer edge.
export function globalToScreen(grid, screenId, gx, gy) {
  const clusterId = grid.clusterIdOfScreen[screenId];
  for (const candidateId of grid.screensByCluster[clusterId]) {
    const origin = grid.originByScreen[candidateId];
    if (gx >= origin.gx && gx < origin.gx + origin.width && gy >= origin.gy && gy < origin.gy + origin.height) {
      return { screenId: candidateId, localX: gx - origin.gx, localY: gy - origin.gy };
    }
  }
  return null;
}

export function clusterBounds(grid, screenId) {
  const clusterId = grid.clusterIdOfScreen[screenId];
  let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
  for (const candidateId of grid.screensByCluster[clusterId]) {
    const origin = grid.originByScreen[candidateId];
    minGx = Math.min(minGx, origin.gx);
    minGy = Math.min(minGy, origin.gy);
    maxGx = Math.max(maxGx, origin.gx + origin.width - 1);
    maxGy = Math.max(maxGy, origin.gy + origin.height - 1);
  }
  return { minGx, minGy, maxGx, maxGy };
}
