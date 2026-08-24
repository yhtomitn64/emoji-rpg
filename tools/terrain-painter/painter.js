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
  mountain: '#8a8a8a',
  mountainCache: '#c9a227',
  thicket: '#2f5d34',
  thicketCache: '#c9a227',
  townEntrance: '#d9534f',
};

const CHAR_FOR_KIND = {
  grass: '.', tree: '#', water: '~', mountain: 'M', mountainCache: 'K',
  thicket: 'T', thicketCache: 'X', townEntrance: '@',
};

const PAINTABLE_KINDS = new Set(['grass', 'tree', 'water', 'mountain', 'mountainCache', 'thicket', 'thicketCache']);
const AUTOSAVE_KEY = 'terrain-painter-autosave-v1';

let grid = [];
let activeBrush = 'grass';
let painting = false;
let brushSize = 1; // radius in cells - 1 means "just the cell under the cursor"
let brushShape = 'square';
let dungeonMarker = null; // { screenId, x, y } - the one fixed dungeon entrance spot
let placingDungeon = false;

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

function render(ctx) {
  ctx.clearRect(0, 0, WORLD_W * CELL, WORLD_H * CELL);
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      ctx.fillStyle = TILE_COLORS[grid[y][x]] || '#000';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
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

function paintAt(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
  if (grid[y][x] === 'townEntrance') return;
  grid[y][x] = activeBrush;
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
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ grid, dungeonMarker }));
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
    return Array.isArray(parsed) ? { grid: parsed, dungeonMarker: null } : parsed;
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

function exportScreen(id) {
  const pos = GRID_LAYOUT[id];
  const originX = pos.col * SCREEN_W;
  const originY = pos.row * SCREEN_H;
  const usedKinds = new Set();
  const rows = [];
  for (let y = 0; y < SCREEN_H; y++) {
    let row = '';
    for (let x = 0; x < SCREEN_W; x++) {
      const kind = grid[originY + y][originX + x];
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

async function init() {
  const canvas = document.getElementById('worldCanvas');
  const ctx = canvas.getContext('2d');
  const autosaveStatus = document.getElementById('autosaveStatus');

  const saved = loadAutosave();
  if (saved) {
    grid = saved.grid;
    dungeonMarker = saved.dungeonMarker;
    autosaveStatus.textContent = 'Restored unsaved changes from your last session.';
  } else {
    grid = await loadAllScreens();
  }
  if (!dungeonMarker) {
    const stateMod = await import('../../js/state.js');
    dungeonMarker = { ...stateMod.DEFAULT_DUNGEON_ENTRANCE_POSITION };
  }
  render(ctx);

  const dungeonReadout = document.getElementById('dungeonReadout');
  function updateDungeonReadout() {
    dungeonReadout.textContent = dungeonMarker
      ? `${dungeonMarker.screenId} (${dungeonMarker.x}, ${dungeonMarker.y})`
      : 'not set';
  }
  updateDungeonReadout();

  document.getElementById('resetFromFilesBtn').addEventListener('click', async () => {
    if (!confirm('Discard all unexported changes and reload the real files from disk?')) return;
    clearAutosave();
    grid = await loadAllScreens();
    const stateMod = await import('../../js/state.js');
    dungeonMarker = { ...stateMod.DEFAULT_DUNGEON_ENTRANCE_POSITION };
    updateDungeonReadout();
    autosaveStatus.textContent = 'Reloaded from files.';
    render(ctx);
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

  document.querySelectorAll('#palette button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeBrush = btn.dataset.kind;
      document.querySelectorAll('#palette button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelector('#palette button[data-kind="grass"]').classList.add('active');

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
    if (placingDungeon) {
      const local = worldToLocal(x, y);
      if (local) {
        dungeonMarker = local;
        updateDungeonReadout();
        saveAutosave();
      }
      placingDungeon = false;
      placeDungeonBtn.classList.remove('active');
      canvas.classList.remove('placing-dungeon');
      render(ctx);
      return;
    }
    painting = true;
    paintBrush(x, y);
    render(ctx);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!painting || !PAINTABLE_KINDS.has(activeBrush)) return;
    const { x, y } = cellFromEvent(e);
    paintBrush(x, y);
    render(ctx);
  });
  window.addEventListener('mouseup', () => {
    // Autosave once per stroke (not per mousemove) - JSON-serializing the
    // full 150x110 grid on every pixel of a drag would be needlessly slow.
    if (painting) saveAutosave();
    painting = false;
  });

  const exportSelect = document.getElementById('exportSelect');
  for (const id of Object.keys(GRID_LAYOUT)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    exportSelect.appendChild(opt);
  }

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const text = exportScreen(exportSelect.value);
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
