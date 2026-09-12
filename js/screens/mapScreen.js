import { TILES } from '../tiles.js';
import { isChokepointTile, computeViewportOrigin } from '../systems/world.js';
import { screenToGlobal, globalToScreen, clusterBounds } from '../systems/worldGrid.js';
import { markVisited, markDirection, isVisited, getVisitCount, getVisitDirs } from '../systems/exploration.js';
import { trailWearFraction, wornPathEncounterMultiplier } from '../systems/trail.js';
import { markScreenSeen, hasSeenScreen } from '../systems/screenSeen.js';
import { hasCache } from '../systems/caches.js';
import { hasMiniDungeonEntrance } from '../systems/miniDungeons.js';
import { resolveStepDiscovery } from '../systems/discovery.js';
import { hasRequiredTool, getLockedGateMessage, getToolClearedMessage, getGateProximityMessage, hasShownGateHint, markGateHintShown, isGateRewardCollected, markGateRewardCollected, rollGateReward, isGateCleared, markGateCleared } from '../systems/toolGates.js';
import { rollEncounterGroup } from '../systems/groupEncounters.js';
import { rollEliteEncounter, ELITE_MONSTER_ID } from '../systems/eliteEncounter.js';
import { TOOL_DUNGEON_ENTRANCES } from '../data/toolDungeons.js';
import { SUPER_BOSSES } from '../data/superBosses.js';
import { hasAnyQuestReady } from '../systems/quests.js';
import { TOWN_PORTAL_POSITION } from '../systems/portal.js';
import { playSfx } from '../systems/audio.js';
import { DEFAULT_CAMERA_SMOOTHING_MS } from '../state.js';
import {
  CACHE_MARKER_DESCRIPTION, MINI_DUNGEON_MARKER_DESCRIPTION, PORTAL_ACTION_TILES,
  TILE_SIZE_PX, DEFAULT_VIEWPORT_TILES_WIDE, DEFAULT_VIEWPORT_TILES_TALL,
  TRAIL_DIRECTIONS, TRAIL_OPPOSITE_DIR,
} from '../systems/mapRenderModel.js';
import { buildDrawList } from '../systems/mapDrawList.js';
import * as domRenderer from './mapDomRenderer.js';
import * as canvasRenderer from './mapCanvasRenderer.js';

// Raised 2026-08-29: random encounters had no memory of the last one, so
// two fights on consecutive steps was always possible (just rare per-pair -
// e.g. 15% * 15% = 2.25%) and felt bad when it landed. Guarantees this many
// encounter-free steps immediately after any random encounter fires -
// doesn't apply to tile-triggered fights (guardians, the boss) since those
// are deterministic, not random rolls.
const ENCOUNTER_COOLDOWN_STEPS = 2;

// Raised 2026-09-06: stepping onto a portal used to fire its action
// (enterPortalToTown/enterPortalToOrigin/enterPortalDungeon) in the same
// tick as the render() that first showed the player standing on it - an
// instant cut with no warning. These three now get a brief "being pulled
// in" pause first - see playPortalPullEffect and PORTAL_PULL_EFFECT_MS
// below, and .map-tile-player-portal-pull in css/styles.css.
// PORTAL_ACTION_TILES itself lives in mapRenderModel.js, since both
// renderers need it for the always-on-top paint boost too.
const PORTAL_PULL_EFFECT_MS = 420;
// Guards against a second keypress landing mid-pull (e.g. moving away, or
// re-triggering the same portal) before the delayed callbacks.onAction
// above actually fires - reset on every mount() alongside every other
// piece of this module's state.
let portalTransitionPending = false;

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

let rootEl = null;
let state = null;
let mapConfig = null;
let maps = null;
let worldGrid = null;
let callbacks = null;
// Set from props.debugNoEncounters ("?noEncounters=1" - see
// debugCharacters.js) - skips only the random encounter roll below, not
// deterministic tile-triggered fights (guardians, bosses).
let debugNoEncounters = false;
// Which renderer is actually drawing the map - see resolveRenderer() below.
// Both expose the same small interface (renderFull/renderStep/destroy/
// getPlayerScreenRect and the three effect triggers), so nothing else in
// this file needs to know which one it's talking to.
let renderer = canvasRenderer;
// The .map-viewport element the active renderer draws into. This module owns
// it (rather than either renderer) because computeViewportGeometry() has to
// measure its real pixel size to decide how many tiles fit, which is a
// renderer-independent question.
let viewportEl = null;
// The (tilesWide, tilesTall) the active renderer was last built for. Set by
// renderFull() (the only place that actually measures the viewport's real
// pixel size) and reused as-is by renderStep() via computeStepGeometry()
// below, rather than re-measuring every step - see that function's own
// comment for why a fresh measurement here would reintroduce a forced
// synchronous layout on every single step. Relies on handleResize()'s
// 'resize' listener to catch every real size change and trigger a fresh
// renderFull(); a resize that somehow doesn't fire that event would silently
// mis-lay-out the view until the next one that does.
let lastTilesWide = 0;
let lastTilesTall = 0;
// Raised 2026-09-09 (see BACKLOG.md's "Map render performance" section):
// the DOM renderer's grid-column/grid-row are anchored to the current
// screen-cluster's own bounds (clusterBounds' minGx/minGy), not to the
// panning viewport origin - so a cell's placement is a pure function of its
// world coordinate and never changes just because the camera moved. That
// anchor is only valid within one cluster, so lastClusterId tracks which
// cluster the current render is anchored to and renderStep() falls back to
// renderFull() on any cluster change instead of trying to reconcile a cache
// against a moved anchor. The canvas renderer has no such anchor (it draws
// from world coordinates directly every frame) but shares the fallback,
// since a cluster change also changes the world extent it should clamp to.
let lastClusterId = null;

// TEMPORARY, alongside js/screens/mapDomRenderer.js: `?renderer=dom` puts the
// old DOM/CSS-Grid renderer back so the two can be compared live on the same
// save in one build (the previous perf session had to `git stash`/pop to A/B,
// which can't be done to an already-running page). Canvas is the default -
// the whole point of the rewrite - and anything other than the exact string
// 'dom' falls through to it, so a typo'd param can't silently ship the slow
// path. props.renderer wins over the URL so tests can pick one explicitly
// without touching a global. Remove this, the flag, and mapDomRenderer.js
// together once canvas is confirmed better.
function resolveRenderer(preferred) {
  const choice = preferred ?? readRendererParam();
  return choice === 'dom' ? domRenderer : canvasRenderer;
}

// Whether the canvas renderer may use its cached static layer. Props win over
// the URL so a test can pick one without touching a global, exactly as
// `renderer` does above.
function resolveStaticCacheEnabled(preferred) {
  if (typeof preferred === 'boolean') return preferred;
  if (typeof location === 'undefined' || !location.search) return true;
  try {
    return new URLSearchParams(location.search).get('staticCache') !== 'off';
  } catch {
    return true;
  }
}

function readRendererParam() {
  if (typeof location === 'undefined' || !location.search) return null;
  try {
    return new URLSearchParams(location.search).get('renderer');
  } catch {
    return null;
  }
}

// How long the camera takes to slide to a new position, in ms. 0 reproduces
// the old DOM renderer's behavior exactly (the camera jumps a whole tile the
// instant a step lands), which is why it's an available value rather than
// just a small number - see the Settings slider in
// js/screens/settingsScreen.js. Only the canvas renderer reads this; the DOM
// renderer has no way to honor it (its camera is a discrete grid transform).
// The default itself lives in js/state.js alongside the save field it backs,
// rather than being restated here where the two could drift apart.
function resolveCameraSmoothingMs() {
  const raw = state?.settings?.cameraSmoothingMs;
  return Number.isFinite(raw) ? raw : DEFAULT_CAMERA_SMOOTHING_MS;
}

const KEY_TO_DELTA = {
  ArrowUp: [0, -1], w: [0, -1],
  ArrowDown: [0, 1], s: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0],
};

// How long a held direction key waits between steps. Raised by Timothy
// 2026-09-10: "if you hold down up/left/right/down it's kind of janky and
// not smooth... if you hold down character should walk fast just smoothly."
//
// Holding a key used to be driven entirely by the browser's own keyboard
// auto-repeat - every repeated `keydown` event called tryMove directly. That
// repeat is an OS setting, not a game one: it waits roughly half a second
// before it starts (so a held key gave one step, a clear pause, then a
// burst), and then fires at whatever rate that machine happens to be
// configured for, which on a fast setting is ~30 steps a second. Two
// consequences, both of which read as jank:
//   - the cadence is uneven by construction, and differs per machine, so
//     travel speed was never the same for two players;
//   - at ~30 steps/sec the camera cannot keep up at higher glide settings.
//     Its steady-state lag (tiles added per frame / fraction closed per
//     frame) works out past CAMERA_SNAP_TILES, so the camera would lerp,
//     exceed the threshold, hard-snap, and repeat - a visible stutter every
//     few frames, worst at exactly the smoothest-looking slider values.
// A fixed cadence owned here fixes both: `event.repeat` keydowns are ignored
// outright and walkTick below is the only thing that repeats. 110ms keeps
// the camera's steady-state lag under a tile even at the slowest glide
// setting and 30fps, while still being a brisk walk.
const WALK_REPEAT_INTERVAL_MS = 110;
// The cadence actually in use. Overridable via props.walkRepeatMs, which
// exists for tests: the behavior worth asserting is "does it repeat, alternate
// and stop", and at the real 110ms a handful of those cost seconds of real
// waiting each. Node runs test files in parallel, so that much wall-clock time
// spent asleep is enough to starve other timing-sensitive suites - this was
// caught making an unrelated battle test flake. Same reasoning as the
// `renderer` prop.
let walkRepeatMs = WALK_REPEAT_INTERVAL_MS;
// Whether the canvas renderer may use its cached static layer - see
// resolveStaticCacheEnabled.
let staticCacheEnabled = true;
// Movement keys currently held, most recently pressed last. An ordered list
// rather than a single key so that pressing a second direction without
// releasing the first turns immediately, and releasing that second one falls
// back to the direction still held instead of stopping dead - which is how
// holding two keys through a corner actually feels in any other game.
let heldMoveKeys = [];
// Which axis the last step travelled on, so that holding two perpendicular
// directions can alternate between them - see chooseWalkKey.
let lastWalkAxis = null;

// Steps are paced by accumulated animation-frame time rather than by a
// setInterval. Raised by Timothy 2026-09-10 after the smooth stride landed:
// "there is a micro pause but we can commit this then chase that."
//
// The cause was the two clocks disagreeing. A step fired on setInterval while
// the character's stride - which crosses a tile in exactly one interval -
// advanced on animation-frame deltas. Timers are a floor, not a target: a
// setInterval never fires EARLY and often lands a few ms late, so the stride
// finished first and the character stood still until the step caught up. Land
// that gap on a frame boundary and you get a duplicated frame, which is
// exactly what a micro-pause looks like.
//
// Accumulating frame time here puts both on one clock: the step and the
// stride cross their thresholds on the very same frame, so they cannot drift
// apart at all. Simulated over 20s of held-key walking against realistic
// timer jitter, this cut frozen frames from 1.5% to 0.5% and - the part that
// actually matters - cut the spread in per-frame movement from 0.17 to 0.07,
// i.e. near-constant speed. Exponential smoothing scored well on frozen
// frames but far worse on that spread (0.83-1.32): it avoids freezing by
// lurching, which is its own kind of stutter.
//
// It also fixes a smaller thing for free: a background tab stops firing
// animation frames, so the character no longer walks on while you're away.
// A setInterval kept ticking (throttled) the whole time.
let walkRafId = null;
let walkLastFrameMs = 0;
let walkAccumMs = 0;
// Set by tryMove for the single renderStep that follows it, then cleared.
// Null means "something other than a plain step changed the world, or nothing
// said what changed" - which the renderer must treat as repaint-everything,
// since a wrong patch leaves stale pixels on screen indefinitely.
let pendingChangedTiles = null;
// A long gap - the tab was hidden, or a battle overlay held the thread - must
// not cash out as a burst of queued steps the moment focus returns.
const WALK_MAX_FRAME_MS = 250;
const WALK_MAX_CATCHUP_STEPS = 2;

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
  for (const superBoss of Object.values(SUPER_BOSSES)) {
    if (screenConfig.id === superBoss.screenId && x === superBoss.x && y === superBoss.y) {
      return TILES[superBoss.hasDungeon ? 'superBossEntrance' : 'superBossMarker'];
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

// The pure "what should this cell look like" computation, entirely free of
// DOM - every value here is a cheap lookup against state/maps, not a node
// creation, which is what makes it safe to run for every visible cell on
// every step (renderStep() below) without reintroducing the cost this
// rewrite exists to remove. Compared against the previous call's signature
// (via signaturesEqual) to decide whether a cell's content needs rebuilding
// at all.
function computeCellSignature(screenId, x, y) {
  const screenConfig = maps[screenId];
  const tile = tileAt(screenConfig, x, y);
  const isPlayer = screenId === mapConfig.id && state.position.x === x && state.position.y === y;
  const hasMiniDungeon = hasMiniDungeonEntrance(state.miniDungeons, screenId, x, y);
  const hasTileCache = hasCache(state.caches, screenId, x, y);
  // A tile currently blocking the way is never shown as visited, even if
  // state.visited has a stale record from before the map was repainted (the
  // player really did stand on grass there once, but that record shouldn't
  // outlive the terrain it was standing on) - a permanent or still-locked
  // obstacle can never actually have been walked on.
  const isCurrentlyPassable = isPassableTile(tile);
  const visited = isCurrentlyPassable && isVisited(state.visited, screenId, x, y);
  const fraction = visited ? trailWearFraction(getVisitCount(state.visited, screenId, x, y)) : 0;
  const dirs = visited ? getVisitDirs(state.visited, screenId, x, y) : [];
  // Visible from a distance so a completed quest doesn't only turn up by
  // walking in and checking - see docs/superpowers/BACKLOG.md's "Quest
  // board should glow..." item.
  const questReady = tile === TILES.questBoard && hasAnyQuestReady(state);
  // Portal tiles get a flat +1000 z-index boost on top of the row-based
  // depth sort (see applyCellPosition below) - guardians get the same
  // treatment. See the original comment preserved on applyCellPosition.
  // The dragon boss entrance joined them 2026-09-12 once it started
  // rendering at GUARDIAN_PX too - same downward bleed, same fix.
  const zBoosted = PORTAL_ACTION_TILES.has(tile) || tile === TILES.guardian || tile === TILES.boss;
  return { resolved: true, screenId, x, y, tile, isPlayer, hasMiniDungeon, hasTileCache, visited, fraction, dirs, questReady, zBoosted };
}

const EMPTY_SIGNATURE = { resolved: false, zBoosted: false };

function sameDirs(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function signaturesEqual(a, b) {
  if (a.resolved !== b.resolved) return false;
  if (!a.resolved) return true;
  return a.screenId === b.screenId && a.x === b.x && a.y === b.y && a.tile === b.tile
    && a.isPlayer === b.isPlayer && a.hasMiniDungeon === b.hasMiniDungeon && a.hasTileCache === b.hasTileCache
    && a.visited === b.visited && a.fraction === b.fraction && sameDirs(a.dirs, b.dirs) && a.questReady === b.questReady;
}

function computeViewportGeometry(viewport) {
  const { tilesWide, tilesTall } = computeViewportTileCount(viewport);
  const centerGlobal = screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y);
  const bounds = clusterBounds(worldGrid, mapConfig.id);
  const { originGx, originGy } = computeViewportOrigin(centerGlobal.gx, centerGlobal.gy, tilesWide, tilesTall, bounds);
  // playerGx/playerGy travel with the geometry so the renderer never has to
  // scan the whole viewport looking for the player's own cell - see
  // buildDynamicOps in mapDrawList.js, which only visits a handful of tiles
  // per frame and so has nothing to scan.
  return { tilesWide, tilesTall, originGx, originGy, bounds, playerGx: centerGlobal.gx, playerGy: centerGlobal.gy };
}

// Raised 2026-09-09 during the map render perf follow-up (see BACKLOG.md):
// renderStep()'s own call to computeViewportGeometry used to re-measure
// viewportEl.clientWidth/clientHeight on every single step via
// computeViewportTileCount - a real DevTools Performance recording flagged
// this exact read as a "Forced reflow" (a synchronous layout, forced
// because it reads a layout-dependent property right after the previous
// step's DOM mutations, every single step). The viewport's pixel size only
// actually changes on a real window resize, which handleResize() already
// catches via its own 'resize' listener and reacts to with a full
// renderFull() rebuild - so the hot path has no need to re-measure at all;
// reusing lastTilesWide/lastTilesTall (set by whichever renderFull() call
// last ran) is exactly as correct and skips the forced layout entirely.
function computeStepGeometry() {
  const tilesWide = lastTilesWide;
  const tilesTall = lastTilesTall;
  const centerGlobal = screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y);
  const bounds = clusterBounds(worldGrid, mapConfig.id);
  const { originGx, originGy } = computeViewportOrigin(centerGlobal.gx, centerGlobal.gy, tilesWide, tilesTall, bounds);
  // playerGx/playerGy travel with the geometry so the renderer never has to
  // scan the whole viewport looking for the player's own cell - see
  // buildDynamicOps in mapDrawList.js, which only visits a handful of tiles
  // per frame and so has nothing to scan.
  return { tilesWide, tilesTall, originGx, originGy, bounds, playerGx: centerGlobal.gx, playerGy: centerGlobal.gy };
}

function signatureAt(gx, gy) {
  const resolved = globalToScreen(worldGrid, mapConfig.id, gx, gy);
  return resolved ? computeCellSignature(resolved.screenId, resolved.localX, resolved.localY) : EMPTY_SIGNATURE;
}

// Everything the active renderer needs to draw a frame, gathered in one
// place so neither renderer reaches into this module's own globals. Built
// fresh per render rather than cached: every field is a cheap property read
// or a bound function, and a stale copy here would be a silent
// wrong-frame bug of exactly the kind the signature diffing exists to avoid.
function buildRenderContext(geometry) {
  return {
    ...geometry,
    signatureAt,
    signaturesEqual,
    neighborWearFraction: getNeighborWearFraction,
    playerEmoji: state.player.emoji,
    hasToolFor: (tile) => hasRequiredTool(tile, state.inventory),
    cameraSmoothingMs: resolveCameraSmoothingMs(),
    staticCacheEnabled: staticCacheEnabled,
    // How long the hero takes to walk one tile, which is the walk cadence
    // itself - they should arrive exactly as the next held-key step fires.
    walkStepMs: walkRepeatMs,
  };
}

// Full teardown + rebuild of everything visible - called from mount() and
// handleResize(), both already-infrequent one-shot events with no need for
// renderStep()'s diffing. Also the only place the renderer's own per-cell
// cache is reset, since a resize can change tilesWide/tilesTall
// (invalidating every cached position) and a fresh mount has nothing to
// diff against yet.
function renderFull() {
  const viewport = document.createElement('div');
  viewport.className = 'map-viewport';
  rootEl.innerHTML = '';
  rootEl.appendChild(viewport);
  viewportEl = viewport;

  const geometry = computeViewportGeometry(viewport);
  renderer.renderFull(viewport, buildRenderContext(geometry));

  lastTilesWide = geometry.tilesWide;
  lastTilesTall = geometry.tilesTall;
  lastClusterId = worldGrid.clusterIdOfScreen[mapConfig.id];
}

// The hot path - called from tryMove() on every step instead of a full
// rebuild.
function renderStep() {
  if (!viewportEl) {
    renderFull();
    return;
  }
  // The DOM renderer's cluster-anchored placement is only valid within the
  // cluster it was built for - a cluster change (crossing into a screen that
  // isn't part of the current cluster) needs a fresh anchor, not a
  // reconciliation of the old one, so fall back to a full rebuild rather
  // than trying to reason about a cache against a moved anchor.
  if (worldGrid.clusterIdOfScreen[mapConfig.id] !== lastClusterId) {
    renderFull();
    return;
  }
  const context = buildRenderContext(computeStepGeometry());
  context.changedTiles = pendingChangedTiles;
  pendingChangedTiles = null;
  if (!renderer.renderStep(context)) {
    renderFull();
  }
}

function tryMove(dx, dy) {
  if (portalTransitionPending) return;
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
  // The only two tiles a step can change: the one being left (its crossed-edge
  // list gains a direction, and it stops being the player's cell) and the one
  // being entered (visit count, edge list, and it becomes the player's cell).
  // Handing these to the renderer is what lets the cached map layer be patched
  // in place instead of repainted whole - see patchStaticCache.
  pendingChangedTiles = [
    screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y),
    screenToGlobal(worldGrid, screenConfig.id, nx, ny),
  ];
  // Read BEFORE markVisited below records this very step - the worn-path
  // encounter discount (see wornPathEncounterMultiplier below) reflects
  // wear that already existed before this step, not the step in progress.
  // A never-before-walked tile must get zero discount on the first visit
  // that walks it; using the post-increment count would give every tile at
  // least 1/TRAIL_WEAR_CAP off from the moment it's first entered, which is
  // both wrong per the design ("the more a tile's been walked") and would
  // make the encounterChance:1 tests in mapScreenDom.test.js flaky (they
  // rely on real, unmocked Math.random() always being < 1 - a discount on
  // the very first step onto those tiles would drop the effective chance
  // below 1 and start missing some fraction of the time).
  const priorVisitCount = getVisitCount(state.visited, screenConfig.id, nx, ny);
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
  renderStep();

  callbacks.onMove(state.position);
  checkGateProximity(nx, ny);

  if (gateReward) {
    callbacks.onGateReward(gateReward);
    return;
  }

  if (tile.action) {
    if (PORTAL_ACTION_TILES.has(tile)) {
      portalTransitionPending = true;
      playPortalPullEffect();
      setTimeout(() => {
        portalTransitionPending = false;
        callbacks.onAction(tile.action);
      }, PORTAL_PULL_EFFECT_MS);
      return;
    }
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

  // Settings default to enabled (see DEFAULT_WORN_PATH_SETTINGS in state.js)
  // - `!== false` rather than a truthy check so a hand-built state object
  // missing the key entirely (some tests) still gets the discount, matching
  // the existing featureFlags?.audioBeta style elsewhere in this file's
  // settings reads.
  const wornPathDiscountEnabled = state.settings?.wornPathDiscountEnabled !== false;
  // One-time flavor banner the first time a step actually benefits from the
  // discount (not merely the first visit to any tile) - see
  // docs/superpowers/specs/2026-09-12-worn-path-encounter-discount-design.md.
  // Suppressed when the setting is off: telling a player who disabled the
  // discount to "stay on the trail" would be actively wrong.
  if (wornPathDiscountEnabled && tile.encounter && priorVisitCount >= 1 && !state.flags.wornPathHintShown) {
    Object.assign(state, { flags: { ...state.flags, wornPathHintShown: true } });
    callbacks.onWornPathHint();
  }
  const wornPathMultiplier = wornPathDiscountEnabled ? wornPathEncounterMultiplier(priorVisitCount) : 1;
  if (!debugNoEncounters && !onEncounterCooldown && tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance * wornPathMultiplier) {
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

// Shift changes the character a letter key reports ('w' -> 'W'), not what the
// player meant by it. Normalising here matters for more than tidiness: the
// held-key bookkeeping below matches keyup against keydown by name, so
// pressing 'w', then shift, then releasing would otherwise deliver a keyup
// for 'W' that never matches the held 'w' - leaving the key stuck down and
// the character walking on its own. Named keys ('ArrowUp') are already
// case-stable and pass through untouched.
function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function startWalkTimer() {
  if (walkRafId !== null || typeof requestAnimationFrame !== 'function') return;
  // A fresh hold starts its interval from now, so the first repeat is a full
  // interval after the immediate step handleKeydown already took.
  walkAccumMs = 0;
  walkLastFrameMs = 0;
  walkRafId = requestAnimationFrame(walkFrame);
}

function stopWalkTimer() {
  if (walkRafId === null) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(walkRafId);
  walkRafId = null;
  walkAccumMs = 0;
  walkLastFrameMs = 0;
}

function walkFrame(nowMs) {
  walkRafId = requestAnimationFrame(walkFrame);
  const dtMs = walkLastFrameMs ? nowMs - walkLastFrameMs : 0;
  walkLastFrameMs = nowMs;
  walkAccumMs += Math.min(dtMs, WALK_MAX_FRAME_MS);

  let taken = 0;
  while (walkAccumMs >= walkRepeatMs && taken < WALK_MAX_CATCHUP_STEPS) {
    walkAccumMs -= walkRepeatMs;
    taken += 1;
    walkTick();
    // walkTick stops the loop once nothing is held any more; anything after
    // that would be a step taken by a screen that is no longer walking.
    if (walkRafId === null) return;
  }
  // Whatever is left over after the catch-up cap is dropped rather than
  // carried, so a stall can't leave a standing debt that keeps firing
  // double steps long after the frame rate recovered.
  if (walkAccumMs > walkRepeatMs) walkAccumMs = 0;
}

function releaseAllMoveKeys() {
  heldMoveKeys = [];
  lastWalkAxis = null;
  stopWalkTimer();
}

// Which axis a direction key travels on, derived from its own delta rather
// than a second table that could drift out of sync with KEY_TO_DELTA.
function axisOfKey(key) {
  return KEY_TO_DELTA[key][0] !== 0 ? 'h' : 'v';
}

// The most recently pressed key still held on one axis. Most-recent wins so
// that holding Left and then Right (which cancel each other out) walks the
// way you last asked for, rather than deadlocking.
function heldKeyOnAxis(axis) {
  for (let i = heldMoveKeys.length - 1; i >= 0; i--) {
    if (axisOfKey(heldMoveKeys[i]) === axis) return heldMoveKeys[i];
  }
  return null;
}

// Whether a step that way would actually land somewhere - a pure look-ahead
// with none of tryMove's side effects (no gate messages, no tile clearing),
// so it's safe to ask speculatively every tick.
function canStepToward(key) {
  const [dx, dy] = KEY_TO_DELTA[key];
  const current = screenToGlobal(worldGrid, mapConfig.id, state.position.x, state.position.y);
  const resolved = globalToScreen(worldGrid, mapConfig.id, current.gx + dx, current.gy + dy);
  if (!resolved) return false;
  return isPassableTile(tileAt(maps[resolved.screenId], resolved.localX, resolved.localY));
}

// Which way this tick's step goes. Raised by Timothy 2026-09-10: "I don't
// even care if the character can travel diagonally, I actually like that they
// have to go up and then right... I just want to be able to hold both keys to
// make the game do that."
//
// So holding two perpendicular directions alternates between them, walking
// the staircase by hand-holding rather than by pressing keys in turn. This is
// deliberately NOT diagonal movement: every step stays a single cardinal
// move, which means collision, screen-crossing and - most importantly - the
// worn-path trail all keep working exactly as they already do. The trail
// simply records wherever the character actually walked, and a staircase
// connects up like any other route.
function chooseWalkKey() {
  const horizontal = heldKeyOnAxis('h');
  const vertical = heldKeyOnAxis('v');
  if (!horizontal) return vertical;
  if (!vertical) return horizontal;
  const preferred = lastWalkAxis === 'h' ? vertical : horizontal;
  const other = preferred === horizontal ? vertical : horizontal;
  // Alternate, except don't spend the tick walking into a wall while the
  // other direction is still open - hugging an obstacle with both keys down
  // would otherwise drop to half speed and stutter. If both are blocked, fall
  // through to the preferred one so tryMove still reports the blockage the
  // same way a single held key would.
  if (canStepToward(preferred) || !canStepToward(other)) return preferred;
  return other;
}

function stepInDirection(key) {
  const delta = KEY_TO_DELTA[key];
  if (!delta) return;
  lastWalkAxis = axisOfKey(key);
  tryMove(delta[0], delta[1]);
}

// One step per tick in whichever direction is currently held - see
// WALK_REPEAT_INTERVAL_MS.
function walkTick() {
  const key = chooseWalkKey();
  if (!key) {
    stopWalkTimer();
    return;
  }
  stepInDirection(key);
}

function handleKeydown(event) {
  const key = normalizeKey(event.key);
  const delta = KEY_TO_DELTA[key];
  if (delta) {
    // The browser's own auto-repeat is deliberately ignored - walkTick owns
    // the cadence for as long as the key stays down. See
    // WALK_REPEAT_INTERVAL_MS for why.
    if (event.repeat) return;
    if (!heldMoveKeys.includes(key)) heldMoveKeys.push(key);
    startWalkTimer();
    // Step immediately rather than waiting out the first interval, so a
    // single tap responds instantly - and step the way this key points, not
    // whatever the alternation was due next, so pressing a second direction
    // turns straight away instead of a tick later.
    stepInDirection(key);
    return;
  }
  // 'p' for the Circle of Ultimate Portaling - not part of KEY_TO_DELTA
  // since it's an action, not a move. Confirmed non-colliding with
  // battleScreen.js's own p/P (pause): that screen's keydown listener is
  // detached (screenManager.js pause()) whenever this one is active, same
  // reasoning as the documented 's'/parry collision there.
  if (key === 'p') {
    callbacks.onAction('usePortalTool');
  }
}

function handleKeyup(event) {
  const key = normalizeKey(event.key);
  if (!KEY_TO_DELTA[key]) return;
  heldMoveKeys = heldMoveKeys.filter((held) => held !== key);
  if (heldMoveKeys.length === 0) stopWalkTimer();
}

// A window that loses focus never delivers the matching keyup - alt-tabbing
// away mid-walk is the everyday case - which would otherwise leave the key
// recorded as held forever and the character walking off on its own the
// moment focus came back.
function handleWindowBlur() {
  releaseAllMoveKeys();
}

// Window resize can change how many tiles fit in the viewport (see
// computeViewportTileCount) - re-render from scratch to pick that up,
// which also sidesteps the old Safari-specific grid-track-sizing bug this
// function used to work around (that bug was specific to 1fr-stretched
// tracks, which the fixed-pixel-size grid above no longer uses).
function handleResize() {
  if (!rootEl || !mapConfig) return;
  renderFull();
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
  debugNoEncounters = Boolean(props.debugNoEncounters);
  portalTransitionPending = false;
  renderer = resolveRenderer(props.renderer);
  walkRepeatMs = Number.isFinite(props.walkRepeatMs) ? props.walkRepeatMs : WALK_REPEAT_INTERVAL_MS;
  staticCacheEnabled = resolveStaticCacheEnabled(props.staticCache);
  releaseAllMoveKeys();
  Object.assign(state, { visited: markVisited(state.visited, mapConfig.id, state.position.x, state.position.y) });
  renderFull();
  announceScreenIfNew(mapConfig);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('resize', handleResize);
}

export function unmount() {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('keyup', handleKeyup);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('resize', handleResize);
  releaseAllMoveKeys();
  // The canvas renderer holds a requestAnimationFrame loop and its own
  // listeners (hover, devicePixelRatio) - without this they'd outlive the
  // screen and keep drawing into a detached canvas forever. The DOM renderer
  // has nothing running, but implements destroy() too so this call doesn't
  // have to care which renderer is active.
  renderer.destroy();
  viewportEl = null;
  lastTilesWide = 0;
  lastTilesTall = 0;
  lastClusterId = null;
}

export function pause() {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('keyup', handleKeyup);
  // Stops walking outright rather than only muting input: an encounter can
  // fire on a step taken while a direction is still held, and the battle
  // overlay that opens on top must not leave this screen's walk timer
  // ticking underneath it. The keyup that eventually arrives would land on a
  // detached listener anyway, so the held-key record has to be cleared here
  // rather than waiting for it.
  releaseAllMoveKeys();
}

export function resume() {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);
  // A devicePixelRatio change (the browser's own zoom - raised 2026-09-12,
  // a blurry map after closing a dialog) fires no resize event, so nothing
  // else notices one made while a dialog sat on top of this screen. Every
  // other lifecycle path (mount, a step) already re-checks it; resuming from
  // pause was the one gap, since it otherwise only restores input.
  renderer.refreshViewport();
}

// Test-only seam. jsdom has no canvas implementation at all
// (getContext('2d') returns null there), so the canvas renderer draws
// nothing under test and there are no elements to assert against the way
// tests/mapScreenDom.test.js does for the DOM renderer. Exposing the draw
// list instead means the rendering decisions - which glyph, what size, what
// paint order, what the trail's geometry works out to - are all assertable
// as plain data against a real map and real game state, which is strictly
// more than the DOM tests could check (they could see a font-size string,
// not the ordering rules). See tests/mapDrawList.test.js and
// tests/mapTrail.test.js.
//
// Returns the plain viewport list, without the extra margin ring
// mapCanvasRenderer.js adds for its own smooth-camera and overhang needs.
export function __getDrawListForTest() {
  return buildDrawList(buildRenderContext(computeViewportGeometry(viewportEl)));
}

// The render context itself, for tests that need to drive the draw-list
// builders directly rather than take whatever one shape of list comes back -
// see tests/mapStaticLayer.test.js, which asserts how the static/dynamic
// split partitions it.
export function __getRenderContextForTest() {
  return buildRenderContext(computeViewportGeometry(viewportEl));
}

// The hero's on-screen rectangle, for effects that anchor to the player's
// tile from outside this module (js/screens/celebrationEffect.js). Both
// renderers answer this - the DOM one from a real element, the canvas one
// from the camera - which is what lets celebrationEffect.js stop reaching in
// with a '.map-tile-player' querySelector that only one of them produces.
export function getPlayerScreenRect() {
  return renderer.getPlayerScreenRect();
}

// Not exported - only ever called from tryMove itself, right where the
// portal action would otherwise fire immediately (see PORTAL_ACTION_TILES),
// unlike the other effect helpers below which react to a main.js-side state
// change this screen doesn't know about on its own.
function playPortalPullEffect() {
  renderer.playPortalPullEffect(PORTAL_PULL_EFFECT_MS);
}

const LEVEL_UP_EFFECT_DURATION_MS = 1200;

// A level-up always resolves right after a battle overlay unmounts, which
// leaves this screen's last-rendered view (from before the battle started)
// still mounted and resumed underneath - the player's tile is safe to
// address directly rather than needing a fresh render.
export function playLevelUpEffect() {
  playSfx('levelUp');
  renderer.playLevelUpEffect(LEVEL_UP_EFFECT_DURATION_MS);
}

const WELL_HEAL_EFFECT_DURATION_MS = 1100;

// Raised 2026-09-04, "Ring + Warm Landing Glow" from the mockup pass: resting
// at the well used to just silently set HP to max with no on-screen effect
// at all. handleUseWell() (js/main.js) already skips calling this whenever
// the player is already at full HP ("if at full health than no circle"), so
// this only ever needs to handle the "actually healed" case.
export function playWellHealEffect() {
  renderer.playWellHealEffect(WELL_HEAL_EFFECT_DURATION_MS);
}

// Reworked 2026-09-10: "slow down the animation when they enemies fly away
// and make them slowly get bigger as they fly spinning away so you really
// see it." Was 700ms, shrinking to 0.3x with no rotation - the monster
// dwindled to nothing almost immediately, which is exactly what made the
// instant-resolve outcome easy to miss. Now it runs nearly 3x as long,
// grows instead of shrinking, and spins the whole way out.
const MONSTER_FLEE_EFFECT_DURATION_MS = 2000;
const MONSTER_FLEE_DISTANCE_PX = 220;
// Scale at the end of the flight. Above 1 on purpose - the emoji reads as
// coming toward the viewer as it tumbles off, rather than receding.
const MONSTER_FLEE_END_SCALE = 2.6;
const MONSTER_FLEE_SPIN_TURNS = 3;
// Staggered start per monster so a fleeing group doesn't leave as one
// synchronized clump - see startEncounter (js/main.js), which passes each
// monster's index in the encounter.
const MONSTER_FLEE_STAGGER_MS = 120;

// Fired for a weak-mob encounter that resolves (surrender/flee) before the
// battle dialog ever opens - the player still gets to see the monsters
// appear and immediately bail, rather than nothing happening at all. Called
// once per monster in the encounter, with its index for the stagger.
//
// Deliberately stays a document.body element under both renderers rather
// than becoming a canvas draw: it flies MONSTER_FLEE_DISTANCE_PX in a random
// direction and is meant to escape the map viewport entirely (over the HUD,
// past the edge of the world), which anything drawn into the canvas would be
// clipped to. It has no relationship to the tile grid beyond its start point.
// That argument only got stronger when the flight grew to 220px and 2.6x
// scale - it now leaves the viewport by a wide margin.
export function playMonsterFleeEffect(emoji, index = 0) {
  const rect = renderer.getPlayerScreenRect();
  if (!rect) return;
  const el = document.createElement('div');
  el.textContent = emoji;
  el.className = 'map-flee-emoji';
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(el);
  const angle = Math.random() * Math.PI * 2;
  const dx = Math.cos(angle) * MONSTER_FLEE_DISTANCE_PX;
  const dy = Math.sin(angle) * MONSTER_FLEE_DISTANCE_PX;
  // Spin direction is random per monster so a group doesn't all tumble the
  // same way - the flight angle is already random, this keeps the rest of
  // the motion from looking copy-pasted between them.
  const turns = Math.random() < 0.5 ? -MONSTER_FLEE_SPIN_TURNS : MONSTER_FLEE_SPIN_TURNS;
  // A 3-keyframe curve, not 2, and the fade is deliberately pushed into the
  // last stretch: the whole point of the rework is that the flight is
  // watchable, so the emoji has to still be solid while it's growing and
  // spinning. Only the tail end fades.
  //
  // The option-level `easing` is linear on purpose. An easing passed there
  // is NOT a per-segment curve - it remaps the animation's overall progress
  // before keyframe offsets are looked up, so a strong ease-out there drags
  // the whole timeline (opacity included) toward the end frames early. A
  // first cut used cubic-bezier(0.22, 0.61, 0.36, 1) here and measured 44%
  // opacity at 800ms of a 2000ms flight - visually over less than halfway
  // through. Per-keyframe `easing` below eases the outward drift instead,
  // which is the only part that wanted it.
  const midScale = 1 + (MONSTER_FLEE_END_SCALE - 1) * 0.45;
  const animation = el.animate(
    [
      {
        transform: 'translate(-50%, -50%) translate(0, 0) scale(1) rotate(0turn)',
        opacity: 1,
        offset: 0,
        easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)',
      },
      {
        transform: `translate(-50%, -50%) translate(${dx * 0.62}px, ${dy * 0.62}px) scale(${midScale}) rotate(${turns * 0.62}turn)`,
        opacity: 1,
        offset: 0.65,
        easing: 'linear',
      },
      {
        transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${MONSTER_FLEE_END_SCALE}) rotate(${turns}turn)`,
        opacity: 0,
        offset: 1,
      },
    ],
    {
      duration: MONSTER_FLEE_EFFECT_DURATION_MS,
      delay: index * MONSTER_FLEE_STAGGER_MS,
      easing: 'linear',
      fill: 'backwards', // holds the start frame during a staggered monster's delay, so it doesn't pop in unscaled
    },
  );
  animation.onfinish = () => el.remove();
}
