import { TILES } from '../tiles.js';
import { directionFromDelta, pickTileVariant } from '../systems/world.js';
import { markVisited, isVisited } from '../systems/exploration.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance } from '../systems/miniDungeons.js';
import { resolveStepDiscovery } from '../systems/discovery.js';
import { hasRequiredTool, getLockedGateMessage, getToolClearedMessage, getGateProximityMessage, hasShownGateHint, markGateHintShown, isGateRewardCollected, markGateRewardCollected, rollGateReward } from '../systems/toolGates.js';
import { rollEncounterGroup } from '../systems/groupEncounters.js';
import { rollEliteEncounter, ELITE_MONSTER_ID } from '../systems/eliteEncounter.js';
import { TOOL_DUNGEON_ENTRANCES } from '../data/toolDungeons.js';

const CACHE_MARKER_EMOJI = '💰';
const MINI_DUNGEON_MARKER_EMOJI = '⛏️';
const CACHE_MARKER_DESCRIPTION = 'A stash of gold (maybe an item too) — step here to collect it';
const MINI_DUNGEON_MARKER_DESCRIPTION = 'A mysterious opening — explore it';
// Tool-gated tiles the player can currently cross render a "mount" emoji
// under the player's own emoji instead of replacing it (e.g. riding the
// boat across water rather than turning into a boat).
const MOUNT_EMOJI_FOR_TOOL = { boat: '🛶' };

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

// Whichever terrain a screen's true outer world-edge (a side with no
// neighbor at all - the literal boundary of the 5x5 wilderness grid) happens
// to have painted on it doesn't matter for actually leaving the map:
// handleEdgeTransition already refuses to cross when neighbors[side] is
// null, regardless of tile content. This makes the *visual* seal automatic
// too, so a sealed edge never depends on remembering to paint it - every
// true boundary cell always renders as mountainWall, overriding whatever
// terrain is actually in the file there.
function isSealedWorldEdge(x, y) {
  if (!mapConfig.neighbors) return false;
  const width = mapConfig.rows[0].length;
  const height = mapConfig.rows.length;
  if (y === 0 && !mapConfig.neighbors.north) return true;
  if (y === height - 1 && !mapConfig.neighbors.south) return true;
  if (x === 0 && !mapConfig.neighbors.west) return true;
  if (x === width - 1 && !mapConfig.neighbors.east) return true;
  return false;
}

function tileAt(x, y) {
  const entrance = state.dungeonEntrancePosition;
  if (entrance && mapConfig.id === entrance.screenId && x === entrance.x && y === entrance.y) {
    return TILES.dungeonEntrance;
  }
  for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
    if (mapConfig.id === toolEntrance.screenId && x === toolEntrance.x && y === toolEntrance.y) {
      return TILES[toolEntrance.tileKind];
    }
  }
  if (isSealedWorldEdge(x, y)) return TILES.mountainWall;
  const row = mapConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  return TILES[mapConfig.legend[char]];
}

function isOutOfBounds(x, y) {
  return y < 0 || y >= mapConfig.rows.length || x < 0 || x >= mapConfig.rows[0].length;
}

const NEIGHBOR_DELTAS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function checkGateProximity(x, y) {
  for (const [dx, dy] of NEIGHBOR_DELTAS) {
    const nx = x + dx;
    const ny = y + dy;
    if (isOutOfBounds(nx, ny)) continue;
    const neighborTile = tileAt(nx, ny);
    if (!neighborTile || !neighborTile.requiresTool) continue;
    if (hasShownGateHint(state.toolGateHintsShown, mapConfig.id, nx, ny)) continue;

    Object.assign(state, { toolGateHintsShown: markGateHintShown(state.toolGateHintsShown, mapConfig.id, nx, ny) });
    const hasTool = hasRequiredTool(neighborTile, state.inventory);
    callbacks.onToolGateNearby(getGateProximityMessage(neighborTile.requiresTool, hasTool));
    return;
  }
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
      cell.className = 'map-tile'
        + (isVisited(state.visited, mapConfig.id, x, y) ? ' visited' : '')
        + (isPlayer ? ' map-tile-player' : '');
      const hasMiniDungeon = hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, x, y);
      const hasTileCache = hasCache(state.caches, mapConfig.id, x, y);
      const emoji = hasMiniDungeon ? MINI_DUNGEON_MARKER_EMOJI : hasTileCache ? CACHE_MARKER_EMOJI : pickTileVariant(tile, x, y);
      const mountEmoji = isPlayer && tile.requiresTool && hasRequiredTool(tile, state.inventory)
        ? MOUNT_EMOJI_FOR_TOOL[tile.requiresTool] : null;
      if (mountEmoji) {
        const mount = document.createElement('span');
        mount.className = 'map-tile-mount';
        mount.textContent = mountEmoji;
        const rider = document.createElement('span');
        rider.className = 'map-tile-rider';
        rider.textContent = state.player.emoji;
        cell.append(mount, rider);
      } else {
        cell.textContent = isPlayer ? state.player.emoji : emoji;
      }
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
  checkGateProximity(nx, ny);

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
    // A flat 5% chance for any encounter (wilderness or dungeon) to be the
    // rare elite instead of the normal roll - always solo, bypassing the
    // multi-mob grouping below entirely. The empty-override array (matching
    // the boss-fight pattern) tells handleEncounter this monster's stats are
    // already final, skipping the random stat-variant roll.
    if (rollEliteEncounter()) {
      callbacks.onEncounter([ELITE_MONSTER_ID], [{}]);
      return;
    }
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts);
    callbacks.onEncounter(monsterIds);
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

const LEVEL_UP_EFFECT_DURATION_MS = 1200;

// A level-up always resolves right after a battle overlay unmounts, which
// leaves this screen's last-rendered grid (from before the battle started)
// still in the DOM and resumed underneath - the player's cell is safe to
// grab directly rather than needing a fresh render().
export function playLevelUpEffect() {
  const playerCell = rootEl?.querySelector('.map-tile-player');
  if (!playerCell) return;

  playerCell.classList.remove('map-tile-levelup');
  void playerCell.offsetWidth; // force reflow so re-triggering restarts the animation
  playerCell.classList.add('map-tile-levelup');

  const rays = document.createElement('div');
  rays.className = 'map-levelup-rays';
  playerCell.appendChild(rays);

  setTimeout(() => {
    playerCell.classList.remove('map-tile-levelup');
    rays.remove();
  }, LEVEL_UP_EFFECT_DURATION_MS);
}

const MONSTER_FLEE_EFFECT_DURATION_MS = 700;
const MONSTER_FLEE_DISTANCE_PX = 120;

// Fired for a weak-mob encounter that resolves (surrender/flee) before the
// battle dialog ever opens - the player still gets to see the monster
// appear and immediately bail, rather than nothing happening at all.
export function playMonsterFleeEffect(emoji) {
  const playerCell = rootEl?.querySelector('.map-tile-player');
  if (!playerCell) return;
  const rect = playerCell.getBoundingClientRect();
  const el = document.createElement('div');
  el.textContent = emoji;
  el.className = 'map-flee-emoji';
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(el);
  const angle = Math.random() * Math.PI * 2;
  const dx = Math.cos(angle) * MONSTER_FLEE_DISTANCE_PX;
  const dy = Math.sin(angle) * MONSTER_FLEE_DISTANCE_PX;
  const animation = el.animate(
    [
      { transform: 'translate(-50%, -50%) translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 },
    ],
    { duration: MONSTER_FLEE_EFFECT_DURATION_MS, easing: 'ease-in' },
  );
  animation.onfinish = () => el.remove();
}
