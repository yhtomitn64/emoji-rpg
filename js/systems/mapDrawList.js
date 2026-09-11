// Turns the visible world into an ordered list of draw operations. Pure:
// no DOM, no canvas, no module-level game state - every input arrives on the
// render context object mapScreen.js builds, and the output is plain data.
//
// This split is the whole reason the canvas renderer is testable. jsdom has
// no canvas implementation (getContext('2d') returns null there), so
// asserting "does the guardian render oversized" against real pixels would
// need a browser. Against this list it's a plain deepEqual on numbers, and
// the painter (js/screens/mapCanvasRenderer.js) stays a thin loop with
// nothing worth testing in it. It also keeps a future WebGL painter a
// contained swap rather than a second rewrite.
//
// Ops carry world tile coordinates (gx, gy) plus geometry in tile-local
// space, never screen pixels - so the list is independent of where the
// camera happens to be, and a smooth (fractional) camera offset is purely
// the painter's business.
import { TILES } from '../tiles.js';
import { pickTileVariant, hash01 } from './world.js';
import {
  trailStrokeWidthBetween, trailBorderFraction, trailDotRadius, trailHubRadius,
  edgeOwner, edgeJitter, connectorPathPoints,
  getTrailColor, getGroundColor, trailColorForFraction,
} from './trail.js';
import {
  CACHE_MARKER_EMOJI, MINI_DUNGEON_MARKER_EMOJI, CACHE_MARKER_DESCRIPTION, MINI_DUNGEON_MARKER_DESCRIPTION,
  MOUNT_EMOJI_FOR_TOOL, PORTAL_ACTION_TILES, SIGN_LABEL_BY_TILE, RANDOM_SIZE_OBSTACLES,
  TILE_SIZE_PX, FULL_SQUARE_PX, HERO_AND_LOOT_PX, OBSTACLE_MAX_EXTRA, GUARDIAN_PX,
  FULL_SQUARE_MARKERS, STUMP_AND_RUBBLE, groundColorFor,
  TRAIL_VIEWBOX_SIZE, TRAIL_DIR_DELTA,
  DECORATION_BASE_PX, DECORATION_MIN_SCALE, DECORATION_MAX_SCALE,
  DECORATION_POSITION_MIN_PCT, DECORATION_POSITION_MAX_PCT,
  GROUND_COLOR_DEFAULT,
} from './mapRenderModel.js';

// CSS rem values from css/styles.css resolved to real pixels, since canvas
// has no rem to resolve against. Each assumes the document's default 16px
// root font size, exactly as every other rem in that stylesheet already
// does. The DOM renderer keeps using the CSS; these are the canvas
// renderer's translation of the same numbers.
const TILE_FONT_PX = 1.2 * 16;      // .map-tile's own font-size (the plain fallback branch)
const MOUNT_FONT_PX = 1.2 * 16;     // .map-tile-mount
const RIDER_FONT_PX = 0.85 * 16;    // .map-tile-rider
const RIDER_OFFSET_Y_PX = -3;       // .map-tile-rider's transform: translateY(-3px)
export const SIGNPOST_FONT_PX = 0.6 * 16; // .map-tile-signpost

// Glyph anchoring inside a tile, matching how each CSS class positions its
// own span:
//   'center' - .map-tile-fullsize / .map-tile-mount (inset 0, centered flex)
//   'bottom' - .map-tile-obstacle (bottom: 0, align-items: flex-end), which
//              is what makes a tall obstacle bleed upward into the row above
//              instead of growing symmetrically out of its own tile
//   'top'    - .map-tile-rider (align-items: flex-start)
//   'point'  - .map-tile-decoration (absolute left/top + translate(-50%,-50%))
export const ANCHOR_CENTER = 'center';
export const ANCHOR_BOTTOM = 'bottom';
export const ANCHOR_TOP = 'top';
export const ANCHOR_POINT = 'point';

// The hover text a tile shows. Was the cell's `title` attribute under the
// DOM renderer; canvas has no native equivalent, so mapCanvasRenderer.js
// hit-tests the pointer and renders its own tooltip from this.
export function describeSignature(signature) {
  if (!signature.resolved) return '';
  if (signature.hasMiniDungeon) return MINI_DUNGEON_MARKER_DESCRIPTION;
  if (signature.hasTileCache) return CACHE_MARKER_DESCRIPTION;
  return signature.tile.description;
}

// One tile's own worn-path trail, as numbers rather than SVG nodes. Every
// value here is in trail.js's own 0..TRAIL_VIEWBOX_SIZE coordinate space and
// is used by the painter verbatim - it scales its transform by
// TILE_SIZE_PX / TRAIL_VIEWBOX_SIZE and then draws these numbers directly,
// so no unit conversion happens anywhere and the canvas output can't drift
// from what the SVG produced.
//
// The design this encodes (see docs/superpowers/specs/2026-08-25-worn-path-
// trail-design.md, and the long comment on buildTrailFragment in
// mapDomRenderer.js): each stroke's color tapers from this tile's own wear
// at the center toward the *border fraction* it shares with the connected
// neighbor at the edge - not the neighbor's own raw fraction, which put two
// different colors on the same physical point and produced a hard color wall
// confirmed live on a real save. Wear is baked entirely into color, never
// opacity, so overlapping strokes at a junction simply paint over each other
// with no compositing artifact possible.
function buildTrailOp(ctx, gx, gy, signature) {
  const { tile, dirs, fraction } = signature;
  const color = getTrailColor(tile);
  const groundColor = getGroundColor(tile);
  const centerColor = trailColorForFraction(color, groundColor, fraction);

  if (dirs.length === 0) {
    // Visited but nothing walked across it yet - a small centered dot.
    return {
      op: 'trail', gx, gy, strokes: [],
      dot: { r: trailDotRadius(fraction), color: centerColor },
      hub: null,
    };
  }

  const strokes = [];
  const widths = [];
  for (const dir of dirs) {
    // The edge between two tiles is owned by whichever has the lower
    // coordinate on that axis, so both sides jitter it identically and no
    // seam appears - see edgeOwner/edgeJitter in trail.js.
    const owner = edgeOwner(gx, gy, dir);
    const jitter = edgeJitter(owner.x, owner.y, owner.axis);
    const [dx, dy] = TRAIL_DIR_DELTA[dir];
    const neighborFraction = ctx.neighborWearFraction(gx + dx, gy + dy);
    const width = trailStrokeWidthBetween(fraction, neighborFraction);
    widths.push(width);
    strokes.push({
      dir,
      // Control points straight from trail.js - the painter feeds these to
      // moveTo/quadraticCurveTo, which is exactly what the SVG's
      // "M cx cy Q qx qy tx ty" meant.
      ...connectorPathPoints(dir, jitter, TRAIL_VIEWBOX_SIZE),
      width,
      fromColor: centerColor,
      toColor: trailColorForFraction(color, groundColor, trailBorderFraction(fraction, neighborFraction)),
    });
  }

  // A fork where two connected directions have different widths leaves a
  // hard rectangular notch at the shared center (a stroke can't taper its
  // width along its length). A solid hub sized to the widest connected
  // stroke covers it, so narrower strokes emerge from inside the hub rather
  // than butting up against a wider neighbor. A single direction has no
  // other width to clash with, so it's skipped.
  return {
    op: 'trail', gx, gy, strokes,
    dot: null,
    hub: dirs.length > 1 ? { r: trailHubRadius(widths), color: centerColor } : null,
  };
}

// Every op for one tile, in paint order within that tile. Mirrors
// applyCellContent's branch structure in mapDomRenderer.js exactly - the two
// have to agree, since `?renderer=dom` lets them be compared side by side on
// the same save.
function buildCellOps(ctx, gx, gy, signature, out) {
  if (!signature.resolved) {
    // Reachable whenever the viewport is bigger than the current screen's
    // whole cluster (computeViewportOrigin centers it instead of panning past
    // its edges) - true for town, mini-dungeons and tool dungeons. These
    // padding cells render as bare ground, the same as .map-tile's own
    // default background did.
    out.push({ op: 'ground', gx, gy, color: GROUND_COLOR_DEFAULT });
    return;
  }

  const { x, y, tile, isPlayer, hasMiniDungeon, hasTileCache, visited, questReady } = signature;

  out.push({ op: 'ground', gx, gy, color: groundColorFor(tile) });

  // An inset box-shadow paints above the background but below any content,
  // so this sits between ground and everything else - matching where
  // .map-tile-quest-ready's own glow lands.
  if (questReady) out.push({ op: 'questGlow', gx, gy });

  // .map-tile-portal::before - a soft shadow that deliberately bleeds
  // OUTSIDE the tile into its neighbors. First positioned child, so it
  // paints under the portal's own emoji.
  if (PORTAL_ACTION_TILES.has(tile)) out.push({ op: 'portalShadow', gx, gy });

  if (visited) out.push(buildTrailOp(ctx, gx, gy, signature));

  const emoji = hasMiniDungeon ? MINI_DUNGEON_MARKER_EMOJI : hasTileCache ? CACHE_MARKER_EMOJI : pickTileVariant(tile, x, y);
  const mountEmoji = isPlayer && tile.requiresTool && ctx.hasToolFor(tile)
    ? MOUNT_EMOJI_FOR_TOOL[tile.requiresTool] : null;
  const isRandomSizeObstacle = !hasMiniDungeon && !hasTileCache && RANDOM_SIZE_OBSTACLES.has(tile);
  const isFullSquareMarker = hasMiniDungeon || hasTileCache || FULL_SQUARE_MARKERS.has(tile);
  const isDecoratedGrass = !isFullSquareMarker && (tile === TILES.grass || STUMP_AND_RUBBLE.has(tile)) && emoji !== '';

  // Independently-salted hash streams so size and position don't move in
  // lockstep with each other or with the decoration pick.
  function pushDecoration() {
    const scale = DECORATION_MIN_SCALE + hash01(x + 1000, y + 1000) * (DECORATION_MAX_SCALE - DECORATION_MIN_SCALE);
    const left = DECORATION_POSITION_MIN_PCT + hash01(x + 2000, y + 2000) * (DECORATION_POSITION_MAX_PCT - DECORATION_POSITION_MIN_PCT);
    const top = DECORATION_POSITION_MIN_PCT + hash01(x + 3000, y + 3000) * (DECORATION_POSITION_MAX_PCT - DECORATION_POSITION_MIN_PCT);
    out.push({
      op: 'glyph', gx, gy, emoji, sizePx: DECORATION_BASE_PX * scale,
      anchor: ANCHOR_POINT,
      pointX: (left / 100) * TILE_SIZE_PX,
      pointY: (top / 100) * TILE_SIZE_PX,
    });
  }

  if (mountEmoji) {
    // Riding across a tool-gated tile (the boat on water) renders the mount
    // under the hero rather than replacing them.
    // The boat rides along with the hero (followsHero) but is not the hero
    // (isPlayer), so an effect that redraws the hero itself - a level-up
    // pulse, a portal pull - replaces only the rider and leaves the boat.
    out.push({ op: 'glyph', gx, gy, emoji: mountEmoji, sizePx: MOUNT_FONT_PX, anchor: ANCHOR_CENTER, followsHero: true });
    out.push({ op: 'glyph', gx, gy, emoji: ctx.playerEmoji, sizePx: RIDER_FONT_PX, anchor: ANCHOR_TOP, offsetYPx: RIDER_OFFSET_Y_PX, isPlayer: true, followsHero: true });
  } else if (isRandomSizeObstacle) {
    // 100-150% of a tile, deterministic per position, bottom-anchored so the
    // canopy overlaps into the row above.
    out.push({
      op: 'glyph', gx, gy, emoji,
      sizePx: FULL_SQUARE_PX * (1 + hash01(x, y) * OBSTACLE_MAX_EXTRA),
      anchor: ANCHOR_BOTTOM,
    });
  } else if (isFullSquareMarker || isPlayer) {
    // The hero can land on a decorated grass tile - emit the decoration
    // first so it peeks out from behind them instead of hiding them.
    if (isDecoratedGrass) pushDecoration();
    let sizePx = FULL_SQUARE_PX;
    const isHeroOrLoot = isPlayer || hasTileCache || tile === TILES.miniDungeonTreasure;
    if (isHeroOrLoot) sizePx = HERO_AND_LOOT_PX;
    // "Big and scary" - 220% bleeds into all four neighbors, reading as
    // roughly a 2x2 footprint while the walkable tile stays one cell.
    if (tile === TILES.guardian) sizePx = GUARDIAN_PX;
    // Portal tiles crop the 🌌 emoji's own baked-in pale border by drawing it
    // oversized and clipping back to the tile. Excludes isPlayer: standing on
    // a portal draws the hero's emoji, which has no border to crop.
    const cropped = PORTAL_ACTION_TILES.has(tile) && !isPlayer;
    out.push({
      op: 'glyph', gx, gy,
      emoji: isPlayer ? ctx.playerEmoji : emoji,
      sizePx, anchor: ANCHOR_CENTER, cropped,
      isPlayer: Boolean(isPlayer),
      followsHero: Boolean(isPlayer),
    });
  } else if (isDecoratedGrass) {
    pushDecoration();
  } else if (emoji) {
    out.push({ op: 'glyph', gx, gy, emoji, sizePx: TILE_FONT_PX, anchor: ANCHOR_CENTER });
  }

  const signLabel = SIGN_LABEL_BY_TILE.get(tile);
  if (signLabel) out.push({ op: 'label', gx, gy, text: signLabel });
}

// The visible world in paint order.
//
// Depth-sorting reproduces the DOM renderer's row-based z-index scheme
// exactly: each .map-tile got `z-index = row`, so a row paints entirely over
// the row above it (which is what lets a tall obstacle's canopy overlap
// upward while a player standing below it still renders in front), and
// within a row later columns paint over earlier ones. Portals and guardians
// got a flat +1000 on top of that, so they always paint last regardless of
// row - a portal's shadow bleeds into every neighbor including ones later in
// the same row, and a guardian at 220% bleeds downward into the row below,
// which would otherwise clip it.
//
// So: one row-major pass over ordinary cells, then a second row-major pass
// over the z-boosted ones.
export function buildDrawList(ctx) {
  const layered = buildLayeredDrawList(ctx, { splitDynamic: false });
  return {
    ops: layered.staticOps,
    playerTile: layered.playerTile,
    hasContinuousAnimation: layered.hasContinuousAnimation,
  };
}

// Whether a cell has to be redrawn every frame rather than living in the
// cached static layer.
//
// The split is static-vs-ANIMATED, deliberately not floor-vs-sprite. Paint
// order here is per-cell interleaved (a cell's ground paints over the
// previous cell's overhanging tree - see buildDrawList's own header), so
// hoisting every floor into one layer and every sprite into another would
// visibly change obstacle overlap and how trail strokes end at unvisited
// tiles. Caching whole cells keeps that interleaving exactly.
//
// A NOTE ON WHAT IS *NOT* HERE, because the first attempt got it wrong and
// Timothy caught it: the live set used to also include a 3x3 block around
// the player. That block punched a hole in the cached layer and refilled it
// each frame - and refilling it repainted the block's own ground, which
// erased anything overhanging INTO the block from outside it. Two bugs, one
// cause: tall trees one row below the block lost their canopies, and a
// signpost's plank vanished whenever the player stood in the row above it
// (sign labels draw entirely in the row above their own tile - see
// drawLabel). Enlarging the block would only have moved the seam further
// out; you cannot overdraw a sub-rectangle of an interleaved scene without
// losing the overhang from outside it.
//
// The player's cell never needed to be live anyway: the hero and anything
// riding with them are `followsHero` ops, which paint() already holds back
// and draws after every tile. So the cache keeps every cell, and the live
// layer is only the things that genuinely differ frame to frame.
export function isDynamicCell(signature) {
  // Portal shadows and the quest-board glow pulse on a clock of their own.
  // Portals and guardians (zBoosted) are drawn last in the scene by design
  // already, so keeping them live costs no ordering fidelity at all.
  return Boolean(signature.resolved && (signature.questReady || signature.zBoosted));
}

// One row-major pass, sorting each cell into the cached layer or the live
// one. `splitDynamic: false` puts everything in staticOps, which is what
// buildDrawList above (and so the DOM-parity tests) still wants.
//
// `animatedCells` comes back so the painter can rebuild the live layer each
// frame without re-scanning the viewport: portals and quest boards never
// move, so the list stays valid as long as the cached layer does.
export function buildLayeredDrawList(ctx, { splitDynamic = true } = {}) {
  const { tilesWide, tilesTall, originGx, originGy } = ctx;
  const staticOps = [];
  const dynamicOps = [];
  const boosted = [];
  const animatedCells = [];
  const cellOps = [];
  let playerTile = null;
  // Whether anything visible animates on its own (independent of the player
  // moving), so the painter knows to keep a requestAnimationFrame loop alive
  // instead of drawing once and going idle.
  let hasContinuousAnimation = false;

  // A followsHero op is drawn at the hero's interpolated position, which
  // moves every frame - baking one into the cache would leave a second,
  // frozen hero behind. They always belong to the live layer.
  const sortCell = (live) => {
    for (const op of cellOps) {
      if (splitDynamic && (live || op.followsHero)) dynamicOps.push(op);
      else staticOps.push(op);
    }
    cellOps.length = 0;
  };

  for (let vr = 0; vr < tilesTall; vr++) {
    for (let vc = 0; vc < tilesWide; vc++) {
      const gx = originGx + vc;
      const gy = originGy + vr;
      const signature = ctx.signatureAt(gx, gy);
      if (signature.resolved && signature.isPlayer) playerTile = { gx, gy };
      const live = isDynamicCell(signature);
      if (live) {
        hasContinuousAnimation = hasContinuousAnimation
          || signature.questReady || PORTAL_ACTION_TILES.has(signature.tile);
        animatedCells.push({ gx, gy });
      }
      if (signature.zBoosted) {
        boosted.push({ gx, gy, signature, live });
        // A z-boosted tile still needs its ground painted in the normal pass,
        // or the row-major fill would leave a hole where it sits - only its
        // content is deferred. The boosted pass re-emits ground harmlessly
        // over the same rect, so this keeps the two passes independent. The
        // ground is never animated, so it stays cached either way.
        staticOps.push({ op: 'ground', gx, gy, color: groundColorFor(signature.tile) });
        continue;
      }
      buildCellOps(ctx, gx, gy, signature, cellOps);
      sortCell(live);
    }
  }

  for (const { gx, gy, signature, live } of boosted) {
    buildCellOps(ctx, gx, gy, signature, cellOps);
    sortCell(live);
  }

  return { staticOps, dynamicOps, animatedCells, playerTile, hasContinuousAnimation };
}

// The live layer alone, for a frame reusing an already-painted static layer.
// Visits the player's cell (for the hero and anything riding with them) plus
// the handful of known animated cells - never the whole viewport, which is
// where most of the per-frame JS cost used to go.
export function buildDynamicOps(ctx, animatedCells) {
  const { playerGx, playerGy } = ctx;
  const ops = [];
  const boosted = [];
  const cellOps = [];
  let playerTile = null;

  // The player's cell contributes ONLY its followsHero ops. Its ground,
  // trail and any decoration are in the cached layer and must not be
  // repainted here - doing so is exactly the bug described on isDynamicCell.
  const playerSignature = ctx.signatureAt(playerGx, playerGy);
  if (playerSignature.resolved && playerSignature.isPlayer) {
    playerTile = { gx: playerGx, gy: playerGy };
  }
  buildCellOps(ctx, playerGx, playerGy, playerSignature, cellOps);
  for (const op of cellOps) if (op.followsHero) ops.push(op);
  cellOps.length = 0;

  for (const { gx, gy } of animatedCells) {
    const signature = ctx.signatureAt(gx, gy);
    if (signature.zBoosted) {
      boosted.push({ gx, gy, signature });
      continue;
    }
    buildCellOps(ctx, gx, gy, signature, ops);
  }

  // Boosted last, matching the full pass's own two-pass order.
  for (const { gx, gy, signature } of boosted) {
    buildCellOps(ctx, gx, gy, signature, ops);
  }

  return { ops, playerTile };
}

