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
  mountainCache: '#c9a227',
  thicket: '#2f5d34',
  thicketCache: '#c9a227',
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
};

const AUTOSAVE_KEY = 'terrain-painter-autosave-v1';

// tree never clears (permanent wall) and water has no boat yet (see BACKLOG.md)
// - both stay impassable in every reachability check below, tools or not.
const TOOLLESS_PASSABLE_KINDS = new Set(['grass', 'townEntrance']);
const TOOLED_PASSABLE_KINDS = new Set(['grass', 'townEntrance', 'thicket', 'thicketCache', 'mountain', 'mountainCache']);

let grid = []; // wilderness world grid, always kept in memory even while editing a single map
let singleGrid = []; // active single map's grid (dungeon / mini-dungeon), only valid when currentMapKey !== 'wilderness'
let singleMapW = 0;
let singleMapH = 0;
let currentMapKey = 'wilderness'; // 'wilderness' | key into SINGLE_MAPS
let activeBrush = 'grass';
let painting = false;
let brushSize = 1; // radius in cells - 1 means "just the cell under the cursor"
let brushShape = 'square';
let dungeonMarker = null; // { screenId, x, y } - the one fixed dungeon entrance spot (wilderness only)
let placingDungeon = false;
let checkOverlay = null; // { toollessReached: Set<string>, tooledReached: Set<string> } | null (wilderness only)
let undoStacks = {}; // mapKey -> array of { grid, dungeonMarker } snapshots, oldest first
const UNDO_LIMIT = 30;

function cloneGrid(g) {
  return g.map((row) => row.slice());
}

function pushUndoSnapshot() {
  const active = getActive();
  const stack = undoStacks[currentMapKey] || (undoStacks[currentMapKey] = []);
  stack.push({ grid: cloneGrid(active.grid), dungeonMarker: dungeonMarker ? { ...dungeonMarker } : null });
  if (stack.length > UNDO_LIMIT) stack.shift();
}

function undo() {
  const stack = undoStacks[currentMapKey];
  if (!stack || stack.length === 0) return false;
  const snapshot = stack.pop();
  if (currentMapKey === 'wilderness') {
    grid = snapshot.grid;
    dungeonMarker = snapshot.dungeonMarker;
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

function renderWilderness(ctx) {
  ctx.clearRect(0, 0, WORLD_W * CELL, WORLD_H * CELL);
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      ctx.fillStyle = TILE_COLORS[grid[y][x]] || '#000';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  if (checkOverlay) {
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const key = `${x},${y}`;
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
}

function paintAt(x, y) {
  const active = getActive();
  if (x < 0 || x >= active.w || y < 0 || y >= active.h) return;
  if (active.isWilderness && active.grid[y][x] === 'townEntrance') return;
  active.grid[y][x] = activeBrush;
  if (active.isWilderness) checkOverlay = null; // stale as soon as the terrain changes
}

function paintBrush(cx, cy) {
  const r = brushSize - 1;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (brushShape === 'circle' && Math.sqrt(dx * dx + dy * dy) > r + 0.5) continue;
      paintAt(cx + dx, cy + dy);
    }
  }
}

function saveAutosave() {
  try {
    const singleMaps = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || '{}').singleMaps || {};
    if (currentMapKey !== 'wilderness') singleMaps[currentMapKey] = singleGrid;
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ grid, dungeonMarker, singleMaps }));
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

function findTownEntrance() {
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (grid[y][x] === 'townEntrance') return { x, y };
    }
  }
  return null;
}

function cellPassable(passableKinds, x, y) {
  // The real game's mapScreen.js always renders the dungeon-entrance tile as
  // walkable at its exact marker position, regardless of the terrain painted
  // underneath - matching that here so the check reflects actual game behavior.
  if (dungeonMarker) {
    const world = localToWorld(dungeonMarker.screenId, dungeonMarker.x, dungeonMarker.y);
    if (world && world.wx === x && world.wy === y) return true;
  }
  return passableKinds.has(grid[y][x]);
}

function floodFillReachable(start, passableKinds) {
  const reached = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
      const key = `${nx},${ny}`;
      if (reached.has(key)) continue;
      if (!cellPassable(passableKinds, nx, ny)) continue;
      reached.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return reached;
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

  const toollessReached = floodFillReachable(town, TOOLLESS_PASSABLE_KINDS);
  const tooledReached = floodFillReachable(town, TOOLED_PASSABLE_KINDS);
  checkOverlay = { toollessReached, tooledReached };

  if (!dungeonMarker) {
    status.textContent = 'Map checked (no dungeon entrance placed yet).';
    status.className = '';
    return;
  }
  const world = localToWorld(dungeonMarker.screenId, dungeonMarker.x, dungeonMarker.y);
  const dKey = world ? `${world.wx},${world.wy}` : null;
  if (dKey && toollessReached.has(dKey)) {
    status.textContent = '✅ Dungeon entrance is reachable without any tool.';
    status.className = 'ok';
  } else if (dKey && tooledReached.has(dKey)) {
    status.textContent = "❌ NOT reachable without a tool — a thicket/mountain gate blocks the only path. This will soft-lock new players, since the axe/pick only drop inside the dungeon.";
    status.className = 'fail';
  } else {
    status.textContent = "❌ NOT reachable even with every tool — the dungeon area looks walled off (trees/water fully enclosing it, or a disconnected landmass). Double-check the surrounding terrain.";
    status.className = 'fail';
  }
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
    autosaveStatus.textContent = 'Restored unsaved changes from your last session.';
  } else {
    grid = await loadAllScreens();
  }
  if (!dungeonMarker) {
    const stateMod = await import('../../js/state.js');
    dungeonMarker = { ...stateMod.DEFAULT_DUNGEON_ENTRANCE_POSITION };
  }

  const dungeonReadout = document.getElementById('dungeonReadout');
  function updateDungeonReadout() {
    dungeonReadout.textContent = dungeonMarker
      ? `${dungeonMarker.screenId} (${dungeonMarker.x}, ${dungeonMarker.y})`
      : 'not set';
  }

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
    saveAutosave();
    render(ctx);
  }
  document.getElementById('undoBtn').addEventListener('click', doUndo);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      doUndo();
    }
  });

  const placeDungeonBtn = document.getElementById('placeDungeonBtn');
  placeDungeonBtn.addEventListener('click', () => {
    placingDungeon = !placingDungeon;
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
    pushUndoSnapshot();
    painting = true;
    paintBrush(x, y);
    render(ctx);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!painting || !currentPalette().includes(activeBrush)) return;
    const { x, y } = cellFromEvent(e);
    paintBrush(x, y);
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
}

init();
