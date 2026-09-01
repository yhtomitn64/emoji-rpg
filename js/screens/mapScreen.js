import { TILES } from '../tiles.js';
import { pickTileVariant, hash01, isChokepointTile, computeViewportOrigin } from '../systems/world.js';
import { screenToGlobal, globalToScreen, clusterBounds } from '../systems/worldGrid.js';
import { markVisited, markDirection, isVisited, getVisitCount, getVisitDirs } from '../systems/exploration.js';
import { trailWearFraction, trailStrokeWidthBetween, trailBorderFraction, trailDotRadius, trailHubRadius, edgeOwner, edgeJitter, edgeTargetPoint, connectorPathD, getTrailColor, getGroundColor, trailColorForFraction } from '../systems/trail.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance } from '../systems/miniDungeons.js';
import { resolveStepDiscovery } from '../systems/discovery.js';
import { hasRequiredTool, getLockedGateMessage, getToolClearedMessage, getGateProximityMessage, hasShownGateHint, markGateHintShown, isGateRewardCollected, markGateRewardCollected, rollGateReward, isGateCleared, markGateCleared } from '../systems/toolGates.js';
import { rollEncounterGroup } from '../systems/groupEncounters.js';
import { rollEliteEncounter, ELITE_MONSTER_ID } from '../systems/eliteEncounter.js';
import { TOOL_DUNGEON_ENTRANCES } from '../data/toolDungeons.js';
import { hasAnyQuestReady } from '../systems/quests.js';
import { TOWN_PORTAL_POSITION } from '../systems/portal.js';

// Raised 2026-08-29: random encounters had no memory of the last one, so
// two fights on consecutive steps was always possible (just rare per-pair -
// e.g. 15% * 15% = 2.25%) and felt bad when it landed. Guarantees this many
// encounter-free steps immediately after any random encounter fires -
// doesn't apply to tile-triggered fights (guardians, the boss) since those
// are deterministic, not random rolls.
const ENCOUNTER_COOLDOWN_STEPS = 2;

const CACHE_MARKER_EMOJI = '💰';
const MINI_DUNGEON_MARKER_EMOJI = '🥾';
const CACHE_MARKER_DESCRIPTION = 'A stash of gold (maybe an item too) — step here to collect it';
const MINI_DUNGEON_MARKER_DESCRIPTION = 'A mysterious opening — explore it';
// Tool-gated tiles the player can currently cross render a "mount" emoji
// under the player's own emoji instead of replacing it (e.g. riding the
// boat across water rather than turning into a boat).
const MOUNT_EMOJI_FOR_TOOL = { boat: '🛶' };

// Non-moving obstacles render full-square and up (100-150% of a tile's own
// height, deterministic per position via hash01), tall enough to overlap
// into the row above - see .map-tile-obstacle in css/styles.css.
// mountainWall was originally excluded on the assumption it's only the
// auto-sealed world-edge marker, not painted terrain - that assumption was
// wrong (10 wilderness screens paint it directly as real interior terrain
// via their own LEGEND, e.g. js/maps/wilderness/south.js's 'W'), and it's
// exactly the "the ones you can never pass" mountain Timothy meant (raised
// 2026-08-28: "Mountains look small... no background under them"), unlike
// mountain/mountainCache below which do clear with a pick. Included here so
// it gets the same natural sizing as every other obstacle, both painted
// and at the auto-sealed edge.
const RANDOM_SIZE_OBSTACLES = new Set([TILES.tree, TILES.mountain, TILES.mountainCache, TILES.mountainWall, TILES.thicket, TILES.thicketCache]);
// Shared "fills the tile" reference size (cqb = % of the tile's own
// rendered height) - used both as the obstacles' 100% baseline (see
// OBSTACLE_MAX_EXTRA below) and, unscaled, for landmarks that should always
// read as prominent/findable rather than small: town and cave/dungeon
// entrances. The hero and loot get their own, slightly smaller size -
// see HERO_AND_LOOT_CQB.
const FULL_SQUARE_CQB = 85;
const HERO_AND_LOOT_CQB = 75;
const OBSTACLE_MAX_EXTRA = 0.5; // up to +50% (150% total, i.e. 50% overlap)

// Fixed real pixel size for every tile - the viewport's own CSS size
// (.map-viewport in css/styles.css) then determines how many whole tiles
// fit, which is what makes a smaller window/screen naturally show less of
// the stitched world. Tunable; not load-bearing for correctness.
const TILE_SIZE_PX = 48;
// jsdom has no real layout engine (tests/helpers/dom.js), so
// .clientWidth/.clientHeight always read 0 there - this is the fallback
// viewport size used whenever a real measurement isn't available, keeping
// DOM tests deterministic without needing to stub layout. Not a real-browser
// floor (see css/styles.css - .map-viewport fills whatever space #app has,
// no fixed cap) - chosen only because it clears dungeonMap's 20x11 (the
// widest/tallest non-wilderness map) with margin, same as any normal
// desktop window comfortably does today.
const DEFAULT_VIEWPORT_TILES_WIDE = 21;
const DEFAULT_VIEWPORT_TILES_TALL = 13;

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

// The subset of FULL_SQUARE_MARKERS above that always sit on a grass
// floor (every map that places them - town, wilderness, the dragon
// dungeon, the tool dungeons - has '.': 'grass' in its own LEGEND; see
// e.g. js/maps/townMap.js). Deliberately excludes miniDungeonEntrance/
// miniDungeonTreasure: those only ever appear inside a mini-dungeon
// interior, which uses caveFloor instead (js/maps/miniDungeons/*.js) -
// giving them the grass class would paint them green inside a cave. Each
// of these tiles is its own distinct type in the map's own ROWS grid
// (not an overlay on top of a separate grass tile), so it never matched
// `tile === TILES.grass` below and fell through to .map-tile's bare
// default background instead of grass - showing as a dark box with no
// green underneath, raised by Timothy 2026-08-26 (see BACKLOG.md).
const GRASS_CONTEXT_MARKERS = new Set([
  TILES.townEntrance,
  TILES.dungeonEntrance,
  TILES.axeDungeonEntrance,
  TILES.pickDungeonEntrance,
  TILES.canoeDungeonEntrance,
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
]);

// A cleared thicket/mountain (see CLEARED_GATE_REPLACEMENT below) reads as
// ordinary ground with a small always-visible marker, the same treatment as
// grass's own occasional clover/flower - not a tall obstacle (unlike the
// thicket/mountain it replaces) and not a big single landmark either, so it
// shares grass's own decoration/background code path rather than either of
// those. Deliberately unconditional (same map-context-agnostic treatment
// RANDOM_SIZE_OBSTACLES already gives thicket/mountain themselves, e.g. the
// axe-gated thicket inside the dragon dungeon) rather than trying to match
// whichever floor tile (grass vs. cave) happens to sit underneath.
const STUMP_AND_RUBBLE = new Set([TILES.stump, TILES.rubble]);

// What a thicket/mountain permanently becomes the first time it's crossed
// with the right tool - see js/systems/toolGates.js's isGateCleared/
// markGateCleared and this file's tileAt(). Water is deliberately absent:
// canoeing across it shouldn't change the tile at all (raised 2026-08-28).
const CLEARED_GATE_REPLACEMENT = new Map([
  [TILES.thicket, TILES.stump],
  [TILES.thicketCache, TILES.stump],
  [TILES.mountain, TILES.rubble],
  [TILES.mountainCache, TILES.rubble],
]);

const SVG_NS = 'http://www.w3.org/2000/svg';
// Every trail fragment's SVG uses this fixed 0..100 coordinate space
// (independent of the tile's actual rendered pixel size) - trail.js's
// wear/geometry functions already return numbers on roughly this scale.
// preserveAspectRatio="none" (set on the <svg> below) stretches that square
// coordinate space to fit the tile's actual rendered box uniformly only
// because .map-tile has `aspect-ratio: 1` in css/styles.css - a non-square
// tile would shear the strokes non-uniformly.
const TRAIL_VIEWBOX_SIZE = 100;
const TRAIL_DIRECTIONS = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
const TRAIL_DIR_DELTA = Object.fromEntries(TRAIL_DIRECTIONS.map(([dir, dx, dy]) => [dir, [dx, dy]]));
const TRAIL_OPPOSITE_DIR = { n: 's', s: 'n', e: 'w', w: 'e' };

// A move's own short direction code (matching trail.js's 'n'/'s'/'e'/'w'
// convention), from its (dx, dy) - used to record which edge a step
// actually crossed, on both the tile being left and the tile being
// entered. Returns null for a non-cardinal delta, which never happens in
// practice (every call site's dx/dy comes from KEY_TO_DELTA), but there's
// no reason to trust that invariant blindly here.
function trailDirFromDelta(dx, dy) {
  const found = TRAIL_DIRECTIONS.find(([, ddx, ddy]) => ddx === dx && ddy === dy);
  return found ? found[0] : null;
}

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
let maps = null;
let worldGrid = null;
let callbacks = null;

const KEY_TO_DELTA = {
  ArrowUp: [0, -1], w: [0, -1],
  ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0],
};

// No "zone" concept exists in the map registry (js/main.js's MAPS object is
// a flat list) - this is the explicit list of the 24 wilderness screens
// ("zone 1"), deliberately excluding center (the town screen itself,
// monsterTable: [], no encounters ever roll there) and every dungeon/
// mini-dungeon. Used only to decide whether a step counts toward
// state.zone1Steps (js/systems/groupEncounters.js's effectiveGroupSizeMax
// escalation) - see docs/superpowers/specs/2026-08-30-bigger-mixed-monster-
// groups-design.md.
const ZONE1_WILDERNESS_MAP_IDS = new Set([
  'north', 'south', 'east', 'west',
  'northeast', 'northwest', 'southeast', 'southwest',
  'farNorthwest', 'northNorthwest', 'farNorth', 'northNortheast', 'farNortheast',
  'westNorthwest', 'farWest', 'westSouthwest',
  'eastNortheast', 'farEast', 'eastSoutheast',
  'southSouthwest', 'farSouth', 'southSoutheast',
  'farSouthwest', 'farSoutheast',
]);

// Whichever terrain a screen's true outer world-edge (a side with no
// neighbor at all - the literal boundary of the 5x5 wilderness grid) happens
// to have painted on it doesn't matter for actually leaving the map: this
// override makes every true boundary cell render as mountainWall (not
// walkable, no requiresTool), so tryMove's own `!tile.walkable` check is
// what blocks a step off the edge of the world - the seal is self-enforcing
// via the same tile-passability path as any other obstacle, not a separate
// mechanism resting on some other function refusing the crossing. This also
// makes the seal automatic visually, so it never depends on remembering to
// paint it - every true boundary cell overrides whatever terrain is
// actually in the file there.
function isSealedWorldEdge(screenConfig, x, y) {
  if (!screenConfig.neighbors) return false;
  const width = screenConfig.rows[0].length;
  const height = screenConfig.rows.length;
  if (y === 0 && !screenConfig.neighbors.north) return true;
  if (y === height - 1 && !screenConfig.neighbors.south) return true;
  if (x === 0 && !screenConfig.neighbors.west) return true;
  if (x === width - 1 && !screenConfig.neighbors.east) return true;
  return false;
}

function tileAt(screenConfig, x, y) {
  const entrance = state.dungeonEntrancePosition;
  if (entrance && screenConfig.id === entrance.screenId && x === entrance.x && y === entrance.y) {
    return TILES.dungeonEntrance;
  }
  for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
    if (screenConfig.id === toolEntrance.screenId && x === toolEntrance.x && y === toolEntrance.y) {
      return TILES[toolEntrance.tileKind];
    }
  }
  if (state.portal && screenConfig.id === state.portal.originScreenId && x === state.portal.originX && y === state.portal.originY) {
    return TILES.portalOrigin;
  }
  if (state.portal && state.portal.returnPending && screenConfig.id === 'town' && x === TOWN_PORTAL_POSITION.x && y === TOWN_PORTAL_POSITION.y) {
    return TILES.portalReturn;
  }
  if (isSealedWorldEdge(screenConfig, x, y)) return TILES.mountainWall;
  const row = screenConfig.rows[y];
  if (!row) return null;
  const char = row[x];
  if (!char) return null;
  const rawTile = TILES[screenConfig.legend[char]];
  const clearedReplacement = CLEARED_GATE_REPLACEMENT.get(rawTile);
  if (clearedReplacement && isGateCleared(state.clearedGates, screenConfig.id, x, y)) {
    return clearedReplacement;
  }
  return rawTile;
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
    const neighborTile = tileAt(mapConfig, nx, ny);
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

// Whether blocking (x, y) would cut this screen's walkable area into pieces
// with no way around - i.e. this tile is the only crossing at a narrow pass
// between obstacles. A mini-dungeon entrance placed here would force the
// player through its interior on every single crossing, both directions,
// forever (raised 2026-08-28: "a mini dungeon appears in a path where I
// could not go around it"). The actual graph check is pure/DOM-free - see
// isChokepointTile in js/systems/world.js - this just supplies live
// map/inventory state as the passability check.
function isScreenChokepoint(x, y) {
  const width = mapConfig.rows[0].length;
  const height = mapConfig.rows.length;
  return isChokepointTile(width, height, x, y, (px, py) => isPassableTile(tileAt(mapConfig, px, py)));
}

// How worn a connected neighbor itself is, for tapering a connector stroke's
// color toward it (see buildTrailFragment). Takes GLOBAL coordinates and
// resolves them to whichever screen actually owns that tile - which may be
// a different screen than the one currently being walked on, now that the
// viewport can show a neighboring screen's tiles at once. No landmark
// special-casing needed: a direction only ever appears in a tile's own
// recorded dirs (see getVisitDirs) because the player actually crossed that
// edge, which by construction (see tryMove) means the neighbor on the
// other side already has a real walk count of its own by the time this is
// called - the `!resolved` branch below is defensive, not expected to fire.
function getNeighborWearFraction(ngx, ngy) {
  const resolved = globalToScreen(worldGrid, mapConfig.id, ngx, ngy);
  if (!resolved) return 0;
  return trailWearFraction(getVisitCount(state.visited, resolved.screenId, resolved.localX, resolved.localY));
}

// One tile's own trail fragment: a wavy stroke reaching toward each
// connected neighbor direction, or (if none are connected) a small
// centered dot - see docs/superpowers/specs/2026-08-25-worn-path-trail-
// design.md's "Rendering" and "Wear amount" sections. Each stroke's color
// tapers from this tile's own wear (at the center) toward the *border
// fraction* shared with the connected neighbor (at the edge - see
// trailBorderFraction, the midpoint of this tile's own wear and the
// neighbor's) via a gradient, so a heavily-walked tile reaching toward a
// barely-walked one visibly fades as it gets there, rather than the whole
// stroke reading as one flat, uniform tone. The border fraction - not the
// neighbor's own raw fraction - is what the two tiles sharing that edge
// need to agree on: each tile's edge used to taper all the way to the
// *other* tile's own color, so two different colors landed on the same
// physical point (each side insisting the border already IS the far
// side) instead of one shared value, a hard color wall confirmed live on
// a real save even though each side's gradient used matching hex values
// somewhere, just at opposite ends. Wear is
// baked entirely into color (trailColorForFraction blends toward the
// tile's own ground color as wear drops toward 0) - deliberately not
// opacity, which would need to be one flat value per tile to avoid
// overlapping strokes alpha-stacking at a junction's center, and a flat
// per-tile value can't agree with a neighbor tile's own different flat
// value at the border they share (confirmed live: a hard seam where a
// heavily-walked tile's high opacity met a barely-walked neighbor's low
// opacity, even though the gradient's color values already matched).
// Every stroke here is fully opaque - overlapping ones at a center simply
// paint over each other, no compositing artifact possible.
function buildTrailFragment(x, y, gx, gy, dirs, fraction, color, groundColor) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'map-tile-trail');
  svg.setAttribute('viewBox', `0 0 ${TRAIL_VIEWBOX_SIZE} ${TRAIL_VIEWBOX_SIZE}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  // Pure decoration - the cell already carries the real semantic info via
  // its own `title` attribute, so this shouldn't be exposed to a11y tools
  // or picked up by keyboard focus.
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (dirs.length === 0) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', TRAIL_VIEWBOX_SIZE / 2);
    circle.setAttribute('cy', TRAIL_VIEWBOX_SIZE / 2);
    circle.setAttribute('r', trailDotRadius(fraction));
    circle.setAttribute('fill', trailColorForFraction(color, groundColor, fraction));
    svg.appendChild(circle);
    return svg;
  }
  const widths = [];
  for (const dir of dirs) {
    const owner = edgeOwner(gx, gy, dir);
    const jitter = edgeJitter(owner.x, owner.y, owner.axis);
    const [dx, dy] = TRAIL_DIR_DELTA[dir];
    const neighborFraction = getNeighborWearFraction(gx + dx, gy + dy);
    // A gradient per stroke (not a flat color) so it visually tapers toward
    // however worn the neighbor it's reaching for actually is - unique id
    // per (gx, gy, dir) (GLOBAL coords, not local) since SVG gradient ids
    // share the whole document's namespace, not just their own <svg>, and
    // two different screens' tiles can be visible in the same render pass
    // and could coincidentally share local coordinates.
    const gradientId = `trail-grad-${gx}-${gy}-${dir}`;
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    gradient.setAttribute('x1', TRAIL_VIEWBOX_SIZE / 2);
    gradient.setAttribute('y1', TRAIL_VIEWBOX_SIZE / 2);
    const [tx, ty] = edgeTargetPoint(dir, TRAIL_VIEWBOX_SIZE);
    gradient.setAttribute('x2', tx);
    gradient.setAttribute('y2', ty);
    const startStop = document.createElementNS(SVG_NS, 'stop');
    startStop.setAttribute('offset', '0%');
    startStop.setAttribute('stop-color', trailColorForFraction(color, groundColor, fraction));
    const endStop = document.createElementNS(SVG_NS, 'stop');
    endStop.setAttribute('offset', '100%');
    endStop.setAttribute('stop-color', trailColorForFraction(color, groundColor, trailBorderFraction(fraction, neighborFraction)));
    gradient.append(startStop, endStop);
    svg.appendChild(gradient);
    const width = trailStrokeWidthBetween(fraction, neighborFraction);
    widths.push(width);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', connectorPathD(dir, jitter, TRAIL_VIEWBOX_SIZE));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', `url(#${gradientId})`);
    path.setAttribute('stroke-width', width);
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);
  }
  // Each direction above is stroked independently at its own width (SVG
  // can't taper a stroke's width along its length - see
  // trailStrokeWidthBetween in trail.js), so at a fork where two connected
  // directions have different widths, a thinner one's edge falls short of a
  // wider one's right where they meet at this shared center point - a hard
  // rectangular notch, confirmed live against a real save. Painting a solid
  // hub on top, sized to the widest connected stroke (trailHubRadius),
  // covers that notch: every narrower stroke now visually emerges from
  // *inside* the hub rather than butting up against a wider neighbor. A
  // single direction has no other width to clash with, so it's skipped.
  if (dirs.length > 1) {
    const hub = document.createElementNS(SVG_NS, 'circle');
    hub.setAttribute('cx', TRAIL_VIEWBOX_SIZE / 2);
    hub.setAttribute('cy', TRAIL_VIEWBOX_SIZE / 2);
    hub.setAttribute('r', trailHubRadius(widths));
    hub.setAttribute('fill', trailColorForFraction(color, groundColor, fraction));
    svg.appendChild(hub);
  }
  return svg;
}

function computeViewportTileCount(viewportEl) {
  const width = viewportEl.clientWidth;
  const height = viewportEl.clientHeight;
  if (!width || !height) {
    return { tilesWide: DEFAULT_VIEWPORT_TILES_WIDE, tilesTall: DEFAULT_VIEWPORT_TILES_TALL };
  }
  return {
    tilesWide: Math.max(1, Math.floor(width / TILE_SIZE_PX)),
    tilesTall: Math.max(1, Math.floor(height / TILE_SIZE_PX)),
  };
}

function render() {
  const viewport = document.createElement('div');
  viewport.className = 'map-viewport';
  rootEl.innerHTML = '';
  rootEl.appendChild(viewport);

  const { tilesWide, tilesTall } = computeViewportTileCount(viewport);
  const centerGlobal = screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y);
  const bounds = clusterBounds(worldGrid, mapConfig.id);
  const { originGx, originGy } = computeViewportOrigin(centerGlobal.gx, centerGlobal.gy, tilesWide, tilesTall, bounds);

  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.gridTemplateColumns = `repeat(${tilesWide}, ${TILE_SIZE_PX}px)`;
  grid.style.gridTemplateRows = `repeat(${tilesTall}, ${TILE_SIZE_PX}px)`;

  for (let row = 0; row < tilesTall; row++) {
    for (let col = 0; col < tilesWide; col++) {
      const gx = originGx + col;
      const gy = originGy + row;
      const resolved = globalToScreen(worldGrid, mapConfig.id, gx, gy);

      const cell = document.createElement('div');
      // Explicit placement (not CSS auto-flow) so a gap below - a viewport
      // cell that resolves to nothing - just renders as an empty tile in its
      // correct spot instead of every subsequent real cell shifting left to
      // fill the hole. Grid lines are 1-indexed.
      cell.style.gridColumn = String(col + 1);
      cell.style.gridRow = String(row + 1);

      // Reachable whenever the viewport is bigger than the current screen's
      // whole cluster (computeViewportOrigin then centers the cluster inside
      // the viewport instead of panning past its edges - see
      // js/systems/world.js) - true for every map smaller than the viewport:
      // town, mini-dungeons, tool dungeons. The padding cells around that
      // centered cluster resolve to nothing here and render as a bare,
      // content-less .map-tile.
      if (!resolved) {
        cell.className = 'map-tile';
        grid.appendChild(cell);
        continue;
      }
      const { screenId, localX: x, localY: y } = resolved;
      const screenConfig = maps[screenId];

      const tile = tileAt(screenConfig, x, y);
      const isPlayer = screenId === mapConfig.id && state.position.x === x && state.position.y === y;
      const hasMiniDungeon = hasMiniDungeonEntrance(state.miniDungeons, screenId, x, y);
      const hasTileCache = hasCache(state.caches, screenId, x, y);
      // A tile currently blocking the way is never shown as visited, even if
      // state.visited has a stale record from before the map was repainted
      // (the player really did stand on grass there once, but that record
      // shouldn't outlive the terrain it was standing on) - a permanent or
      // still-locked obstacle can never actually have been walked on.
      const isCurrentlyPassable = isPassableTile(tile);
      // Obstacles grow out of the grass, so they keep its green background
      // rather than looking like a hole cut in the field - see
      // RANDOM_SIZE_OBSTACLES above. Grass-context landmarks (town/
      // wilderness/dungeon action tiles) are their own distinct tile type
      // but conceptually sit on that same grass, so they get it too - see
      // GRASS_CONTEXT_MARKERS above. Stump/rubble (what those obstacles
      // become once cleared - see STUMP_AND_RUBBLE above) get the same
      // treatment as grass itself, not just the obstacle set.
      cell.className = 'map-tile'
        + (tile === TILES.grass || STUMP_AND_RUBBLE.has(tile) || RANDOM_SIZE_OBSTACLES.has(tile) || GRASS_CONTEXT_MARKERS.has(tile) ? ' map-tile-grass' : '')
        + (tile === TILES.water ? ' map-tile-water' : '')
        + (isPlayer ? ' map-tile-player' : '')
        // Visible from a distance so a completed quest doesn't only turn up
        // by walking in and checking - see docs/superpowers/BACKLOG.md's
        // "Quest board should glow..." item.
        + (tile === TILES.questBoard && hasAnyQuestReady(state) ? ' map-tile-quest-ready' : '')
        + (tile === TILES.portalOrigin ? ' map-tile-portal-origin' : '')
        + (tile === TILES.portalReturn ? ' map-tile-portal-return' : '');
      // A tile's own worn-path trail: dirt strokes reaching toward whichever
      // directions the player has actually walked across at this exact tile
      // (getVisitDirs - never inferred from a neighbor's own state, see
      // exploration.js), or a small dot if it's been visited but nothing's
      // been walked across it yet. Appended first so it paints underneath
      // every other *positioned* branch below (mount/rider, obstacle,
      // fullsize marker, decoration - same "append earlier = paints behind"
      // rule the decoration-behind-hero fix uses), with one exception: the
      // plain in-flow `cell.append(emoji)` fallback branch has no
      // `position`, and non-positioned in-flow content always paints before
      // positioned descendants regardless of DOM order - so on a tile that
      // falls through to that branch, the trail SVG actually paints ON TOP
      // of the emoji, not underneath it.
      if (isCurrentlyPassable && isVisited(state.visited, screenId, x, y)) {
        const fraction = trailWearFraction(getVisitCount(state.visited, screenId, x, y));
        const color = getTrailColor(tile);
        const groundColor = getGroundColor(tile);
        const dirs = getVisitDirs(state.visited, screenId, x, y);
        cell.appendChild(buildTrailFragment(x, y, gx, gy, dirs, fraction, color, groundColor));
      }
      // Depth-sort by viewport row instead of a fixed always-on-top/always-
      // behind z-index: a row's cells sit above every cell in the row above
      // it, so a tall obstacle's canopy (which overflows upward into the row
      // above, see .map-tile-obstacle) correctly paints over whatever's
      // there - including the player - while a player standing in a row
      // below an obstacle still renders in front of it, same as any other
      // ground content would.
      cell.style.zIndex = String(row);
      const emoji = hasMiniDungeon ? MINI_DUNGEON_MARKER_EMOJI : hasTileCache ? CACHE_MARKER_EMOJI : pickTileVariant(tile, x, y);
      const mountEmoji = isPlayer && tile.requiresTool && hasRequiredTool(tile, state.inventory)
        ? MOUNT_EMOJI_FOR_TOOL[tile.requiresTool] : null;
      const isRandomSizeObstacle = !hasMiniDungeon && !hasTileCache && RANDOM_SIZE_OBSTACLES.has(tile);
      const isFullSquareMarker = hasMiniDungeon || hasTileCache || FULL_SQUARE_MARKERS.has(tile);
      const isDecoratedGrass = !isFullSquareMarker && (tile === TILES.grass || STUMP_AND_RUBBLE.has(tile)) && emoji !== '';
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
      } else if (emoji) {
        cell.append(emoji);
      }
      cell.title = hasMiniDungeon ? MINI_DUNGEON_MARKER_DESCRIPTION : hasTileCache ? CACHE_MARKER_DESCRIPTION : tile.description;
      grid.appendChild(cell);
    }
  }

  viewport.appendChild(grid);
}

function tryMove(dx, dy) {
  const currentGlobal = screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y);
  const resolved = globalToScreen(worldGrid, mapConfig.id, currentGlobal.gx + dx, currentGlobal.gy + dy);
  // Past this cluster's outer edge - e.g. a one-screen map's (town,
  // dungeon) own array bounds, or (in principle) the wilderness cluster's
  // outermost rectangle, though that's unreachable in practice since
  // isSealedWorldEdge already makes every true boundary ring impassable
  // before a step could ever resolve past it.
  if (!resolved) return;
  const { screenId: nextScreenId, localX: nx, localY: ny } = resolved;
  const screenConfig = maps[nextScreenId];

  const tile = tileAt(screenConfig, nx, ny);
  if (!tile) return;
  if (!tile.walkable) {
    if (!tile.requiresTool) return;
    if (!hasRequiredTool(tile, state.inventory)) {
      callbacks.onLockedGate(getLockedGateMessage(tile.requiresTool));
      return;
    }
    callbacks.onToolGateCleared(getToolClearedMessage(tile.requiresTool));
    // Permanently convert thicket/mountain to a stump/rubble marker the
    // first time it's crossed - water is absent from CLEARED_GATE_REPLACEMENT
    // on purpose, so canoeing across it never changes the tile (raised
    // 2026-08-28). This now also fires correctly when the gate sits on the
    // very first tile of a screen crossed into from another screen -
    // previously handled by a separate teleport path (handleEdgeTransition)
    // that never ran this check at all (bug raised 2026-08-28).
    if (CLEARED_GATE_REPLACEMENT.has(tile)) {
      Object.assign(state, { clearedGates: markGateCleared(state.clearedGates, screenConfig.id, nx, ny) });
    }
  }

  // Record which edge this step actually crossed on both sides of it - see
  // exploration.js's markDirection/markVisited. Recorded against
  // mapConfig.id (the screen being LEFT) before the current-screen swap
  // below, and against screenConfig.id (the screen being ENTERED) after -
  // these are usually the same screen, and are deliberately different ids
  // exactly when this step crosses a screen boundary.
  const exitDir = trailDirFromDelta(dx, dy);
  if (exitDir) {
    Object.assign(state, { visited: markDirection(state.visited, mapConfig.id, state.position.x, state.position.y, exitDir) });
  }
  state.position = { x: nx, y: ny };
  Object.assign(state, { visited: markVisited(state.visited, screenConfig.id, nx, ny, exitDir ? TRAIL_OPPOSITE_DIR[exitDir] : undefined) });

  // Ticks down once per real step taken, regardless of tile type or any
  // early return below - see ENCOUNTER_COOLDOWN_STEPS above.
  const onEncounterCooldown = (state.encounterCooldown || 0) > 0;
  if (onEncounterCooldown) {
    Object.assign(state, { encounterCooldown: state.encounterCooldown - 1 });
  }

  // Swap which screen is "current" inline - no remount, no teleport, no
  // separate onEdgeTransition callback. state.map is set directly (mirrors
  // every other state.* field this function already writes for
  // persistence's benefit, e.g. state.visited/state.clearedGates above) so
  // main.js's own persist()/exitMap logic sees the right screen without a
  // dedicated callback round-trip.
  if (screenConfig.id !== mapConfig.id) {
    mapConfig = screenConfig;
    state.map = screenConfig.id;
    announceScreenIfNew(screenConfig);
  }

  if (ZONE1_WILDERNESS_MAP_IDS.has(state.map)) {
    state.zone1Steps = (state.zone1Steps || 0) + 1;
  }

  const discovery = resolveStepDiscovery(state, mapConfig, nx, ny, tile, Math.random, isScreenChokepoint);
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

  if (!onEncounterCooldown && tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
    // A flat 5% chance for any encounter (wilderness or dungeon) to be the
    // rare elite instead of the normal roll - always solo, bypassing the
    // multi-mob grouping below entirely. The empty-override array (matching
    // the boss-fight pattern) tells handleEncounter this monster's stats are
    // already final, skipping the random stat-variant roll.
    if (rollEliteEncounter()) {
      Object.assign(state, { encounterCooldown: ENCOUNTER_COOLDOWN_STEPS });
      callbacks.onEncounter([ELITE_MONSTER_ID], [{}]);
      return;
    }
    const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
    const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts, mapConfig.monsterTable, state.ngPlusCycle, state.zone1Steps);
    Object.assign(state, { encounterCooldown: ENCOUNTER_COOLDOWN_STEPS });
    callbacks.onEncounter(monsterIds);
  }
}

function handleKeydown(event) {
  const delta = KEY_TO_DELTA[event.key];
  if (delta) {
    tryMove(delta[0], delta[1]);
    return;
  }
  // 'p'/'P' for the Circle of Ultimate Portaling - not part of
  // KEY_TO_DELTA since it's an action, not a move. Confirmed
  // non-colliding with battleScreen.js's own p/P (pause): that screen's
  // keydown listener is detached (screenManager.js pause()) whenever this
  // one is active, same reasoning as the documented 's'/parry collision
  // there.
  if (event.key === 'p' || event.key === 'P') {
    callbacks.onAction('usePortalTool');
  }
}

// Window resize can change how many tiles fit in the viewport (see
// computeViewportTileCount) - re-render from scratch to pick that up,
// which also sidesteps the old Safari-specific grid-track-sizing bug this
// function used to work around (that bug was specific to 1fr-stretched
// tracks, which the fixed-pixel-size grid above no longer uses).
function handleResize() {
  if (!rootEl || !mapConfig) return;
  render();
}

// Fires callbacks.onFirstVisit the first time the player ever sets foot on
// `screenConfig` - called once from mount() for the screen the game
// actually starts/resumes on, and again from tryMove() whenever a step
// crosses into a screen that isn't the one just left (see tryMove below).
function announceScreenIfNew(screenConfig) {
  if (!hasSeenScreen(state.seenScreens, screenConfig.id)) {
    Object.assign(state, { seenScreens: markScreenSeen(state.seenScreens, screenConfig.id) });
    callbacks.onFirstVisit(screenConfig.id);
  }
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  mapConfig = props.mapConfig;
  maps = props.maps;
  worldGrid = props.worldGrid;
  callbacks = props.callbacks;
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, state.position.x, state.position.y) });
  render();
  announceScreenIfNew(mapConfig);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);
}

export function unmount() {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', handleResize);
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
