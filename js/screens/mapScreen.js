import { TILES } from '../tiles.js';

let rootEl = null;
let state = null;
let mapConfig = null;
let callbacks = null;

const KEY_TO_DELTA = {
  ArrowUp: [0, -1], w: [0, -1],
  ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0],
};

function tileAt(x, y) {
  const row = mapConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  return TILES[mapConfig.legend[char]];
}

function render() {
  const cols = mapConfig.rows[0].length;
  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let y = 0; y < mapConfig.rows.length; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = document.createElement('div');
      cell.className = 'map-tile';
      const tile = tileAt(x, y);
      const isPlayer = state.position.x === x && state.position.y === y;
      cell.textContent = isPlayer ? '🧑' : tile.emoji;
      grid.appendChild(cell);
    }
  }

  rootEl.innerHTML = '';
  rootEl.appendChild(grid);
}

function tryMove(dx, dy) {
  const nx = state.position.x + dx;
  const ny = state.position.y + dy;
  const tile = tileAt(nx, ny);
  if (!tile || !tile.walkable) return;

  state.position = { x: nx, y: ny };
  callbacks.onMove(state.position);

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    callbacks.onEncounter(monsterId);
    return;
  }

  render();
}

function handleKeydown(event) {
  const delta = KEY_TO_DELTA[event.key];
  if (!delta) return;
  tryMove(delta[0], delta[1]);
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  callbacks = props.callbacks;
  render();
  window.addEventListener('keydown', handleKeydown);
}

export function unmount() {
  window.removeEventListener('keydown', handleKeydown);
}
