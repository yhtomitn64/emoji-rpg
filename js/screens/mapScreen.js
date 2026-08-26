import { TILES } from '../tiles.js';
import { directionFromDelta, pickTileVariant, hash01 } from '../systems/world.js';
import { markVisited, isVisited, getVisitCount } from '../systems/exploration.js';
import { trailWearFraction, trailStrokeOpacity, trailStrokeWidth, trailDotRadius, edgeOwner, edgeJitter, connectorPathD, getTrailColor } from '../systems/trail.js';
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

// Non-moving obstacles render full-square and up (100-150% of a tile's own
// height, deterministic per position via hash01), tall enough to overlap
// into the row above - see .map-tile-obstacle in css/styles.css.
// mountainWall is deliberately excluded: it's the auto-sealed world-edge
// marker, not painted terrain, and should stay a plain, unmistakable wall.
const RANDOM_SIZE_OBSTACLES = new Set([TILES.tree, TILES.mountain, TILES.mountainCache, TILES.thicket, TILES.thicketCache]);
// Shared "fills the tile" reference size (cqb = % of the tile's own
// rendered height) - used both as the obstacles' 100% baseline (see
// OBSTACLE_MAX_EXTRA below) and, unscaled, for landmarks that should always
// read as prominent/findable rather than small: town and cave/dungeon
// entrances. The hero and loot get their own, slightly smaller size -
// see HERO_AND_LOOT_CQB.
const FULL_SQUARE_CQB = 85;
const HERO_AND_LOOT_CQB = 75;
const OBSTACLE_MAX_EXTRA = 0.5; // up to +50% (150% total, i.e. 50% overlap)

// Important landmarks the player needs to spot at a glance - always full
// size, never randomized/overlapping (unlike RANDOM_SIZE_OBSTACLES, these
// are single landmarks, not a forest of them).
const FULL_SQUARE_MARKERS = new Set([
  TILES.townEntrance,
  TILES.dungeonEntrance,
  TILES.axeDungeonEntrance,
  TILES.pickDungeonEntrance,
  TILES.canoeDungeonEntrance,
  TILES.miniDungeonEntrance,
  TILES.miniDungeonTreasure,
  // The town interior's own action tiles - previously missing from this
  // set, so they fell through to the tiny plain-text render (the
  // .map-tile's own 1.2rem font-size) instead of reading as landmarks.
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
]);

const SVG_NS = 'http://www.w3.org/2000/svg';
// Every trail fragment's SVG uses this fixed 0..100 coordinate space
// (independent of the tile's actual rendered pixel size) - trail.js's
// wear/geometry functions already return numbers on roughly this scale.
const TRAIL_VIEWBOX_SIZE = 100;
const TRAIL_DIRECTIONS = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];

// Grass decoration (clover/flower) sizing and placement: smaller than a
// full tile and scattered around it rather than dead-center, so a field of
// them reads as scattered growth instead of a uniform grid of icons.
const DECORATION_BASE_REM = 1.2;
const DECORATION_MIN_SCALE = 0.65;
const DECORATION_MAX_SCALE = 1.05;
const DECORATION_POSITION_MIN_PCT = 28;
const DECORATION_POSITION_MAX_PCT = 72;

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

function isPassableTile(t) {
  return Boolean(t) && (t.walkable || (t.requiresTool && hasRequiredTool(t, state.inventory)));
}

// A neighbor counts as "connected" for trail purposes if it's ground the
// player has actually walked (currently-passable and visited), OR it's a
// landmark tile (town/dungeon/tool-dungeon entrance, shop, well, ...) -
// every player has necessarily passed through one even though it never
// accumulates its own walk count (stepping onto it triggers a map-switch
// action before it would render as ordinary ground). See the "Entrance/
// landmark tiles" section of the design doc.
function isTrailConnected(nx, ny) {
  if (isOutOfBounds(nx, ny)) return false;
  const t = tileAt(nx, ny);
  if (!t) return false;
  if (FULL_SQUARE_MARKERS.has(t)) return true;
  return isPassableTile(t) && isVisited(state.visited, mapConfig.id, nx, ny);
}

// One tile's own trail fragment: a wavy stroke reaching toward each
// connected neighbor direction, or (if none are connected) a small
// centered dot - see docs/superpowers/specs/2026-08-25-worn-path-trail-
// design.md's "Rendering" and "Wear amount" sections.
function buildTrailFragment(x, y, dirs, fraction, color) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'map-tile-trail');
  svg.setAttribute('viewBox', `0 0 ${TRAIL_VIEWBOX_SIZE} ${TRAIL_VIEWBOX_SIZE}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  if (dirs.length === 0) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', TRAIL_VIEWBOX_SIZE / 2);
    circle.setAttribute('cy', TRAIL_VIEWBOX_SIZE / 2);
    circle.setAttribute('r', trailDotRadius(fraction));
    circle.setAttribute('fill', color);
    circle.setAttribute('opacity', trailStrokeOpacity(fraction));
    svg.appendChild(circle);
    return svg;
  }
  for (const dir of dirs) {
    const owner = edgeOwner(x, y, dir);
    const jitter = edgeJitter(owner.x, owner.y, owner.axis);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', connectorPathD(dir, jitter, TRAIL_VIEWBOX_SIZE));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', trailStrokeWidth(fraction));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', trailStrokeOpacity(fraction));
    svg.appendChild(path);
  }
  return svg;
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
      const hasMiniDungeon = hasMiniDungeonEntrance(state.miniDungeons, mapConfig.id, x, y);
      const hasTileCache = hasCache(state.caches, mapConfig.id, x, y);
      // A tile currently blocking the way is never shown as visited, even if
      // state.visited has a stale record from before the map was repainted
      // (the player really did stand on grass there once, but that record
      // shouldn't outlive the terrain it was standing on) - a permanent or
      // still-locked obstacle can never actually have been walked on.
      const isCurrentlyPassable = isPassableTile(tile);
      // Obstacles grow out of the grass, so they keep its green background
      // rather than looking like a hole cut in the field - see
      // RANDOM_SIZE_OBSTACLES above.
      cell.className = 'map-tile'
        + (tile === TILES.grass || RANDOM_SIZE_OBSTACLES.has(tile) ? ' map-tile-grass' : '')
        + (tile === TILES.water ? ' map-tile-water' : '')
        + (isPlayer ? ' map-tile-player' : '');
      // A tile's own worn-path trail: dirt strokes reaching toward whichever
      // neighbors are also visited (or a landmark everyone necessarily
      // passes through), or a small dot if nothing connects yet. Appended
      // first so it paints underneath every other branch below, same
      // "append earlier = paints behind" rule the decoration-behind-hero
      // fix uses.
      if (isCurrentlyPassable && isVisited(state.visited, mapConfig.id, x, y)) {
        const fraction = trailWearFraction(getVisitCount(state.visited, mapConfig.id, x, y));
        const color = getTrailColor(tile);
        const dirs = TRAIL_DIRECTIONS
          .filter(([, dx, dy]) => isTrailConnected(x + dx, y + dy))
          .map(([dir]) => dir);
        cell.appendChild(buildTrailFragment(x, y, dirs, fraction, color));
      }
      // Depth-sort by row instead of a fixed always-on-top/always-behind
      // z-index: a row's cells sit above every cell in the row above it, so
      // a tall obstacle's canopy (which overflows upward into the row
      // above, see .map-tile-obstacle) correctly paints over whatever's
      // there - including the player - while a player standing in a row
      // below an obstacle still renders in front of it, same as any other
      // ground content would.
      cell.style.zIndex = String(y);
      const emoji = hasMiniDungeon ? MINI_DUNGEON_MARKER_EMOJI : hasTileCache ? CACHE_MARKER_EMOJI : pickTileVariant(tile, x, y);
      const mountEmoji = isPlayer && tile.requiresTool && hasRequiredTool(tile, state.inventory)
        ? MOUNT_EMOJI_FOR_TOOL[tile.requiresTool] : null;
      const isRandomSizeObstacle = !hasMiniDungeon && !hasTileCache && RANDOM_SIZE_OBSTACLES.has(tile);
      const isFullSquareMarker = hasMiniDungeon || hasTileCache || FULL_SQUARE_MARKERS.has(tile);
      const isDecoratedGrass = !isFullSquareMarker && tile === TILES.grass && emoji !== '';
      // Appended before the hero/marker span below (when both apply to the
      // same tile) so the decoration sits underneath it in paint order,
      // peeking out from around the edges instead of hiding whatever's
      // standing on the tile.
      function appendDecoration() {
        const decoration = document.createElement('span');
        decoration.className = 'map-tile-decoration';
        decoration.textContent = emoji;
        // Independently-salted hash streams so size and position don't
        // move in lockstep with each other or with the decoration pick.
        const scale = DECORATION_MIN_SCALE + hash01(x + 1000, y + 1000) * (DECORATION_MAX_SCALE - DECORATION_MIN_SCALE);
        const left = DECORATION_POSITION_MIN_PCT + hash01(x + 2000, y + 2000) * (DECORATION_POSITION_MAX_PCT - DECORATION_POSITION_MIN_PCT);
        const top = DECORATION_POSITION_MIN_PCT + hash01(x + 3000, y + 3000) * (DECORATION_POSITION_MAX_PCT - DECORATION_POSITION_MIN_PCT);
        decoration.style.fontSize = `${(DECORATION_BASE_REM * scale).toFixed(2)}rem`;
        decoration.style.left = `${left.toFixed(1)}%`;
        decoration.style.top = `${top.toFixed(1)}%`;
        cell.appendChild(decoration);
      }
      if (mountEmoji) {
        const mount = document.createElement('span');
        mount.className = 'map-tile-mount';
        mount.textContent = mountEmoji;
        const rider = document.createElement('span');
        rider.className = 'map-tile-rider';
        rider.textContent = state.player.emoji;
        cell.append(mount, rider);
      } else if (isRandomSizeObstacle) {
        const obstacle = document.createElement('span');
        obstacle.className = 'map-tile-obstacle';
        obstacle.textContent = emoji;
        const size = FULL_SQUARE_CQB * (1 + hash01(x, y) * OBSTACLE_MAX_EXTRA);
        obstacle.style.fontSize = `${size.toFixed(1)}cqb`;
        cell.appendChild(obstacle);
      } else if (isFullSquareMarker || isPlayer) {
        // The hero can land on a decorated grass tile - render the
        // decoration first so it still peeks out from behind the hero
        // instead of the hero vanishing behind it (the old bug: this
        // branch used to be checked *after* isDecoratedGrass, so the
        // decoration won outright and hid the player entirely).
        if (isDecoratedGrass) appendDecoration();
        // The hero is always full-square. cqb units only resolve against
        // the nearest ANCESTOR query container - .map-tile establishes
        // that containment itself, so this has to be a child span, not a
        // class on the cell, or cqb falls through past it to the
        // viewport (an early version of this did exactly that).
        const marker = document.createElement('span');
        marker.className = 'map-tile-fullsize';
        marker.textContent = isPlayer ? state.player.emoji : emoji;
        // Hero and loot read better a touch smaller than town/cave
        // entrances - the CSS class's own font-size (FULL_SQUARE_CQB)
        // stays the default for everything else in this branch.
        const isHeroOrLoot = isPlayer || hasTileCache || tile === TILES.miniDungeonTreasure;
        if (isHeroOrLoot) marker.style.fontSize = `${HERO_AND_LOOT_CQB}cqb`;
        cell.appendChild(marker);
      } else if (isDecoratedGrass) {
        appendDecoration();
      } else {
        cell.textContent = emoji;
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
