import { TOOL_UNLOCK_KINDS, floodFillReachable, checkProgression } from './reachability.js';

const SCREEN_W = 30;
const SCREEN_H = 22;
const CELL = 8;

const GRID_LAYOUT = {
  farNorthwest: { col: 0, row: 0 }, northNorthwest: { col: 1, row: 0 }, farNorth: { col: 2, row: 0 },
  northNortheast: { col: 3, row: 0 }, farNortheast: { col: 4, row: 0 },
  westNorthwest: { col: 0, row: 1 }, northwest: { col: 1, row: 1 }, north: { col: 2, row: 1 },
  northeast: { col: 3, row: 1 }, eastNortheast: { col: 4, row: 1 },
  farWest: { col: 0, row: 2 }, west: { col: 1, row: 2 }, center: { col: 2, row: 2 },
  east: { col: 3, row: 2 }, farEast: { col: 4, row: 2 },
  westSouthwest: { col: 0, row: 3 }, southwest: { col: 1, row: 3 }, south: { col: 2, row: 3 },
  southeast: { col: 3, row: 3 }, eastSoutheast: { col: 4, row: 3 },
  farSouthwest: { col: 0, row: 4 }, southSouthwest: { col: 1, row: 4 }, farSouth: { col: 2, row: 4 },
  southSoutheast: { col: 3, row: 4 }, farSoutheast: { col: 4, row: 4 },
};

const WORLD_W = SCREEN_W * 5;
const WORLD_H = SCREEN_H * 5;

const TILE_COLORS = {
  grass: '#4a7c3f',
  tree: '#1f4d1f',
  water: '#2b6cb0',
  mountainWall: '#5c5044',
  mountain: '#8a8a8a',
  mountainCache: '#d4af37',
  thicket: '#2f5d34',
  thicketCache: '#9acd32',
  townEntrance: '#d9534f',
  exit: '#8a6d3b',
  boss: '#8b0000',
  caveFloor: '#5a5248',
  caveWall: '#2e2a26',
  cavePool: '#1f3f5c',
  miniDungeonEntrance: '#2ec4b6',
  miniDungeonTreasure: '#d4af37',
};

// Chars mirror each real map file's own existing convention exactly (dungeonMap.js
// already uses E/B/T for exit/boss/thicket; the mini-dungeon variants already use
// E/T for entrance/treasure) - safe to share one char across two kinds here since
// wilderness, dungeon, and mini-dungeon palettes never mix within a single export.
const CHAR_FOR_KIND = {
  grass: '.', tree: '#', water: '~', mountainWall: 'W', mountain: 'M', mountainCache: 'K',
  thicket: 'T', thicketCache: 'X', townEntrance: '@',
  exit: 'E', boss: 'B',
  caveFloor: '.', caveWall: '#', cavePool: '~',
  miniDungeonEntrance: 'E', miniDungeonTreasure: 'T',
};

const WILDERNESS_PALETTE = ['grass', 'tree', 'water', 'mountainWall', 'mountain', 'mountainCache', 'thicket', 'thicketCache'];
const DUNGEON_PALETTE = ['grass', 'tree', 'thicket', 'exit', 'boss'];
const MINI_DUNGEON_PALETTE = ['caveFloor', 'caveWall', 'cavePool', 'miniDungeonEntrance', 'miniDungeonTreasure'];

// Icon shown on the palette button; hovering shows PALETTE_LABELS' full description.
// A star suffix marks the "has reward" variant of a tool-gated tile, since the base
// tile emoji is otherwise identical to its non-reward counterpart (matches js/tiles.js).
const PALETTE_ICONS = {
  grass: '🟩', tree: '🌲', water: '🟦', mountainWall: '🗻',
  mountain: '⛰️', mountainCache: '⛰️⭐', thicket: '🌳', thicketCache: '🌳⭐',
  exit: '🚪', boss: '🐉',
  caveFloor: '⬛', caveWall: '🪨', cavePool: '💧',
  miniDungeonEntrance: '🪜', miniDungeonTreasure: '💰',
};

const PALETTE_LABELS = {
  grass: 'Grass', tree: 'Tree (permanent wall)', water: 'Water',
  mountainWall: 'Mountain (permanent wall)',
  mountain: 'Mountain (needs pick)', mountainCache: 'Mountain (needs pick, has reward)',
  thicket: 'Thicket (needs axe)', thicketCache: 'Thicket (needs axe, has reward)',
  exit: 'Exit', boss: 'Boss',
  caveFloor: 'Cave Floor', caveWall: 'Cave Wall', cavePool: 'Cave Pool',
  miniDungeonEntrance: 'Entrance', miniDungeonTreasure: 'Treasure',
};

const SINGLE_MAPS = {
  dungeon: {
    label: 'Dungeon (dragon)', modulePath: '../../js/maps/dungeonMap.js',
    exportName: 'dungeonMap', palette: DUNGEON_PALETTE, defaultKind: 'grass',
  },
  miniDungeonA: {
    label: 'Mini-Dungeon A', modulePath: '../../js/maps/miniDungeons/variantA.js',
    exportName: 'miniDungeonVariantA', palette: MINI_DUNGEON_PALETTE, defaultKind: 'caveFloor',
  },
  miniDungeonB: {
    label: 'Mini-Dungeon B', modulePath: '../../js/maps/miniDungeons/variantB.js',
    exportName: 'miniDungeonVariantB', palette: MINI_DUNGEON_PALETTE, defaultKind: 'caveFloor',
  },
  miniDungeonC: {
    label: 'Mini-Dungeon C', modulePath: '../../js/maps/miniDungeons/variantC.js',
    exportName: 'miniDungeonVariantC', palette: MINI_DUNGEON_PALETTE, defaultKind: 'caveFloor',
  },
  miniDungeonD: {
    label: 'Mini-Dungeon D', modulePath: '../../js/maps/miniDungeons/variantD.js',
    exportName: 'miniDungeonVariantD', palette: MINI_DUNGEON_PALETTE, defaultKind: 'caveFloor',
  },
  miniDungeonE: {
    label: 'Mini-Dungeon E', modulePath: '../../js/maps/miniDungeons/variantE.js',
    exportName: 'miniDungeonVariantE', palette: MINI_DUNGEON_PALETTE, defaultKind: 'caveFloor',
  },
  axeDungeon: {
    label: 'Axe Dungeon', modulePath: '../../js/maps/toolDungeons/axeDungeon.js',
    exportName: 'axeDungeonMap', palette: DUNGEON_PALETTE, defaultKind: 'grass',
  },
  pickDungeon: {
    label: 'Pick Dungeon', modulePath: '../../js/maps/toolDungeons/pickDungeon.js',
    exportName: 'pickDungeonMap', palette: DUNGEON_PALETTE, defaultKind: 'grass',
  },
  canoeDungeon: {
    label: 'Canoe Dungeon', modulePath: '../../js/maps/toolDungeons/canoeDungeon.js',
    exportName: 'canoeDungeonMap', palette: DUNGEON_PALETTE, defaultKind: 'grass',
  },
};

const AUTOSAVE_KEY = 'terrain-painter-autosave-v1';

// tree and mountainWall never clear (permanent walls) - stay impassable in
// every reachability check below, tools or not.
const TOOLLESS_PASSABLE_KINDS = new Set(['grass', 'townEntrance']);
const TOOLED_PASSABLE_KINDS = new Set(['grass', 'townEntrance', 'thicket', 'thicketCache', 'mountain', 'mountainCache', 'water']);

let grid = []; // wilderness world grid, always kept in memory even while editing a single map
let singleGrid = []; // active single map's grid (dungeon / mini-dungeon), only valid when currentMapKey !== 'wilderness'
let singleMapW = 0;
let singleMapH = 0;
let currentMapKey = 'wilderness'; // 'wilderness' | key into SINGLE_MAPS
let activeBrush = 'grass';
let painting = false;
let brushSize = 1; // radius in cells - 1 means "just the cell under the cursor"
let brushShape = 'square';
let hoverCell = null; // { x, y } in active-grid coordinates, or null when the cursor is off-canvas
let dungeonMarker = null; // { screenId, x, y } - the one fixed dungeon entrance spot (wilderness only)
let placingDungeon = false;
let toolDungeonMarkers = {}; // toolId -> { screenId, x, y } (wilderness only)
let placingToolDungeon = null; // toolId currently being placed, or null
let checkOverlay = null; // { toollessReached, tooledReached, frontier: Set<string> } | null (wilderness only)
let undoStacks = {}; // mapKey -> array of { grid, dungeonMarker, toolDungeonMarkers } snapshots, oldest first
const UNDO_LIMIT = 30;

const TOOL_DUNGEON_IDS = ['axe', 'pick', 'canoe'];
const TOOL_DUNGEON_MARKER_COLORS = { axe: '#5cb85c', pick: '#5bc0de', canoe: '#e0a83a' };

function cloneGrid(g) {
  return g.map((row) => row.slice());
}

function cloneToolDungeonMarkers(markers) {
  const out = {};
  for (const [toolId, pos] of Object.entries(markers)) out[toolId] = { ...pos };
  return out;
}

function pushUndoSnapshot() {
  const active = getActive();
  const stack = undoStacks[currentMapKey] || (undoStacks[currentMapKey] = []);
  stack.push({
    grid: cloneGrid(active.grid),
    dungeonMarker: dungeonMarker ? { ...dungeonMarker } : null,
    toolDungeonMarkers: cloneToolDungeonMarkers(toolDungeonMarkers),
  });
  if (stack.length > UNDO_LIMIT) stack.shift();
}

function undo() {
  const stack = undoStacks[currentMapKey];
  if (!stack || stack.length === 0) return false;
  const snapshot = stack.pop();
  if (currentMapKey === 'wilderness') {
    grid = snapshot.grid;
    dungeonMarker = snapshot.dungeonMarker;
    toolDungeonMarkers = snapshot.toolDungeonMarkers || {};
  } else {
    singleGrid = snapshot.grid;
  }
  checkOverlay = null; // stale as soon as terrain is restored
  return true;
}

function worldToLocal(wx, wy) {
  for (const [id, pos] of Object.entries(GRID_LAYOUT)) {
    const originX = pos.col * SCREEN_W;
    const originY = pos.row * SCREEN_H;
    if (wx >= originX && wx < originX + SCREEN_W && wy >= originY && wy < originY + SCREEN_H) {
      return { screenId: id, x: wx - originX, y: wy - originY };
    }
  }
  return null;
}

function localToWorld(screenId, x, y) {
  const pos = GRID_LAYOUT[screenId];
  if (!pos) return null;
  return { wx: pos.col * SCREEN_W + x, wy: pos.row * SCREEN_H + y };
}

function decodeGrid(map) {
  const h = map.rows.length;
  const w = map.rows[0].length;
  const g = Array.from({ length: h }, () => new Array(w).fill('grass'));
  for (let y = 0; y < h; y++) {
    const row = map.rows[y];
    for (let x = 0; x < w; x++) {
      g[y][x] = map.legend[row[x]];
    }
  }
  return { grid: g, w, h };
}

async function loadAllScreens() {
  const newGrid = Array.from({ length: WORLD_H }, () => new Array(WORLD_W).fill('grass'));
  for (const [id, pos] of Object.entries(GRID_LAYOUT)) {
    const mod = await import(`../../js/maps/wilderness/${id}.js`);
    const map = mod[`${id}Map`];
    const originX = pos.col * SCREEN_W;
    const originY = pos.row * SCREEN_H;
    for (let y = 0; y < SCREEN_H; y++) {
      const row = map.rows[y];
      for (let x = 0; x < SCREEN_W; x++) {
        const kind = map.legend[row[x]];
        newGrid[originY + y][originX + x] = kind;
      }
    }
  }
  return newGrid;
}

async function loadSingleMap(key) {
  const def = SINGLE_MAPS[key];
  const mod = await import(def.modulePath);
  return decodeGrid(mod[def.exportName]);
}

function getActive() {
  if (currentMapKey === 'wilderness') return { grid, w: WORLD_W, h: WORLD_H, isWilderness: true };
  return { grid: singleGrid, w: singleMapW, h: singleMapH, isWilderness: false };
}

// Mirrors js/screens/mapScreen.js's isSealedWorldEdge: the true outer
// boundary of the 5x5 world (a screen side with no neighbor at all) always
// renders as mountainWall in the real game regardless of what's painted
// there, since leaving the map is already blocked structurally. Shown the
// same way here, and locked from painting, so there's never a mismatch
// between what you paint and what the game actually shows.
function isSealedWorldEdge(wx, wy) {
  const local = worldToLocal(wx, wy);
  if (!local) return false;
  const pos = GRID_LAYOUT[local.screenId];
  if (local.y === 0 && pos.row === 0) return true;
  if (local.y === SCREEN_H - 1 && pos.row === 4) return true;
  if (local.x === 0 && pos.col === 0) return true;
  if (local.x === SCREEN_W - 1 && pos.col === 4) return true;
  return false;
}

function renderWilderness(ctx) {
  ctx.clearRect(0, 0, WORLD_W * CELL, WORLD_H * CELL);
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      ctx.fillStyle = isSealedWorldEdge(x, y) ? TILE_COLORS.mountainWall : (TILE_COLORS[grid[y][x]] || '#000');
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  if (checkOverlay) {
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const key = `${x},${y}`;
        if (checkOverlay.frontier.has(key)) {
          // The blocking boundary of the first broken stage in the progression
          // (town -> axe -> pick -> canoe -> dragon) - takes priority over the
          // general tint below since this is specifically "the player gets
          // stuck right here," not just "unreachable somewhere."
          ctx.fillStyle = 'rgba(230,30,200,0.65)';
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          continue;
        }
        if (checkOverlay.toollessReached.has(key)) continue; // freely reachable, no tint
        ctx.fillStyle = checkOverlay.tooledReached.has(key)
          ? 'rgba(224,192,57,0.35)' // reachable only with a tool
          : 'rgba(224,60,60,0.4)'; // not reachable even with every tool
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= 5; c++) {
    ctx.beginPath();
    ctx.moveTo(c * SCREEN_W * CELL, 0);
    ctx.lineTo(c * SCREEN_W * CELL, WORLD_H * CELL);
    ctx.stroke();
  }
  for (let r = 0; r <= 5; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * SCREEN_H * CELL);
    ctx.lineTo(WORLD_W * CELL, r * SCREEN_H * CELL);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '10px monospace';
  for (const [id, pos] of Object.entries(GRID_LAYOUT)) {
    ctx.fillText(id, pos.col * SCREEN_W * CELL + 2, pos.row * SCREEN_H * CELL + 10);
  }

  if (dungeonMarker) {
    const world = localToWorld(dungeonMarker.screenId, dungeonMarker.x, dungeonMarker.y);
    if (world) {
      const cx = world.wx * CELL + CELL / 2;
      const cy = world.wy * CELL + CELL / 2;
      ctx.fillStyle = '#e07b39';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  for (const [toolId, pos] of Object.entries(toolDungeonMarkers)) {
    const world = localToWorld(pos.screenId, pos.x, pos.y);
    if (!world) continue;
    const cx = world.wx * CELL + CELL / 2;
    const cy = world.wy * CELL + CELL / 2;
    ctx.fillStyle = TOOL_DUNGEON_MARKER_COLORS[toolId] || '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toolId[0].toUpperCase(), cx, cy + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function renderSingleMap(ctx) {
  ctx.clearRect(0, 0, singleMapW * CELL, singleMapH * CELL);
  for (let y = 0; y < singleMapH; y++) {
    for (let x = 0; x < singleMapW; x++) {
      ctx.fillStyle = TILE_COLORS[singleGrid[y][x]] || '#000';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

function render(ctx) {
  if (currentMapKey === 'wilderness') renderWilderness(ctx);
  else renderSingleMap(ctx);
  drawBrushPreview(ctx);
}

function paintAt(x, y) {
  const active = getActive();
  if (x < 0 || x >= active.w || y < 0 || y >= active.h) return;
  if (active.isWilderness && active.grid[y][x] === 'townEntrance') return;
  if (active.isWilderness && isSealedWorldEdge(x, y)) return;
  active.grid[y][x] = activeBrush;
  if (active.isWilderness) checkOverlay = null; // stale as soon as the terrain changes
}

function brushCells(cx, cy) {
  const r = brushSize - 1;
  const cells = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (brushShape === 'circle' && Math.sqrt(dx * dx + dy * dy) > r + 0.5) continue;
      cells.push([cx + dx, cy + dy]);
    }
  }
  return cells;
}

function paintBrush(cx, cy) {
  for (const [x, y] of brushCells(cx, cy)) paintAt(x, y);
}

// Shows exactly which cells the next click would paint, so an oversized
// brushSize (easy to lose track of, especially with the [/] shortcuts) is
// visible before it lands instead of after. Hidden mid-stroke - the live
// paint fill is already the feedback at that point.
function drawBrushPreview(ctx) {
  if (!hoverCell || painting) return;
  const active = getActive();
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  for (const [x, y] of brushCells(hoverCell.x, hoverCell.y)) {
    if (x < 0 || x >= active.w || y < 0 || y >= active.h) continue;
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
  }
  ctx.restore();
}

function saveAutosave() {
  try {
    const singleMaps = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || '{}').singleMaps || {};
    if (currentMapKey !== 'wilderness') singleMaps[currentMapKey] = singleGrid;
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ grid, dungeonMarker, toolDungeonMarkers, singleMaps }));
  } catch (err) {
    // localStorage may be unavailable (private browsing, quota) - painting still
    // works, it just won't survive a refresh. Nothing to do here.
  }
}

function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? { grid: parsed, dungeonMarker: null, singleMaps: {} } : parsed;
  } catch (err) {
    return null;
  }
}

function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch (err) {
    // nothing to do
  }
}

function buildLegendRowsText(gridSlice, w, h) {
  const usedKinds = new Set();
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const kind = gridSlice[y][x];
      usedKinds.add(kind);
      row += CHAR_FOR_KIND[kind];
    }
    rows.push(row);
  }
  const IDENTIFIER_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const legendEntries = [...usedKinds]
    .map((kind) => {
      const char = CHAR_FOR_KIND[kind];
      const key = IDENTIFIER_KEY.test(char) ? char : `'${char}'`;
      return `${key}: '${kind}'`;
    })
    .join(', ');
  const rowsEntries = rows.map((r) => `  '${r}',`).join('\n');
  return `const LEGEND = { ${legendEntries} };\n\nconst ROWS = [\n${rowsEntries}\n];`;
}

function exportScreen(id) {
  const pos = GRID_LAYOUT[id];
  const originX = pos.col * SCREEN_W;
  const originY = pos.row * SCREEN_H;
  const slice = [];
  for (let y = 0; y < SCREEN_H; y++) {
    slice.push(grid[originY + y].slice(originX, originX + SCREEN_W));
  }
  return buildLegendRowsText(slice, SCREEN_W, SCREEN_H);
}

function exportSingleMap() {
  return buildLegendRowsText(singleGrid, singleMapW, singleMapH);
}

// --- Bulk export straight to disk (File System Access API) -----------------
// Avoids the 25x manual "copy LEGEND/ROWS, paste over the file" cycle for the
// wilderness screens. Reads each real file fresh, patches only its
// LEGEND/ROWS block (or, for state.js/toolDungeons.js, only the specific
// position fields), and writes back - never regenerates a whole file, so
// unrelated content (imports, comments, the export statement) is untouched.
// The non-greedy "first closing delimiter" regexes and sanity checks mirror
// the ones already proven safe earlier in this project for the same job -
// an earlier newline-anchored version of this same idea corrupted files by
// matching past a single-line LEGEND declaration straight through to the
// end of the file.
let repoDirHandle = null;

async function pickRepoDirectory() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  // Sanity check: this should be the repo root, not some other folder -
  // confirm it directly contains a 'js' directory before trusting it.
  await handle.getDirectoryHandle('js');
  repoDirHandle = handle;
  return handle.name;
}

async function getFileHandleForPath(relativePath) {
  const parts = relativePath.split('/');
  let dir = repoDirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  return dir.getFileHandle(parts[parts.length - 1]);
}

async function readFileText(relativePath) {
  const fh = await getFileHandleForPath(relativePath);
  return (await fh.getFile()).text();
}

async function writeFileText(relativePath, text) {
  const fh = await getFileHandleForPath(relativePath);
  const writable = await fh.createWritable();
  await writable.write(text);
  await writable.close();
}

function patchLegendRows(originalText, newLegendRowsText, fileLabel) {
  const legendRe = /const LEGEND = \{[\s\S]*?\};/;
  const rowsRe = /const ROWS = \[[\s\S]*?\];/;
  const legendMatch = originalText.match(legendRe);
  const rowsMatch = originalText.match(rowsRe);
  if (!legendMatch || !rowsMatch) throw new Error(`${fileLabel}: could not find LEGEND/ROWS block`);
  if (rowsMatch.index <= legendMatch.index) throw new Error(`${fileLabel}: ROWS appears before LEGEND - unexpected file shape, aborting`);
  if (!/'.+',/.test(rowsMatch[0])) throw new Error(`${fileLabel}: ROWS block doesn't look like row strings - aborting`);
  const newLegendText = newLegendRowsText.match(legendRe)[0];
  const newRowsText = newLegendRowsText.match(rowsRe)[0];
  return originalText.replace(legendRe, newLegendText).replace(rowsRe, newRowsText);
}

function patchDungeonEntrancePosition(originalText, pos) {
  const re = /export const DEFAULT_DUNGEON_ENTRANCE_POSITION = \{[^}]*\};/;
  if (!re.test(originalText)) throw new Error('state.js: could not find DEFAULT_DUNGEON_ENTRANCE_POSITION');
  return originalText.replace(re, `export const DEFAULT_DUNGEON_ENTRANCE_POSITION = { screenId: '${pos.screenId}', x: ${pos.x}, y: ${pos.y} };`);
}

function patchToolDungeonEntrance(originalText, toolId, pos) {
  const blockRe = new RegExp(`${toolId}: \\{[^}]*\\}`);
  const match = originalText.match(blockRe);
  if (!match) throw new Error(`toolDungeons.js: could not find '${toolId}' entry`);
  const mapIdMatch = match[0].match(/mapId: '([^']*)'/);
  const tileKindMatch = match[0].match(/tileKind: '([^']*)'/);
  if (!mapIdMatch || !tileKindMatch) throw new Error(`toolDungeons.js: '${toolId}' entry missing mapId/tileKind`);
  const newBlock = `${toolId}: {\n    screenId: '${pos.screenId}', x: ${pos.x}, y: ${pos.y}, mapId: '${mapIdMatch[1]}', tileKind: '${tileKindMatch[1]}',\n  }`;
  return originalText.replace(blockRe, newBlock);
}

// Returns a summary string. Writes every changed wilderness screen, the
// dungeon entrance position, and all three tool dungeon entrance positions -
// everything that otherwise needs its own manual copy/paste. Stops at the
// first error rather than leaving a partial, hard-to-audit set of writes.
async function exportAllToFiles() {
  if (!repoDirHandle) throw new Error('Choose your repo folder first.');
  let written = 0;
  let unchanged = 0;
  const changedFiles = [];

  for (const id of Object.keys(GRID_LAYOUT)) {
    const relativePath = `js/maps/wilderness/${id}.js`;
    const originalText = await readFileText(relativePath);
    const patched = patchLegendRows(originalText, exportScreen(id), relativePath);
    if (patched === originalText) { unchanged++; continue; }
    await writeFileText(relativePath, patched);
    written++;
    changedFiles.push(id);
  }

  if (dungeonMarker) {
    const relativePath = 'js/state.js';
    const originalText = await readFileText(relativePath);
    const patched = patchDungeonEntrancePosition(originalText, dungeonMarker);
    if (patched !== originalText) {
      await writeFileText(relativePath, patched);
      written++;
      changedFiles.push('dungeon entrance (state.js)');
    } else {
      unchanged++;
    }
  }

  if (Object.keys(toolDungeonMarkers).length > 0) {
    const relativePath = 'js/data/toolDungeons.js';
    let originalText = await readFileText(relativePath);
    let text = originalText;
    let anyChanged = false;
    for (const [toolId, pos] of Object.entries(toolDungeonMarkers)) {
      text = patchToolDungeonEntrance(text, toolId, pos);
    }
    if (text !== originalText) {
      await writeFileText(relativePath, text);
      written++;
      anyChanged = true;
      changedFiles.push('tool dungeon entrances (toolDungeons.js)');
    }
    if (!anyChanged) unchanged++;
  }

  return `Wrote ${written} changed file(s)${changedFiles.length ? ': ' + changedFiles.join(', ') : ''}. ${unchanged} already up to date.`;
}

function findTownEntrance() {
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (grid[y][x] === 'townEntrance') return { x, y };
    }
  }
  return null;
}

function cellPassable(passableKinds, x, y) {
  // The real game's mapScreen.js always renders the dungeon-entrance tile (and
  // the tool-dungeon entrances) as walkable at their exact marker position,
  // regardless of the terrain painted underneath - matching that here so the
  // check reflects actual game behavior.
  if (dungeonMarker) {
    const world = localToWorld(dungeonMarker.screenId, dungeonMarker.x, dungeonMarker.y);
    if (world && world.wx === x && world.wy === y) return true;
  }
  for (const pos of Object.values(toolDungeonMarkers)) {
    const world = localToWorld(pos.screenId, pos.x, pos.y);
    if (world && world.wx === x && world.wy === y) return true;
  }
  if (isSealedWorldEdge(x, y)) return false; // always mountainWall in the real game, regardless of raw grid content
  return passableKinds.has(grid[y][x]);
}

function worldKeyFor(marker) {
  if (!marker) return null;
  const world = localToWorld(marker.screenId, marker.x, marker.y);
  return world ? { x: world.wx, y: world.wy } : null;
}

function checkMap() {
  const status = document.getElementById('checkStatus');
  const town = findTownEntrance();
  if (!town) {
    checkOverlay = null;
    status.textContent = 'No townEntrance tile found on the map - cannot check.';
    status.className = 'fail';
    return;
  }

  const isPassable = (x, y, unlockedKinds) => cellPassable(unlockedKinds, x, y);
  const toollessReached = floodFillReachable(WORLD_W, WORLD_H, town, (x, y) => isPassable(x, y, TOOLLESS_PASSABLE_KINDS));
  const tooledReached = floodFillReachable(WORLD_W, WORLD_H, town, (x, y) => isPassable(x, y, TOOLED_PASSABLE_KINDS));

  // Staged progression check: each tool's terrain only unlocks after
  // confirming that tool's own dungeon is reachable using whatever's
  // already unlocked - not just "reachable with some combination of
  // tools," which would miss a chicken-and-egg gate (e.g. the pick
  // dungeon sitting behind thicket when the axe dungeon itself is what's
  // unreachable). See reachability.js (also unit tested there).
  const entrances = [
    { id: 'axe', label: 'axe dungeon', pos: worldKeyFor(toolDungeonMarkers.axe), unlocks: TOOL_UNLOCK_KINDS.axe },
    { id: 'pick', label: 'pick dungeon', pos: worldKeyFor(toolDungeonMarkers.pick), unlocks: TOOL_UNLOCK_KINDS.pick },
    { id: 'canoe', label: 'canoe dungeon (boat)', pos: worldKeyFor(toolDungeonMarkers.canoe), unlocks: TOOL_UNLOCK_KINDS.canoe },
    { id: null, label: 'dragon dungeon', pos: worldKeyFor(dungeonMarker), unlocks: [] },
  ];

  const result = checkProgression({
    width: WORLD_W, height: WORLD_H, town, isPassable, toollessKinds: TOOLLESS_PASSABLE_KINDS, entrances,
  });

  checkOverlay = { toollessReached, tooledReached, frontier: result.frontier };

  if (!result.ok) {
    const stage = entrances[result.stageIndex];
    const priorStep = result.stageIndex === 0 ? 'from town with no tools' : `after getting the ${entrances[result.stageIndex - 1].id}`;
    if (!stage.pos) {
      status.textContent = `⚠️ Can't check past the ${stage.label} - it hasn't been placed yet.`;
    } else {
      status.textContent = `❌ The ${stage.label} is NOT reachable ${priorStep} — magenta tiles on the map mark exactly where the path is blocked.`;
    }
    status.className = 'fail';
    return;
  }

  // What actually matters (Timothy's own bar): can the player navigate,
  // get the treasure/tools, and reach the dragon - not "is literally every
  // grass tile in the world reachable." The entrance chain above is the
  // real check; isolated pockets elsewhere are still visibly tinted red on
  // the map (nothing hidden) but aren't treated as a failure here unless
  // something is actually placed there.
  status.textContent = '✅ Full progression is soundly gated: town → axe → pick → canoe (boat) → dragon dungeon, each reachable in order.';
  status.className = 'ok';
}

async function init() {
  const canvas = document.getElementById('worldCanvas');
  const ctx = canvas.getContext('2d');
  const autosaveStatus = document.getElementById('autosaveStatus');
  const wildernessOnlyEls = document.querySelectorAll('.wilderness-only');
  const singleMapOnlyEls = document.querySelectorAll('.single-map-only');
  const paletteDiv = document.getElementById('palette');
  const exportSelect = document.getElementById('exportSelect');

  const savedRaw = loadAutosave();
  const savedSingleMaps = (savedRaw && savedRaw.singleMaps) || {};

  if (savedRaw && savedRaw.grid) {
    grid = savedRaw.grid;
    dungeonMarker = savedRaw.dungeonMarker;
    toolDungeonMarkers = savedRaw.toolDungeonMarkers || {};
    autosaveStatus.textContent = 'Restored unsaved changes from your last session.';
  } else {
    grid = await loadAllScreens();
  }
  if (!dungeonMarker) {
    const stateMod = await import('../../js/state.js');
    dungeonMarker = { ...stateMod.DEFAULT_DUNGEON_ENTRANCE_POSITION };
  }
  if (Object.keys(toolDungeonMarkers).length === 0) {
    const toolDungeonsMod = await import('../../js/data/toolDungeons.js');
    for (const toolId of TOOL_DUNGEON_IDS) {
      const entry = toolDungeonsMod.TOOL_DUNGEON_ENTRANCES[toolId];
      toolDungeonMarkers[toolId] = { screenId: entry.screenId, x: entry.x, y: entry.y };
    }
  }

  const dungeonReadout = document.getElementById('dungeonReadout');
  function updateDungeonReadout() {
    dungeonReadout.textContent = dungeonMarker
      ? `${dungeonMarker.screenId} (${dungeonMarker.x}, ${dungeonMarker.y})`
      : 'not set';
  }

  const toolDungeonSelect = document.getElementById('toolDungeonSelect');
  const toolDungeonReadout = document.getElementById('toolDungeonReadout');
  function updateToolDungeonReadout() {
    const pos = toolDungeonMarkers[toolDungeonSelect.value];
    toolDungeonReadout.textContent = pos ? `${pos.screenId} (${pos.x}, ${pos.y})` : 'not set';
  }
  for (const toolId of TOOL_DUNGEON_IDS) {
    const opt = document.createElement('option');
    opt.value = toolId;
    opt.textContent = toolId;
    toolDungeonSelect.appendChild(opt);
  }
  toolDungeonSelect.addEventListener('change', updateToolDungeonReadout);

  function currentPalette() {
    return currentMapKey === 'wilderness' ? WILDERNESS_PALETTE : SINGLE_MAPS[currentMapKey].palette;
  }

  function rebuildPalette() {
    paletteDiv.innerHTML = '';
    const kinds = currentPalette();
    for (const kind of kinds) {
      const btn = document.createElement('button');
      btn.dataset.kind = kind;
      btn.textContent = PALETTE_ICONS[kind] || kind;
      btn.title = PALETTE_LABELS[kind] || kind;
      btn.addEventListener('click', () => {
        activeBrush = kind;
        paletteDiv.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
      paletteDiv.appendChild(btn);
    }
    activeBrush = kinds[0];
    paletteDiv.querySelector('button').classList.add('active');
  }

  function setModeVisibility() {
    const isWilderness = currentMapKey === 'wilderness';
    wildernessOnlyEls.forEach((el) => { el.style.display = isWilderness ? '' : 'none'; });
    singleMapOnlyEls.forEach((el) => { el.style.display = isWilderness ? 'none' : ''; });
  }

  async function switchMap(key) {
    currentMapKey = key;
    setModeVisibility();
    rebuildPalette();
    if (key === 'wilderness') {
      canvas.width = WORLD_W * CELL;
      canvas.height = WORLD_H * CELL;
      updateDungeonReadout();
      updateToolDungeonReadout();
    } else {
      const cached = savedSingleMaps[key];
      const loaded = cached ? { grid: cached, w: cached[0].length, h: cached.length } : await loadSingleMap(key);
      singleGrid = loaded.grid;
      singleMapW = loaded.w;
      singleMapH = loaded.h;
      canvas.width = singleMapW * CELL;
      canvas.height = singleMapH * CELL;
    }
    render(ctx);
  }

  const mapSelect = document.getElementById('mapSelect');
  const wildernessOpt = document.createElement('option');
  wildernessOpt.value = 'wilderness';
  wildernessOpt.textContent = 'Wilderness (5x5 world)';
  mapSelect.appendChild(wildernessOpt);
  for (const [key, def] of Object.entries(SINGLE_MAPS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = def.label;
    mapSelect.appendChild(opt);
  }
  mapSelect.addEventListener('change', () => switchMap(mapSelect.value));

  await switchMap('wilderness');

  document.getElementById('resetFromFilesBtn').addEventListener('click', async () => {
    if (!confirm('Discard all unexported changes on the current map and reload the real file from disk?')) return;
    if (currentMapKey === 'wilderness') {
      grid = await loadAllScreens();
      const stateMod = await import('../../js/state.js');
      dungeonMarker = { ...stateMod.DEFAULT_DUNGEON_ENTRANCE_POSITION };
      updateDungeonReadout();
      const toolDungeonsMod = await import('../../js/data/toolDungeons.js');
      for (const toolId of TOOL_DUNGEON_IDS) {
        const entry = toolDungeonsMod.TOOL_DUNGEON_ENTRANCES[toolId];
        toolDungeonMarkers[toolId] = { screenId: entry.screenId, x: entry.x, y: entry.y };
      }
      updateToolDungeonReadout();
    } else {
      const loaded = await loadSingleMap(currentMapKey);
      singleGrid = loaded.grid;
      singleMapW = loaded.w;
      singleMapH = loaded.h;
      delete savedSingleMaps[currentMapKey];
    }
    undoStacks[currentMapKey] = []; // a freshly-reloaded map has nothing sensible left to undo into
    saveAutosave();
    autosaveStatus.textContent = 'Reloaded from files.';
    render(ctx);
  });

  function doUndo() {
    if (!undo()) return;
    updateDungeonReadout();
    updateToolDungeonReadout();
    saveAutosave();
    render(ctx);
  }
  document.getElementById('undoBtn').addEventListener('click', doUndo);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      doUndo();
      return;
    }
    if (e.key === '[' || e.key === ']') {
      const next = Math.min(Number(brushSizeInput.max), Math.max(Number(brushSizeInput.min), brushSize + (e.key === ']' ? 1 : -1)));
      if (next === brushSize) return;
      brushSize = next;
      brushSizeInput.value = String(brushSize);
      brushSizeLabel.textContent = String(brushSize);
      render(ctx);
    }
  });

  const placeDungeonBtn = document.getElementById('placeDungeonBtn');
  const placeToolDungeonBtn = document.getElementById('placeToolDungeonBtn');
  placeDungeonBtn.addEventListener('click', () => {
    placingDungeon = !placingDungeon;
    placingToolDungeon = null;
    placeToolDungeonBtn.classList.remove('active');
    placeDungeonBtn.classList.toggle('active', placingDungeon);
    canvas.classList.toggle('placing-dungeon', placingDungeon);
  });

  document.getElementById('copyDungeonBtn').addEventListener('click', async () => {
    if (!dungeonMarker) return;
    const text = `{ screenId: '${dungeonMarker.screenId}', x: ${dungeonMarker.x}, y: ${dungeonMarker.y} }`;
    try {
      await navigator.clipboard.writeText(text);
      autosaveStatus.textContent = `Copied: ${text}`;
    } catch (err) {
      autosaveStatus.textContent = `Clipboard blocked - copy manually: ${text}`;
    }
  });

  placeToolDungeonBtn.addEventListener('click', () => {
    placingToolDungeon = placingToolDungeon ? null : toolDungeonSelect.value;
    placingDungeon = false;
    placeDungeonBtn.classList.remove('active');
    placeToolDungeonBtn.classList.toggle('active', Boolean(placingToolDungeon));
    canvas.classList.toggle('placing-dungeon', Boolean(placingToolDungeon));
  });

  document.getElementById('copyToolDungeonBtn').addEventListener('click', async () => {
    const pos = toolDungeonMarkers[toolDungeonSelect.value];
    if (!pos) return;
    const text = `{ screenId: '${pos.screenId}', x: ${pos.x}, y: ${pos.y} }`;
    try {
      await navigator.clipboard.writeText(text);
      autosaveStatus.textContent = `Copied: ${text}`;
    } catch (err) {
      autosaveStatus.textContent = `Clipboard blocked - copy manually: ${text}`;
    }
  });

  document.getElementById('checkMapBtn').addEventListener('click', () => {
    checkMap();
    render(ctx);
  });

  const brushSizeInput = document.getElementById('brushSize');
  const brushSizeLabel = document.getElementById('brushSizeLabel');
  brushSizeInput.addEventListener('input', () => {
    brushSize = Number(brushSizeInput.value);
    brushSizeLabel.textContent = String(brushSize);
  });

  document.querySelectorAll('#brushShape button').forEach((btn) => {
    btn.addEventListener('click', () => {
      brushShape = btn.dataset.shape;
      document.querySelectorAll('#brushShape button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelector('#brushShape button[data-shape="square"]').classList.add('active');

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / CELL),
      y: Math.floor((e.clientY - rect.top) / CELL),
    };
  }

  // Trackpad two-finger scroll fires as a `wheel` event on desktop Chrome/
  // Firefox (not a touch event), so it isn't stopped by touch-action - it
  // scrolls the page mid-stroke, shifting the canvas under the cursor while
  // painting. Only suppress it during an active stroke so scrolling to see
  // the rest of the map still works between strokes.
  canvas.addEventListener('wheel', (e) => {
    if (painting) e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = cellFromEvent(e);
    if (currentMapKey === 'wilderness' && placingDungeon) {
      pushUndoSnapshot();
      const local = worldToLocal(x, y);
      if (local) {
        dungeonMarker = local;
        updateDungeonReadout();
        checkOverlay = null; // stale as soon as the marker moves
        saveAutosave();
      }
      placingDungeon = false;
      placeDungeonBtn.classList.remove('active');
      canvas.classList.remove('placing-dungeon');
      render(ctx);
      return;
    }
    if (currentMapKey === 'wilderness' && placingToolDungeon) {
      pushUndoSnapshot();
      const local = worldToLocal(x, y);
      if (local) {
        toolDungeonMarkers[placingToolDungeon] = local;
        updateToolDungeonReadout();
        checkOverlay = null; // stale as soon as a marker moves
        saveAutosave();
      }
      placingToolDungeon = null;
      placeToolDungeonBtn.classList.remove('active');
      canvas.classList.remove('placing-dungeon');
      render(ctx);
      return;
    }
    pushUndoSnapshot();
    painting = true;
    paintBrush(x, y);
    render(ctx);
  });
  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = cellFromEvent(e);
    const validBrush = currentPalette().includes(activeBrush);
    hoverCell = validBrush ? { x, y } : null;
    if (painting && validBrush) paintBrush(x, y);
    render(ctx);
  });
  canvas.addEventListener('mouseleave', () => {
    hoverCell = null;
    render(ctx);
  });
  window.addEventListener('mouseup', () => {
    // Autosave once per stroke (not per mousemove) - JSON-serializing a large
    // grid on every pixel of a drag would be needlessly slow.
    if (painting) saveAutosave();
    painting = false;
  });

  for (const id of Object.keys(GRID_LAYOUT)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    exportSelect.appendChild(opt);
  }

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const text = currentMapKey === 'wilderness' ? exportScreen(exportSelect.value) : exportSingleMap();
    document.getElementById('exportOutput').value = text;
    const status = document.getElementById('exportStatus');
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied to clipboard.';
    } catch (err) {
      status.textContent = 'Clipboard blocked — copy from the text box below.';
    }
  });

  const repoStatus = document.getElementById('repoStatus');
  const chooseRepoBtn = document.getElementById('chooseRepoBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const exportAllStatus = document.getElementById('exportAllStatus');

  if (!window.showDirectoryPicker) {
    repoStatus.textContent = 'Not supported in this browser (needs Chrome or Edge) — use "Copy LEGEND/ROWS" per screen instead.';
    chooseRepoBtn.disabled = true;
    exportAllBtn.disabled = true;
  } else {
    chooseRepoBtn.addEventListener('click', async () => {
      try {
        const name = await pickRepoDirectory();
        repoStatus.textContent = `Writing straight to: ${name}/`;
      } catch (err) {
        if (err.name !== 'AbortError') repoStatus.textContent = `Could not use that folder: ${err.message}`;
      }
    });

    exportAllBtn.addEventListener('click', async () => {
      exportAllStatus.textContent = 'Writing…';
      try {
        exportAllStatus.textContent = await exportAllToFiles();
      } catch (err) {
        exportAllStatus.textContent = `Failed: ${err.message}`;
      }
    });
  }
}

init();
