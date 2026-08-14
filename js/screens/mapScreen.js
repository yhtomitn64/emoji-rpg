import { TILES } from '../tiles.js';
import { directionFromDelta } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache, recordCache, rollCacheLoot, shouldRevealCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance, recordMiniDungeonEntrance, shouldRevealMiniDungeon, pickMiniDungeonVariant } from '../systems/miniDungeons.js';

const CACHE_MARKER_EMOJI = '📦';
const MINI_DUNGEON_MARKER_EMOJI = '⛏️';

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

function isOutOfBounds(x, y) {
  return y < 0 || y >= mapConfig.rows.length || x < 0 || x >= mapConfig.rows[0].length;
}

function render() {
  const cols = mapConfig.rows[0].length;
  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let y = 0; y < mapConfig.rows.length; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = document.createElement('div');
      const tile = tileAt(x, y);
      const isPlayer = state.position.x === x && state.position.y === y;
      cell.className = 'map-tile' + (isVisited(state.visited, mapConfig.id, x, y) ? ' visited' : '');
      const emoji = hasCache(state.caches, mapConfig.id, x, y)
        ? CACHE_MARKER_EMOJI
        : hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, x, y)
        ? MINI_DUNGEON_MARKER_EMOJI
        : tile.emoji;
      cell.textContent = isPlayer ? '🧑' : emoji;
      grid.appendChild(cell);
    }
  }

  rootEl.innerHTML = '';
  rootEl.appendChild(grid);
}

function tryMove(dx, dy) {
  const nx = state.position.x + dx;
  const ny = state.position.y + dy;

  if (isOutOfBounds(nx, ny)) {
    const direction = directionFromDelta(dx, dy);
    const neighborId = mapConfig.neighbors && mapConfig.neighbors[direction];
    if (neighborId) {
      callbacks.onEdgeTransition(neighborId, direction, { ...state.position });
    }
    return;
  }

  const tile = tileAt(nx, ny);
  if (!tile || !tile.walkable) return;

  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });

  let cacheLoot = null;
  let enteringMiniDungeon = false;
  // Safe only because no tile.action tile also has tile.encounter: true (see js/tiles.js) — an
  // action tile hitting this branch would record a cache or mini-dungeon entrance with no
  // reward/entry ever delivered.
  if (tile.encounter && hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, nx, ny)) {
    enteringMiniDungeon = true;
  } else if (tile.encounter && shouldRevealMiniDungeon(state.miniDungeons, mapConfig.id, nx, ny, mapConfig.miniDungeonChance)) {
    const variantId = pickMiniDungeonVariant();
    Object.assign(state, { miniDungeons: recordMiniDungeonEntrance(state.miniDungeons, mapConfig.id, nx, ny, variantId) });
    enteringMiniDungeon = true;
  } else if (tile.encounter && shouldRevealCache(state.caches, mapConfig.id, nx, ny, mapConfig.cacheChance)) {
    Object.assign(state, { caches: recordCache(state.caches, mapConfig.id, nx, ny) });
    cacheLoot = rollCacheLoot();
  }

  // Render before firing any callback: an action may swap screens and an
  // encounter opens a battle *overlay* on top of this still-mounted map, so the
  // world underneath must already show the tile the player just stepped onto
  // (including a freshly discovered cache or mini-dungeon marker).
  render();

  callbacks.onMove(state.position);

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (enteringMiniDungeon) {
    callbacks.onEnterMiniDungeon(mapConfig.id, nx, ny);
    return;
  }

  if (cacheLoot) {
    callbacks.onCacheFound(cacheLoot);
    return;
  }

  if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    callbacks.onEncounter(monsterId);
  }
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
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, state.position.x, state.position.y) });
  render();
  if (!hasSeenScreen(state.seenScreens, mapConfig.id)) {
    Object.assign(state, { seenScreens: markScreenSeen(state.seenScreens, mapConfig.id) });
    callbacks.onFirstVisit(mapConfig.id);
  }
  window.addEventListener('keydown', handleKeydown);
}

export function unmount() {
  window.removeEventListener('keydown', handleKeydown);
}

export function pause() {
  window.removeEventListener('keydown', handleKeydown);
}

export function resume() {
  window.addEventListener('keydown', handleKeydown);
}
