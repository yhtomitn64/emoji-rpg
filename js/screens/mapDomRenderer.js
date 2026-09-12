// The original DOM/CSS-Grid map renderer, moved here verbatim from
// mapScreen.js 2026-09-09 when the canvas renderer landed alongside it.
//
// TEMPORARY - reachable only via `?renderer=dom` (see mapScreen.js's
// resolveRenderer). It exists so the two renderers can be A/B'd live in one
// build on the same save, which is how the canvas rewrite gets confirmed as
// an actual improvement rather than assumed to be one; the previous perf
// session had to `git stash`/pop to compare, which can't be done mid-session
// on a running page. Delete this file (and its CSS, and the flag) once the
// canvas renderer is confirmed better - it's deliberately self-contained so
// that's a one-file removal.
//
// Everything here behaves exactly as it did inside mapScreen.js. The only
// changes made while moving it: shared constants now come from
// js/systems/mapRenderModel.js instead of being defined locally, live game
// state is read off the render context object rather than mapScreen's module
// globals, and buildTrailFragment lost two parameters (x, y) that it never
// used. See docs/superpowers/BACKLOG.md's "Map render performance" sections
// for why this whole approach hit a ceiling.
import { TILES } from '../tiles.js';
import { pickTileVariant, hash01 } from '../systems/world.js';
import {
  trailStrokeWidthBetween, trailBorderFraction, trailDotRadius, trailHubRadius,
  edgeOwner, edgeJitter, edgeTargetPoint, connectorPathD,
  getTrailColor, getGroundColor, trailColorForFraction,
} from '../systems/trail.js';
import {
  CACHE_MARKER_EMOJI, MINI_DUNGEON_MARKER_EMOJI, CACHE_MARKER_DESCRIPTION, MINI_DUNGEON_MARKER_DESCRIPTION,
  MOUNT_EMOJI_FOR_TOOL, PORTAL_ACTION_TILES, SIGN_LABEL_BY_TILE, RANDOM_SIZE_OBSTACLES,
  TILE_SIZE_PX, FULL_SQUARE_PX, HERO_AND_LOOT_PX, OBSTACLE_MAX_EXTRA, GUARDIAN_PX,
  FULL_SQUARE_MARKERS, STUMP_AND_RUBBLE, isGrassBackground,
  TRAIL_VIEWBOX_SIZE, TRAIL_DIR_DELTA,
  DECORATION_BASE_REM, DECORATION_MIN_SCALE, DECORATION_MAX_SCALE,
  DECORATION_POSITION_MIN_PCT, DECORATION_POSITION_MAX_PCT,
} from '../systems/mapRenderModel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Persistent grid state for renderStep()'s diffing. gridEl/viewportEl are the
// current .map-grid/.map-viewport elements, kept alive across steps instead of
// torn down and rebuilt every time (the old behavior, and the root cause of
// the large-window hitching this diffing replaced). cellCache maps a world
// coordinate (`${gx},${gy}`) to the cell element currently showing it, its
// current on-screen (row, col), and the logical signature last used to build
// its content - keyed by world coordinate (not screen row/col) because the
// camera pans under the player, so a cell's on-screen position changes far
// more often than its content does.
let gridEl = null;
let viewportEl = null;
let cellCache = new Map();

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
function buildTrailFragment(ctx, gx, gy, dirs, fraction, color, groundColor) {
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
    const neighborFraction = ctx.neighborWearFraction(gx + dx, gy + dy);
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

// Rebuilds one cell's content in place from a signature - used both for a
// brand-new cell and for an existing cell whose signature just changed
// (renderStep() clears the cell's children first in that second case).
function applyCellContent(ctx, cell, gx, gy, signature) {
  // Reachable whenever the viewport is bigger than the current screen's
  // whole cluster (computeViewportOrigin then centers the cluster inside
  // the viewport instead of panning past its edges - see
  // js/systems/world.js) - true for every map smaller than the viewport:
  // town, mini-dungeons, tool dungeons. The padding cells around that
  // centered cluster resolve to nothing here and render as a bare,
  // content-less .map-tile.
  if (!signature.resolved) {
    cell.className = 'map-tile';
    cell.removeAttribute('title');
    return;
  }
  const { x, y, tile, isPlayer, hasMiniDungeon, hasTileCache, visited, fraction, dirs, questReady } = signature;
  // Obstacles grow out of the grass, so they keep its green background
  // rather than looking like a hole cut in the field - see
  // RANDOM_SIZE_OBSTACLES. Grass-context landmarks (town/wilderness/dungeon
  // action tiles) are their own distinct tile type but conceptually sit on
  // that same grass, so they get it too - see GRASS_CONTEXT_MARKERS.
  // Stump/rubble (what those obstacles become once cleared) get the same
  // treatment as grass itself, not just the obstacle set.
  cell.className = 'map-tile'
    + (isGrassBackground(tile) ? ' map-tile-grass' : '')
    + (tile === TILES.water ? ' map-tile-water' : '')
    + (isPlayer ? ' map-tile-player' : '')
    + (questReady ? ' map-tile-quest-ready' : '')
    + (tile === TILES.portalOrigin ? ' map-tile-portal map-tile-portal-origin' : '')
    + (tile === TILES.portalReturn ? ' map-tile-portal map-tile-portal-return' : '')
    + (tile === TILES.portalDungeonEntrance ? ' map-tile-portal' : '');
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
  if (visited) {
    const color = getTrailColor(tile);
    const groundColor = getGroundColor(tile);
    cell.appendChild(buildTrailFragment(ctx, gx, gy, dirs, fraction, color, groundColor));
  }
  const emoji = hasMiniDungeon ? MINI_DUNGEON_MARKER_EMOJI : hasTileCache ? CACHE_MARKER_EMOJI : pickTileVariant(tile, x, y);
  const mountEmoji = isPlayer && tile.requiresTool && ctx.hasToolFor(tile)
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
    rider.textContent = ctx.playerEmoji;
    cell.append(mount, rider);
  } else if (isRandomSizeObstacle) {
    const obstacle = document.createElement('span');
    obstacle.className = 'map-tile-obstacle';
    obstacle.textContent = emoji;
    const size = FULL_SQUARE_PX * (1 + hash01(x, y) * OBSTACLE_MAX_EXTRA);
    obstacle.style.fontSize = `${size.toFixed(1)}px`;
    cell.appendChild(obstacle);
  } else if (isFullSquareMarker || isPlayer) {
    // The hero can land on a decorated grass tile - render the
    // decoration first so it still peeks out from behind the hero
    // instead of the hero vanishing behind it (the old bug: this
    // branch used to be checked *after* isDecoratedGrass, so the
    // decoration won outright and hid the player entirely).
    if (isDecoratedGrass) appendDecoration();
    // The hero is always full-square.
    const marker = document.createElement('span');
    marker.className = 'map-tile-fullsize';
    marker.textContent = isPlayer ? ctx.playerEmoji : emoji;
    // Hero and loot read better a touch smaller than town/cave
    // entrances - FULL_SQUARE_PX stays the default for everything else
    // in this branch (set inline below, since every fullsize marker now
    // gets its font-size from a single source of truth rather than
    // splitting the default between CSS and these overrides).
    marker.style.fontSize = `${FULL_SQUARE_PX.toFixed(1)}px`;
    const isHeroOrLoot = isPlayer || hasTileCache || tile === TILES.miniDungeonTreasure;
    if (isHeroOrLoot) marker.style.fontSize = `${HERO_AND_LOOT_PX.toFixed(1)}px`;
    // "Big and scary" - see GUARDIAN_PX's own comment.
    if (tile === TILES.guardian) marker.style.fontSize = `${GUARDIAN_PX.toFixed(1)}px`;
    // Portal tiles: crop the emoji's own baked-in border rather than
    // appending it plain - see .map-tile-portal-crop's own comment in
    // css/styles.css. Excludes isPlayer: when the hero is standing on
    // the portal tile, marker.textContent above is the hero's own
    // emoji, not 🌌 - that one has no border to crop and must stay
    // unscaled for playPortalPullEffect's own selector/animation to
    // read its real, un-transformed size.
    if (PORTAL_ACTION_TILES.has(tile) && !isPlayer) {
      const crop = document.createElement('span');
      crop.className = 'map-tile-portal-crop';
      crop.appendChild(marker);
      cell.appendChild(crop);
    } else {
      cell.appendChild(marker);
    }
  } else if (isDecoratedGrass) {
    appendDecoration();
  } else if (emoji) {
    cell.append(emoji);
  }
  cell.title = hasMiniDungeon ? MINI_DUNGEON_MARKER_DESCRIPTION : hasTileCache ? CACHE_MARKER_DESCRIPTION : tile.description;
  const signLabel = SIGN_LABEL_BY_TILE.get(tile);
  if (signLabel) {
    const signpost = document.createElement('span');
    signpost.className = 'map-tile-signpost';
    signpost.textContent = signLabel;
    cell.appendChild(signpost);
  }
}

// Depth-sort by viewport row instead of a fixed always-on-top/always-behind
// z-index: a row's cells sit above every cell in the row above it, so a tall
// obstacle's canopy (which overflows upward into the row above, see
// .map-tile-obstacle) correctly paints over whatever's there - including the
// player - while a player standing in a row below an obstacle still renders
// in front of it, same as any other ground content would.
// Portal tiles get a flat +1000 on top of that: .map-tile-portal's shadow
// (css/styles.css) deliberately bleeds past this tile's own edge into every
// neighbor, including ones later in the row (same z-index, later in DOM =
// painted on top by default) and the row below (higher z-index under the
// scheme above) - without the boost, the shadow would only be visible on the
// up/left sides, painted over everywhere else. Portals are static POI tiles,
// not obstacles anything needs to walk behind, so always-on-top here doesn't
// cost the row-based scheme anything. Guardian tiles get the same boost,
// same reasoning - raised 2026-09-07 alongside GUARDIAN_PX: at 220% its
// oversized sprite bleeds downward into the row below too (unlike
// .map-tile-obstacle, which only ever bleeds upward), and without this that
// row's own cell (a higher z-index under the plain row-based scheme, since
// it's further down) would paint over and clip the bottom of the guardian.
function applyCellPosition(cell, row, col, zBoosted) {
  // Explicit placement (not CSS auto-flow) so a gap - a viewport cell that
  // resolves to nothing - just renders as an empty tile in its correct spot
  // instead of every subsequent real cell shifting left to fill the hole.
  // Grid lines are 1-indexed.
  cell.style.gridColumn = String(col + 1);
  cell.style.gridRow = String(row + 1);
  cell.style.zIndex = String(zBoosted ? row + 1000 : row);
}

// Pans the camera by shifting gridEl itself rather than any individual
// cell. originGx/originGy is the world coordinate the viewport's own
// top-left corner should show; bounds.minGx/minGy is gridEl's own placement
// anchor (cluster-relative row/col 0 corresponds to this), so the offset
// between them is exactly how far the grid needs to slide to bring the right
// cells into view.
function applyGridTransform(grid, originGx, originGy, bounds) {
  const offsetX = (originGx - bounds.minGx) * TILE_SIZE_PX;
  const offsetY = (originGy - bounds.minGy) * TILE_SIZE_PX;
  grid.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`;
}

// Full teardown + rebuild of every visible cell - called on mount and
// resize, both already-infrequent one-shot events with no need for
// renderStep()'s diffing. Also the only place cellCache is reset, since a
// resize can change tilesWide/tilesTall (invalidating every cached (row,
// col)) and a fresh mount has nothing to diff against yet.
export function renderFull(rootEl, ctx) {
  const { tilesWide, tilesTall, originGx, originGy, bounds } = ctx;
  const viewport = document.createElement('div');
  viewport.className = 'map-viewport';
  rootEl.innerHTML = '';
  rootEl.appendChild(viewport);
  viewportEl = viewport;

  // Sized to the whole cluster, not just the viewport window - a track with
  // no populated cell costs nothing (see applyGridTransform above for why
  // this is what makes a cell's placement stable across steps).
  const clusterWidth = bounds.maxGx - bounds.minGx + 1;
  const clusterHeight = bounds.maxGy - bounds.minGy + 1;

  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.gridTemplateColumns = `repeat(${clusterWidth}, ${TILE_SIZE_PX}px)`;
  grid.style.gridTemplateRows = `repeat(${clusterHeight}, ${TILE_SIZE_PX}px)`;

  cellCache = new Map();
  for (let vr = 0; vr < tilesTall; vr++) {
    for (let vc = 0; vc < tilesWide; vc++) {
      const gx = originGx + vc;
      const gy = originGy + vr;
      const signature = ctx.signatureAt(gx, gy);
      const row = gy - bounds.minGy;
      const col = gx - bounds.minGx;
      const cell = document.createElement('div');
      applyCellContent(ctx, cell, gx, gy, signature);
      applyCellPosition(cell, row, col, signature.zBoosted);
      grid.appendChild(cell);
      cellCache.set(`${gx},${gy}`, { el: cell, row, col, signature });
    }
  }
  applyGridTransform(grid, originGx, originGy, bounds);

  viewport.appendChild(grid);
  gridEl = grid;
}

// The hot path - called on every step instead of a full rebuild. Keeps
// gridEl/cellCache from the last render and only touches cells whose world
// content or on-screen position actually changed; see the cellCache comment
// above for why cells are keyed by world coordinate rather than (row, col).
// Returns false if there's nothing to diff against yet, so the caller can
// fall back to a full rebuild.
export function renderStep(ctx) {
  if (!gridEl || !viewportEl) return false;
  const { tilesWide, tilesTall, originGx, originGy, bounds } = ctx;

  const nextKeys = new Set();
  for (let vr = 0; vr < tilesTall; vr++) {
    for (let vc = 0; vc < tilesWide; vc++) {
      const gx = originGx + vc;
      const gy = originGy + vr;
      const key = `${gx},${gy}`;
      nextKeys.add(key);
      const signature = ctx.signatureAt(gx, gy);
      // Cluster-relative, not viewport-relative - a pure function of (gx,
      // gy) while this cluster stays current, so an already-cached cell's
      // row/col never actually changes here (the branch below is defensive,
      // not expected to fire during normal panning).
      const row = gy - bounds.minGy;
      const col = gx - bounds.minGx;
      const cached = cellCache.get(key);
      if (cached) {
        if (!ctx.signaturesEqual(cached.signature, signature)) {
          cached.el.replaceChildren();
          applyCellContent(ctx, cached.el, gx, gy, signature);
          cached.signature = signature;
        }
        if (cached.row !== row || cached.col !== col) {
          applyCellPosition(cached.el, row, col, signature.zBoosted);
          cached.row = row;
          cached.col = col;
        } else {
          // Row/col unchanged but z-boost could still have flipped as part
          // of a content change just above (e.g. a portal appearing on a
          // tile that didn't need to move) - cheap enough to just always
          // keep in sync rather than tracking that specially.
          cached.el.style.zIndex = String(signature.zBoosted ? row + 1000 : row);
        }
      } else {
        const cell = document.createElement('div');
        applyCellContent(ctx, cell, gx, gy, signature);
        applyCellPosition(cell, row, col, signature.zBoosted);
        gridEl.appendChild(cell);
        cellCache.set(key, { el: cell, row, col, signature });
      }
    }
  }

  for (const [key, entry] of cellCache) {
    if (!nextKeys.has(key)) {
      entry.el.remove();
      cellCache.delete(key);
    }
  }

  applyGridTransform(gridEl, originGx, originGy, bounds);
  return true;
}

export function destroy() {
  gridEl = null;
  viewportEl = null;
  cellCache = new Map();
}

// The canvas renderer's own dpr-staleness self-heal has no DOM-renderer
// equivalent to worry about - there's no offscreen cache rasterised at a
// device-pixel-ratio here, everything is real elements sized in CSS px.
export function refreshViewport() {}

// The hero's on-screen rectangle, for effects anchored to the player's tile
// (js/screens/celebrationEffect.js, playMonsterFleeEffect). The DOM renderer
// has a real element for this; the canvas renderer computes it - see
// getPlayerScreenRect in mapCanvasRenderer.js.
export function getPlayerScreenRect() {
  const playerCell = gridEl?.querySelector('.map-tile-player');
  return playerCell ? playerCell.getBoundingClientRect() : null;
}

// The DOM renderer's effects stay exactly as they were: CSS classes and
// keyframes on the player's own cell (see css/styles.css). The canvas
// renderer implements the same three as draw-loop tweens instead.
export function playLevelUpEffect(durationMs) {
  const playerCell = gridEl?.querySelector('.map-tile-player');
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
  }, durationMs);
}

export function playWellHealEffect(durationMs) {
  const playerCell = gridEl?.querySelector('.map-tile-player');
  if (!playerCell) return;

  const ring = document.createElement('div');
  ring.className = 'map-well-heal-ring';
  playerCell.appendChild(ring);

  const glow = document.createElement('div');
  glow.className = 'map-well-heal-glow';
  playerCell.appendChild(glow);

  setTimeout(() => {
    ring.remove();
    glow.remove();
  }, durationMs);
}

export function playPortalPullEffect() {
  const marker = gridEl?.querySelector('.map-tile-player .map-tile-fullsize');
  if (!marker) return;
  marker.classList.add('map-tile-player-portal-pull');
}
