// Everything both map renderers need to agree on: how big a thing draws,
// which tiles are obstacles vs. landmarks vs. decorated ground, and the
// trail's own direction bookkeeping. Pure data and pure functions - no DOM,
// no canvas, no module-level game state - so js/systems/mapDrawList.js can
// be unit tested without a browser and js/screens/mapDomRenderer.js can keep
// behaving exactly as it did when all of this lived inside mapScreen.js.
//
// Split out 2026-09-09 as the first step of the canvas map renderer (see
// docs/superpowers/BACKLOG.md's "Map render performance" sections): the DOM
// and canvas renderers necessarily draw the same world with the same rules,
// and two copies of these sets would drift the moment a new tile kind landed
// in one and not the other. Every comment below is preserved verbatim from
// mapScreen.js, since each one records a specific bug or request.
import { TILES } from '../tiles.js';

export const CACHE_MARKER_EMOJI = '💰';
export const MINI_DUNGEON_MARKER_EMOJI = '🥾';
export const CACHE_MARKER_DESCRIPTION = 'A stash of gold (maybe an item too) — step here to collect it';
export const MINI_DUNGEON_MARKER_DESCRIPTION = 'A mysterious opening — explore it';
// Tool-gated tiles the player can currently cross render a "mount" emoji
// under the player's own emoji instead of replacing it (e.g. riding the
// boat across water rather than turning into a boat).
export const MOUNT_EMOJI_FOR_TOOL = { boat: '🛶' };

// Stepping onto a portal used to fire its action in the same tick as the
// render that first showed the player standing on it - an instant cut with
// no warning. These three get a brief "being pulled in" pause first (see
// mapScreen.js's PORTAL_PULL_EFFECT_MS). Also the set that gets the
// always-on-top paint boost - see the depth-sort comment in mapDrawList.js.
export const PORTAL_ACTION_TILES = new Set([TILES.portalOrigin, TILES.portalReturn, TILES.portalDungeonEntrance]);

// Town's always-on signpost labels (see docs/superpowers/specs/2026-09-03-
// town-exits-and-signage-design.md) - keyed by tile identity, not gated on
// mapConfig.id === 'town', since these 4 tile kinds only ever appear in
// js/maps/townMap.js's own legend.
export const SIGN_LABEL_BY_TILE = new Map([
  [TILES.shop, 'Shop'],
  [TILES.smith, 'Blacksmith'],
  [TILES.questBoard, 'Quest Board'],
  [TILES.well, 'Well'],
]);

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
export const RANDOM_SIZE_OBSTACLES = new Set([TILES.tree, TILES.mountain, TILES.mountainCache, TILES.mountainWall, TILES.thicket, TILES.thicketCache]);

// Fixed real pixel size for every tile - the viewport's own CSS size
// (.map-viewport in css/styles.css) then determines how many whole tiles
// fit, which is what makes a smaller window/screen naturally show less of
// the stitched world. Tunable; not load-bearing for correctness.
export const TILE_SIZE_PX = 48;
// Shared "fills the tile" reference size, in real px derived from
// TILE_SIZE_PX (used to be a `cqb` percentage read against a `container-type:
// size` on .map-tile - dropped 2026-09-09, since TILE_SIZE_PX above is a
// fixed constant, never actually variable at runtime, so the per-tile size
// containment a container query needs was solving a problem that didn't
// exist and cost real layout performance for no benefit) - used both as the
// obstacles' 100% baseline (see OBSTACLE_MAX_EXTRA below) and, unscaled, for
// landmarks that should always read as prominent/findable rather than
// small: town and cave/dungeon entrances. The hero and loot get their own,
// slightly smaller size - see HERO_AND_LOOT_PX.
export const FULL_SQUARE_PX = 0.85 * TILE_SIZE_PX;
export const HERO_AND_LOOT_PX = 0.75 * TILE_SIZE_PX;
export const OBSTACLE_MAX_EXTRA = 0.5; // up to +50% (150% total, i.e. 50% overlap)
// Raised 2026-09-07: "make the tool bosses take up like 4 tiles instead
// of 1 so they look big and scary." Reuses .map-tile-fullsize's own
// centered-flex-box-with-overflow-visible rendering rather than a real
// multi-cell sprite - .map-tile-obstacle already proves an oversized child
// span happily bleeds past its own tile's edges into neighbors with zero
// grid/collision changes, so the guardian's actual walkable/action tile
// underneath stays exactly one cell. 220% centered bleeds ~60% of a tile
// width into all four neighbors (left/right/above/below), reading as
// roughly a 2x2 footprint. It also needs the same always-on-top treatment
// portals get - see the depth-sort comment in mapDrawList.js.
export const GUARDIAN_PX = 2.2 * TILE_SIZE_PX;

// jsdom has no real layout engine (tests/helpers/dom.js), so
// .clientWidth/.clientHeight always read 0 there - this is the fallback
// viewport size used whenever a real measurement isn't available, keeping
// DOM tests deterministic without needing to stub layout. Not a real-browser
// floor (see css/styles.css - .map-viewport fills whatever space #app has,
// no fixed cap) - chosen only because it comfortably clears dungeonMap's
// 20x11, same as any normal desktop window does today. As of the
// 2026-09-03 resize, town (js/maps/townMap.js) is 20x14 and is actually
// the tallest non-wilderness map now, 1 row taller than this fallback's
// height - so jsdom-based tests of town pan slightly and don't render its
// full extent (e.g. town's row 0, where the north exit gap sits, isn't
// visible in the default fallback viewport).
export const DEFAULT_VIEWPORT_TILES_WIDE = 21;
export const DEFAULT_VIEWPORT_TILES_TALL = 13;

// Important landmarks the player needs to spot at a glance - always full
// size, never randomized/overlapping (unlike RANDOM_SIZE_OBSTACLES, these
// are single landmarks, not a forest of them).
export const FULL_SQUARE_MARKERS = new Set([
  TILES.townEntrance,
  TILES.dungeonEntrance,
  TILES.axeDungeonEntrance,
  TILES.pickDungeonEntrance,
  TILES.canoeDungeonEntrance,
  TILES.superBossEntrance,
  TILES.superBossMarker,
  TILES.miniDungeonEntrance,
  TILES.miniDungeonTreasure,
  // Raised 2026-09-06: these three were missing from this set, so - per
  // the "append earlier = paints behind" comment on the trail-fragment
  // append below - a portal's plain in-flow emoji had no `position`,
  // meaning the trail SVG (which IS positioned) always painted on top of
  // it regardless of DOM order. Full-size marker rendering fixes that for
  // free, the same way it already does for every other landmark tile.
  TILES.portalOrigin,
  TILES.portalReturn,
  TILES.portalDungeonEntrance,
  // The town interior's own action tiles - previously missing from this
  // set, so they fell through to the tiny plain-text render (the
  // .map-tile's own 1.2rem font-size) instead of reading as landmarks.
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
  TILES.guardian,
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
export const GRASS_CONTEXT_MARKERS = new Set([
  TILES.townEntrance,
  TILES.dungeonEntrance,
  TILES.axeDungeonEntrance,
  TILES.pickDungeonEntrance,
  TILES.canoeDungeonEntrance,
  TILES.superBossEntrance,
  TILES.superBossMarker,
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
  TILES.guardian,
  TILES.treeGapNorth,
  TILES.treeGapSouth,
  TILES.treeGapEast,
  TILES.treeGapWest,
]);

// A cleared thicket/mountain (see CLEARED_GATE_REPLACEMENT in mapScreen.js)
// reads as ordinary ground with a small always-visible marker, the same
// treatment as grass's own occasional clover/flower - not a tall obstacle
// (unlike the thicket/mountain it replaces) and not a big single landmark
// either, so it shares grass's own decoration/background code path rather
// than either of those. Deliberately unconditional (same map-context-agnostic
// treatment RANDOM_SIZE_OBSTACLES already gives thicket/mountain themselves,
// e.g. the axe-gated thicket inside the dragon dungeon) rather than trying to
// match whichever floor tile (grass vs. cave) happens to sit underneath.
export const STUMP_AND_RUBBLE = new Set([TILES.stump, TILES.rubble]);

// Every trail fragment uses this fixed 0..100 coordinate space (independent
// of the tile's actual rendered pixel size) - trail.js's wear/geometry
// functions already return numbers on roughly this scale. The DOM renderer
// stretches it to the tile via an SVG viewBox; the canvas renderer scales
// its own transform by TILE_SIZE_PX / TRAIL_VIEWBOX_SIZE and then uses every
// one of trail.js's numbers verbatim, so neither has to convert units.
export const TRAIL_VIEWBOX_SIZE = 100;
export const TRAIL_DIRECTIONS = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
export const TRAIL_DIR_DELTA = Object.fromEntries(TRAIL_DIRECTIONS.map(([dir, dx, dy]) => [dir, [dx, dy]]));
export const TRAIL_OPPOSITE_DIR = { n: 's', s: 'n', e: 'w', w: 'e' };

// Grass decoration (clover/flower) sizing and placement: smaller than a
// full tile and scattered around it rather than dead-center, so a field of
// them reads as scattered growth instead of a uniform grid of icons.
export const DECORATION_BASE_REM = 1.2;
export const DECORATION_MIN_SCALE = 0.65;
export const DECORATION_MAX_SCALE = 1.05;
export const DECORATION_POSITION_MIN_PCT = 28;
export const DECORATION_POSITION_MAX_PCT = 72;
// The canvas renderer has no `rem` to resolve against, so it needs the
// decoration's base size in real pixels. The DOM renderer keeps emitting
// rem (unchanged behavior); this constant is what the two agree on, and it
// assumes the document's default 16px root font size the way every other
// rem in css/styles.css already does.
export const DECORATION_BASE_PX = DECORATION_BASE_REM * 16;

// The ground each tile paints underneath everything else. The DOM renderer
// expresses this as a CSS class (.map-tile-grass / .map-tile-water / the
// bare .map-tile default); canvas needs the literal color. Kept in sync with
// css/styles.css by hand - and with trail.js's own
// TRAIL_GROUND_COLOR_BY_TILE, which encodes the same three colors for the
// trail's blend-toward-the-ground math.
export const GROUND_COLOR_DEFAULT = '#333333';
export const GROUND_COLOR_GRASS = '#3f6b34';
export const GROUND_COLOR_WATER = '#2b6cb0';

// Whether a tile paints the contiguous grass background. Obstacles grow out
// of the grass, so they keep its green rather than looking like a hole cut
// in the field. Grass-context landmarks (town/wilderness/dungeon action
// tiles) are their own distinct tile type but conceptually sit on that same
// grass, so they get it too. Stump/rubble (what those obstacles become once
// cleared) get the same treatment as grass itself, not just the obstacle set.
export function isGrassBackground(tile) {
  return tile === TILES.grass || STUMP_AND_RUBBLE.has(tile)
    || RANDOM_SIZE_OBSTACLES.has(tile) || GRASS_CONTEXT_MARKERS.has(tile);
}

export function groundColorFor(tile) {
  if (isGrassBackground(tile)) return GROUND_COLOR_GRASS;
  if (tile === TILES.water) return GROUND_COLOR_WATER;
  return GROUND_COLOR_DEFAULT;
}
