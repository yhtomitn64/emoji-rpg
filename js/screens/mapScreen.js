import { TILES } from '../tiles.js';
import { directionFromDelta } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance } from '../systems/miniDungeons.js';
import { resolveStepDiscovery } from '../systems/discovery.js';
import { hasRequiredTool, getLockedGateMessage, getToolClearedMessage, isGateRewardCollected, markGateRewardCollected, rollGateReward } from '../systems/toolGates.js';

const CACHE_MARKER_EMOJI = '💰';
const MINI_DUNGEON_MARKER_EMOJI = '⛏️';
const CACHE_MARKER_DESCRIPTION = 'A stash of gold (maybe an item too) — step here to collect it';
const MINI_DUNGEON_MARKER_DESCRIPTION = 'A mysterious opening — explore it';

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
      const hasMiniDungeon = hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, x, y);
      const hasTileCache = hasCache(state.caches, mapConfig.id, x, y);
      const emoji = hasMiniDungeon ? MINI_DUNGEON_MARKER_EMOJI : hasTileCache ? CACHE_MARKER_EMOJI : tile.emoji;
      cell.textContent = isPlayer ? state.player.emoji : emoji;
      cell.title = hasMiniDungeon ? MINI_DUNGEON_MARKER_DESCRIPTION : hasTileCache ? CACHE_MARKER_DESCRIPTION : tile.description;
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
  if (!tile) return;
  if (!tile.walkable) {
    if (!tile.requiresTool) return;
    if (!hasRequiredTool(tile, state.inventory)) {
      callbacks.onLockedGate(getLockedGateMessage(tile.requiresTool));
      return;
    }
    callbacks.onToolGateCleared(getToolClearedMessage(tile.requiresTool));
  }

  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, nx, ny) });

  const discovery = resolveStepDiscovery(state, mapConfig, nx, ny, tile);
  if (discovery.miniDungeons) {
    Object.assign(state, { miniDungeons: discovery.miniDungeons });
  }
  if (discovery.caches) {
    Object.assign(state, { caches: discovery.caches });
  }

  let gateReward = null;
  if (tile.hasReward && !isGateRewardCollected(state.gateRewards, mapConfig.id, nx, ny)) {
    Object.assign(state, { gateRewards: markGateRewardCollected(state.gateRewards, mapConfig.id, nx, ny) });
    gateReward = rollGateReward();
  }

  // Render before firing any callback: an action may swap screens and an
  // encounter opens a battle *overlay* on top of this still-mounted map, so the
  // world underneath must already show the tile the player just stepped onto
  // (including a freshly discovered cache or mini-dungeon marker).
  render();

  callbacks.onMove(state.position);

  if (gateReward) {
    callbacks.onGateReward(gateReward);
    return;
  }

  if (tile.action) {
    callbacks.onAction(tile.action);
    return;
  }

  if (discovery.outcome === 'enterMiniDungeon') {
    callbacks.onEnterMiniDungeon(mapConfig.id, nx, ny);
    return;
  }

  if (discovery.outcome === 'cache') {
    callbacks.onCacheFound(discovery.cacheLoot);
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
