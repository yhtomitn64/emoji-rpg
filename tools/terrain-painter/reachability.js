// Pure staged-reachability algorithm behind the terrain painter's "Check
// Map" feature - no DOM/canvas/window dependency, so it can be unit tested
// directly (see tests/terrainPainterReachability.test.js) and imported by
// painter.js for the real UI.

// Which terrain kinds each tool dungeon's reward unlocks, applied in this
// order (matches Timothy's own map design: axe before pick before
// canoe/boat, each one only reachable using what came before).
export const TOOL_UNLOCK_KINDS = {
  axe: ['thicket', 'thicketCache'],
  pick: ['mountain', 'mountainCache'],
  canoe: ['water'],
};

export function floodFillReachable(width, height, start, isPassable) {
  const reached = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (reached.has(key)) continue;
      if (!isPassable(nx, ny)) continue;
      reached.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return reached;
}

// Tiles just outside a reached region that are still blocked - i.e. exactly
// where a player standing at the edge of what they can reach hits a wall.
export function computeFrontier(width, height, reached, isPassable) {
  const frontier = new Set();
  for (const key of reached) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nkey = `${nx},${ny}`;
      if (reached.has(nkey) || isPassable(nx, ny)) continue;
      frontier.add(nkey);
    }
  }
  return frontier;
}

// The staged progression check itself. `entrances` is an ordered list of
// { id, label, pos: {x,y}|null, unlocks: string[] } - each stage confirms
// its own entrance is reachable using only what's been unlocked so far,
// THEN adds its `unlocks` kinds to what's passable for the next stage. This
// catches a chicken-and-egg gate (a later tool's dungeon sitting behind
// terrain that only an *earlier* tool clears) that a single "reachable with
// any combination of tools" check would miss.
//
// isPassable(x, y, unlockedKinds: Set<string>) is caller-defined - it looks
// up the tile kind, applies entrance-marker/sealed-edge overrides, etc.
// unlockedKinds always includes toollessKinds and grows by one stage's
// `unlocks` after that stage passes.
export function checkProgression({ width, height, town, isPassable, toollessKinds, entrances }) {
  const unlockedKinds = new Set(toollessKinds);
  let reached = floodFillReachable(width, height, town, (x, y) => isPassable(x, y, unlockedKinds));

  for (let i = 0; i < entrances.length; i++) {
    const stage = entrances[i];
    const targetKey = stage.pos ? `${stage.pos.x},${stage.pos.y}` : null;
    if (!targetKey || !reached.has(targetKey)) {
      return {
        ok: false,
        stageIndex: i,
        stageId: stage.id,
        stageLabel: stage.label,
        reached,
        frontier: computeFrontier(width, height, reached, (x, y) => isPassable(x, y, unlockedKinds)),
      };
    }
    for (const kind of stage.unlocks) unlockedKinds.add(kind);
    reached = floodFillReachable(width, height, town, (x, y) => isPassable(x, y, unlockedKinds));
  }

  return { ok: true, stageIndex: null, stageId: null, stageLabel: null, reached, frontier: new Set() };
}
