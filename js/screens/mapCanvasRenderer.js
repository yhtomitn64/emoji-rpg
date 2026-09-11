// The canvas map renderer - one <canvas> the size of the viewport, redrawn
// whole from a draw list (js/systems/mapDrawList.js) inside a
// requestAnimationFrame loop.
//
// Why this exists: sliding ~1200 populated CSS-Grid tiles via `transform`
// hits a real ceiling in Chrome's paint pipeline. Six specific mechanisms
// were each tested live in DevTools and ruled out one at a time before this
// was written - see docs/superpowers/BACKLOG.md's two "Map render
// performance" sections for the full elimination log. A step here costs one
// bitmap paint of viewport size no matter how far the camera moved, which is
// the property the DOM version couldn't have.
//
// Deliberately canvas2d rather than WebGL or an engine: ~900 sprites a frame
// is 1-2ms of canvas2d against a 16ms budget, and WebGL has no path API at
// all, which would make the trail (per-stroke gradients along variable-width
// quadratic curves) harder rather than easier. The draw-list seam keeps a
// WebGL painter a contained swap if that ever stops being true.
import {
  buildLayeredDrawList, buildDynamicOps, describeSignature,
  ANCHOR_CENTER, ANCHOR_BOTTOM, ANCHOR_TOP, ANCHOR_POINT, SIGNPOST_FONT_PX,
} from '../systems/mapDrawList.js';
import {
  startLevelUp, startWellHeal, startPortalPull, reset as resetEffects,
  hasActiveEffect, sampleEffects,
  LEVEL_UP_RAY_COUNT, LEVEL_UP_RAY_ARC_DEG, LEVEL_UP_RAY_COLOR,
} from '../systems/mapEffects.js';
import { TILE_SIZE_PX, HERO_AND_LOOT_PX, TRAIL_VIEWBOX_SIZE } from '../systems/mapRenderModel.js';
import { computeCameraOrigin } from '../systems/world.js';

const TAU = Math.PI * 2;

// How many extra tiles beyond the viewport get drawn on every side. Two
// reasons it can't be zero: a smoothly-lerping camera sits at a fractional
// tile offset, so a strip of the row/column just outside the nominal
// viewport is genuinely on screen; and obstacles/guardians deliberately
// render larger than their own tile, so one just off-screen still has to
// paint its overhang inward.
const MARGIN_TILES = 2;

// Emoji are drawn from a glyph atlas rather than with fillText per tile -
// see getGlyph. Rasterising color emoji is expensive enough that doing it
// ~900 times a frame would put the paint cost right back where the DOM
// renderer had it.
const ATLAS_FONT_PX = 128;
// The atlas cell is bigger than the font size so a glyph whose ink extends
// past its em box isn't clipped. Both the atlas render and every draw scale
// by this, so it cancels out and a glyph asked for at size S still reads as
// S tall.
const GLYPH_BOX_PAD = 1.4;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
const LABEL_FONT = '700 SIZEpx system-ui, -apple-system, "Segoe UI", sans-serif';

// .map-tile-portal-crop's own 1.36x - enough to push the 🌌 emoji's baked-in
// pale border past the tile's edge while it still reads as a starry picture.
const PORTAL_CROP_SCALE = 1.36;
// @keyframes map-tile-portal-shadow / map-tile-quest-glow both loop forever.
// Each is pre-rendered once at its strongest state and pulsed by alpha,
// rather than re-rasterising a multi-layer blur every frame.
const PORTAL_SHADOW_PERIOD_MS = 2400;
const PORTAL_SHADOW_MIN_ALPHA = 0.7;
const QUEST_GLOW_PERIOD_MS = 1600;
const QUEST_GLOW_MIN_ALPHA = 0.35;

// The camera is considered arrived once it's within this fraction of a tile
// of its target, so a lerp that would asymptote forever actually settles and
// lets the render loop go idle.
const CAMERA_SETTLE_TILES = 0.002;
// A camera further behind than this gives up on catching up smoothly and
// snaps. Deliberately generous, because a steady lag behind the hero while
// they walk is normal and wanted - it's what makes the glide read as a
// camera following rather than a rigid frame - and snapping mid-walk is
// exactly the stutter this threshold used to cause.
//
// Raised from 1.5 to 6 on 2026-09-10 alongside the held-key walk cadence in
// mapScreen.js. At 1.5 a held key could sit permanently past the threshold:
// steady-state lag is (tiles gained per frame / fraction closed per frame),
// which at the old OS-auto-repeat step rate worked out near 2.8 tiles at the
// slowest glide setting - so the camera lerped, crossed the line, hard
// snapped, and did it again every few frames. Nothing in normal play
// approaches 6 tiles now that the walk cadence is fixed (worst case is under
// one tile), so this only catches genuine desync. A screen or cluster change
// doesn't rely on it at all - those rebuild through renderFull(), which
// places the camera exactly rather than lerping in from the old position.
const CAMERA_SNAP_TILES = 6;

// The hero's own sub-tile position settles/snaps on the same terms the camera
// does - see CAMERA_SETTLE_TILES/CAMERA_SNAP_TILES. The snap distance is much
// tighter because nothing should ever move the hero more than a tile at a
// time except a teleport, and a teleport rebuilds through renderFull() which
// places them exactly anyway.
const HERO_SETTLE_TILES = 0.002;
const HERO_SNAP_TILES = 2.5;

let canvasEl = null;
let ctx2d = null;
let tooltipEl = null;
let renderContext = null;
let rafId = null;
let dpr = 1;
let needsPaint = false;
let lastFrameMs = 0;
// Camera position in world tiles, fractional while smoothing. null until the
// first render, which places it exactly (never lerping in from nowhere).
let camGx = null;
let camGy = null;
// The hero's own drawn position in world tiles, fractional while they're
// mid-stride between two of them. Same null-means-place-exactly rule as the
// camera above.
//
// Raised by Timothy 2026-09-10, right after the camera glide landed: "the
// character seems to snap between squares. Can they go smoothly too just like
// the map does now?" Their logical position (state.position) is necessarily a
// whole tile - everything from collision to the trail to encounter rolls is
// defined on the grid - so smoothing has to happen here, at draw time, rather
// than by making the game's own coordinates fractional.
let heroGx = null;
let heroGy = null;
let lastPlayerTile = null;
let hoverTile = null;

// ---------------------------------------------------------------------------
// Static layer cache
// ---------------------------------------------------------------------------
//
// Raised by Timothy 2026-09-10: "when I make the window really really big and
// walk around I get frame drops ... when I walk away from an area with no
// paths then performance back to top speed fps." Measured before changing
// anything (the numbers and the full design are in
// docs/superpowers/plans/2026-09-10-static-layer-cache-plan.md): at a
// maximised window over fully-walked ground the map cost 7.70ms of JS and
// 46,668 canvas ops per frame, against 0.76ms and 3,537 ops on untrodden
// ground. The worn-path trail was ~92% of every draw call - and all of it was
// being rebuilt and repainted every frame for content that only changes when
// the player actually steps on a tile.
//
// So the ground, the trail and every static sprite are painted once into an
// offscreen canvas and blitted with a single drawImage per frame. Only the
// cells that genuinely differ frame to frame - the block around the player,
// the pulsing portal/quest cells, the hero, the effects - are drawn live.
let staticCanvas = null;
let staticCtx = null;
// The other half of the double buffer used when the cache scrolls - see
// scrollStaticCache. The two swap roles rather than one being copied to.
let staticBackCanvas = null;
let staticBackCtx = null;
// World tile coordinate of the cached canvas's top-left, and the size it
// covers. null means "nothing cached yet".
let cacheOriginGx = null;
let cacheOriginGy = null;
let cacheTilesWide = 0;
let cacheTilesTall = 0;
let cachedAnimatedCells = [];
// Set whenever the cached pixels can no longer be trusted: a step (which
// re-marks the trail on the tiles walked between), a resize, a cluster change.
let staticCacheDirty = true;

// How far past the viewport the cached layer extends on every side. The cache
// only has to be rebuilt when the camera walks off the edge of it, so this is
// a straight trade of memory for rebuild frequency: at 12 tiles a rebuild
// happens roughly every 12 steps rather than every frame. Deliberately much
// larger than MARGIN_TILES, which exists for a different reason (drawing the
// overhang of just-offscreen tiles).
const CACHE_PAD_TILES = 12;

// "?staticCache=off" paints every cell live again, exactly as the renderer did
// before the cache existed. Deliberately kept after the cache shipped: the
// cache's whole risk is that it draws something subtly DIFFERENTLY, and a
// switch that toggles it on one running page is the only honest way to settle
// "is this artifact the cache, or was it always like that" - without it the
// answer is whoever argues more confidently.
//
// Read off the render context rather than straight off `location`, matching
// how mapScreen already resolves its `renderer` param. That is not tidiness:
// reading a global here left this branch untestable, and the first version of
// it referenced two variables in their temporal dead zone, so it threw on
// every frame and painted the map solid black. Timothy found that by trying
// to use the switch. On the context, a test can drive it.
function staticCacheEnabled() {
  return renderContext ? renderContext.staticCacheEnabled !== false : true;
}


const glyphCache = new Map();
const gradientCache = new Map();
let portalShadowSprite = null;
let questGlowSprite = null;

// ---------------------------------------------------------------------------
// Glyph atlas
// ---------------------------------------------------------------------------

// One offscreen canvas per emoji, rendered once at a high base size and then
// drawImage-scaled to whatever a tile needs. Keyed by emoji alone, never by
// size - which is what makes the continuously-randomised obstacle sizes
// (FULL_SQUARE_PX * (1 + hash01(x,y) * 0.5)) and decoration scales free
// instead of an unbounded number of atlas entries.
function getGlyph(emoji) {
  const cached = glyphCache.get(emoji);
  if (cached) return cached;
  const side = Math.ceil(ATLAS_FONT_PX * GLYPH_BOX_PAD * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.font = `${ATLAS_FONT_PX * dpr}px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, side / 2, side / 2);
  glyphCache.set(emoji, canvas);
  return canvas;
}

// Dropped whenever the rasterisation basis changes: a devicePixelRatio change
// (dragging the window to a different-DPI monitor) would otherwise leave
// every glyph blurry, and a font that finishes loading after the first paint
// would otherwise leave tofu boxes baked in permanently.
function invalidateSprites() {
  glyphCache.clear();
  gradientCache.clear();
  // The cached static layer was painted with the sprites being dropped here
  // (a late-loading emoji font is the common case), so it has to be repainted
  // too or the old tofu boxes stay on screen for the life of the session.
  staticCacheDirty = true;
  portalShadowSprite = null;
  questGlowSprite = null;
  needsPaint = true;
}

// ---------------------------------------------------------------------------
// Pre-rendered effect sprites
// ---------------------------------------------------------------------------

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// .map-tile-portal::before - stacked soft black shadows that bleed OUTSIDE
// the tile into its neighbors, hugging the tile's own rectangle (box-shadow
// naturally does; a radial gradient fought the squared-off frame). Rendered
// at the animation's 50% (strongest) state and pulsed by alpha.
//
// Canvas has no box-shadow spread, so each layer's spread is applied by
// inflating the rectangle instead, and the shape itself is drawn far off the
// sprite and brought back by shadowOffsetX - the standard way to get a
// shadow without the casting shape painting over it.
const PORTAL_SHADOW_LAYERS = [
  { blur: 12, spread: 4, color: 'rgba(0, 0, 0, 0.6)' },
  { blur: 26, spread: 12, color: 'rgba(0, 0, 0, 0.4)' },
  { blur: 46, spread: 22, color: 'rgba(0, 0, 0, 0.2)' },
];
const PORTAL_SHADOW_BLEED_PX = 72;

function getPortalShadowSprite() {
  if (portalShadowSprite) return portalShadowSprite;
  const bleed = PORTAL_SHADOW_BLEED_PX;
  const side = TILE_SIZE_PX + bleed * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(side * dpr);
  canvas.height = Math.ceil(side * dpr);
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.scale(dpr, dpr);
  const far = side * 4;
  for (const layer of PORTAL_SHADOW_LAYERS) {
    g.save();
    g.shadowColor = layer.color;
    g.shadowBlur = layer.blur;
    g.shadowOffsetX = far;
    g.fillStyle = '#000';
    roundRectPath(
      g,
      bleed - layer.spread - far, bleed - layer.spread,
      TILE_SIZE_PX + layer.spread * 2, TILE_SIZE_PX + layer.spread * 2,
      TILE_SIZE_PX * 0.14,
    );
    g.fill();
    g.restore();
  }
  portalShadowSprite = { canvas, bleed };
  return portalShadowSprite;
}

// .map-tile-quest-ready's inset glow, at the animation's 50% state. Drawn by
// clipping to the tile and stroking just outside it, so only the shadow
// bleeding inward shows - canvas has no inset shadow of its own.
function getQuestGlowSprite() {
  if (questGlowSprite) return questGlowSprite;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(TILE_SIZE_PX * dpr);
  canvas.height = Math.ceil(TILE_SIZE_PX * dpr);
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.scale(dpr, dpr);
  g.save();
  g.beginPath();
  g.rect(0, 0, TILE_SIZE_PX, TILE_SIZE_PX);
  g.clip();
  g.shadowColor = 'rgba(255, 215, 0, 0.85)';
  g.shadowBlur = 14;
  g.strokeStyle = '#000';
  g.lineWidth = 12; // 6px spread, doubled so the stroke straddles the edge
  g.strokeRect(-6, -6, TILE_SIZE_PX + 12, TILE_SIZE_PX + 12);
  g.restore();
  questGlowSprite = canvas;
  return questGlowSprite;
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

function drawGlyph(op, px, py) {
  const glyph = getGlyph(op.emoji);
  if (!glyph) return;
  const size = op.sizePx;
  const box = size * GLYPH_BOX_PAD;

  // Where the glyph's own centre lands inside the tile, matching how each
  // CSS class positioned its span - see the ANCHOR_* comments in
  // mapDrawList.js.
  let cx = TILE_SIZE_PX / 2;
  let cy = TILE_SIZE_PX / 2;
  if (op.anchor === ANCHOR_BOTTOM) cy = TILE_SIZE_PX - size / 2;
  else if (op.anchor === ANCHOR_TOP) cy = size / 2 + (op.offsetYPx || 0);
  else if (op.anchor === ANCHOR_POINT) {
    cx = op.pointX;
    cy = op.pointY;
  }

  ctx2d.save();
  if (op.cropped) {
    // The portal's emoji renders oversized and is clipped back to its own
    // tile, cropping the pale border baked into the glyph's art.
    ctx2d.beginPath();
    ctx2d.rect(px, py, TILE_SIZE_PX, TILE_SIZE_PX);
    ctx2d.clip();
  }
  ctx2d.translate(px + cx, py + cy);
  if (op.rotateDeg) ctx2d.rotate((op.rotateDeg * Math.PI) / 180);
  const scale = (op.scale || 1) * (op.cropped ? PORTAL_CROP_SCALE : 1);
  if (scale !== 1) ctx2d.scale(scale, scale);
  if (op.alpha !== undefined) ctx2d.globalAlpha = op.alpha;
  // filter is well supported in canvas2d now; guarded because it silently
  // does nothing (rather than throwing) where it isn't, which is fine.
  if (op.brightness && op.brightness !== 1) ctx2d.filter = `brightness(${op.brightness})`;
  ctx2d.drawImage(glyph, -box / 2, -box / 2, box, box);
  ctx2d.restore();
}

// A tile's trail, drawn in trail.js's own 0..TRAIL_VIEWBOX_SIZE coordinate
// space. The scale below is the ONLY unit conversion anywhere in the trail
// path - every number the draw list carries is then used verbatim, exactly
// as the SVG's own viewBox meant it, so canvas output can't drift from what
// the DOM renderer produced.
function drawTrail(op, px, py) {
  const k = TILE_SIZE_PX / TRAIL_VIEWBOX_SIZE;
  const mid = TRAIL_VIEWBOX_SIZE / 2;
  ctx2d.save();
  ctx2d.translate(px, py);
  ctx2d.scale(k, k);

  if (op.dot) {
    ctx2d.beginPath();
    ctx2d.arc(mid, mid, op.dot.r, 0, TAU);
    ctx2d.fillStyle = op.dot.color;
    ctx2d.fill();
  }

  ctx2d.lineCap = 'round';
  for (const stroke of op.strokes) {
    // Gradients are cached by (colors, direction) rather than rebuilt per
    // tile: their coordinates live in this tile-local space, which is
    // identical for every tile, and canvas resolves a gradient against the
    // transform in effect when it's PAINTED - so one object is reusable
    // across every tile that shares those two colors and that direction.
    const key = `${stroke.dir}|${stroke.fromColor}|${stroke.toColor}`;
    let gradient = gradientCache.get(key);
    if (!gradient) {
      gradient = ctx2d.createLinearGradient(mid, mid, stroke.tx, stroke.ty);
      gradient.addColorStop(0, stroke.fromColor);
      gradient.addColorStop(1, stroke.toColor);
      gradientCache.set(key, gradient);
    }
    ctx2d.beginPath();
    ctx2d.moveTo(stroke.cx, stroke.cy);
    ctx2d.quadraticCurveTo(stroke.qx, stroke.qy, stroke.tx, stroke.ty);
    ctx2d.strokeStyle = gradient;
    ctx2d.lineWidth = stroke.width;
    ctx2d.stroke();
  }

  // Painted last, over every stroke's own end - covers the hard notch a
  // narrower stroke leaves where it meets a wider one at the shared centre.
  if (op.hub) {
    ctx2d.beginPath();
    ctx2d.arc(mid, mid, op.hub.r, 0, TAU);
    ctx2d.fillStyle = op.hub.color;
    ctx2d.fill();
  }
  ctx2d.restore();
}

// Town's wooden signpost plank, anchored to the top of its tile and
// overflowing upward into the row above - .map-tile-signpost.
function drawLabel(op, px, py) {
  ctx2d.save();
  ctx2d.font = LABEL_FONT.replace('SIZE', String(SIGNPOST_FONT_PX));
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  const paddingX = 6;
  const width = ctx2d.measureText(op.text).width + paddingX * 2;
  const height = SIGNPOST_FONT_PX * 1.4 + 2;
  const x = px + TILE_SIZE_PX / 2 - width / 2;
  const y = py - height;
  ctx2d.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx2d.shadowBlur = 2;
  ctx2d.shadowOffsetY = 1;
  roundRectPath(ctx2d, x, y, width, height, 2);
  ctx2d.fillStyle = '#8a5a2b';
  ctx2d.fill();
  ctx2d.shadowColor = 'transparent';
  ctx2d.strokeStyle = '#5c3a19';
  ctx2d.lineWidth = 1;
  ctx2d.stroke();
  ctx2d.fillStyle = '#fff5e0';
  ctx2d.fillText(op.text, x + width / 2, y + height / 2);
  ctx2d.restore();
}

function drawRays(op, px, py) {
  const cx = px + TILE_SIZE_PX / 2;
  const cy = py + TILE_SIZE_PX / 2;
  const radius = op.radiusTiles * TILE_SIZE_PX;
  ctx2d.save();
  ctx2d.globalAlpha = op.alpha;
  ctx2d.fillStyle = LEVEL_UP_RAY_COLOR;
  ctx2d.translate(cx, cy);
  ctx2d.rotate((op.rotateDeg * Math.PI) / 180);
  const step = TAU / LEVEL_UP_RAY_COUNT;
  const arc = (LEVEL_UP_RAY_ARC_DEG * Math.PI) / 180;
  for (let i = 0; i < LEVEL_UP_RAY_COUNT; i++) {
    ctx2d.beginPath();
    ctx2d.moveTo(0, 0);
    ctx2d.arc(0, 0, radius, i * step, i * step + arc);
    ctx2d.closePath();
    ctx2d.fill();
  }
  ctx2d.restore();
}

function drawRing(op, px, py) {
  ctx2d.save();
  ctx2d.globalAlpha = op.alpha;
  ctx2d.beginPath();
  ctx2d.arc(px + TILE_SIZE_PX / 2, py + TILE_SIZE_PX / 2, Math.max(0.5, op.radiusPx), 0, TAU);
  ctx2d.strokeStyle = 'rgba(90, 170, 255, 0.9)';
  ctx2d.lineWidth = op.lineWidthPx;
  ctx2d.stroke();
  ctx2d.restore();
}

function drawGlow(op, px, py) {
  const cx = px + TILE_SIZE_PX / 2;
  const cy = py + TILE_SIZE_PX / 2;
  const radius = Math.max(0.5, op.radiusTiles * TILE_SIZE_PX);
  const gradient = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(120, 190, 255, 0.55)');
  gradient.addColorStop(0.7, 'rgba(120, 190, 255, 0)');
  gradient.addColorStop(1, 'rgba(120, 190, 255, 0)');
  ctx2d.save();
  ctx2d.globalAlpha = op.alpha;
  ctx2d.fillStyle = gradient;
  ctx2d.beginPath();
  ctx2d.arc(cx, cy, radius, 0, TAU);
  ctx2d.fill();
  ctx2d.restore();
}

function paint(ops, effectOps, suppressHeroGlyph, nowMs) {
  const pulse = (periodMs, minAlpha) => {
    const phase = (Math.sin((nowMs / periodMs) * TAU) + 1) / 2;
    return minAlpha + (1 - minAlpha) * phase;
  };

  // Anything riding with the hero (the hero themselves, and the boat under
  // them on a tool-gated crossing) is held back and drawn after every tile,
  // rather than in its own tile's place in the row-major order.
  //
  // It has to be: the hero draws at their interpolated position, which while
  // mid-stride overhangs a neighbouring tile - and walking up or left, that
  // neighbour is painted LATER in row-major order, so its ground fill covered
  // the overhanging half of the hero. The result was the hero being sliced
  // clean through at a tile boundary on every other step, which with two-key
  // staircase walking (half of whose steps go up) read as constant blinking.
  // Raised by Timothy 2026-09-10: "the character kind of blinks in and out."
  //
  // The tradeoff, taken deliberately: a tall obstacle in the row below no
  // longer paints over the hero's feet the way the row-based depth sort used
  // to arrange. Losing sight of your own character behind a tree is the worse
  // of the two, and at this sprite size the occlusion cue was slight.
  const heroOps = [];

  const drawOp = (op) => {
    const followsHero = op.followsHero && heroGx !== null;
    const px = ((followsHero ? heroGx : op.gx) - camGx) * TILE_SIZE_PX;
    const py = ((followsHero ? heroGy : op.gy) - camGy) * TILE_SIZE_PX;
    switch (op.op) {
      case 'ground':
        ctx2d.fillStyle = op.color;
        // Drawn at the exact fractional position, overlapping its right and
        // bottom neighbour by a pixel so no seam of background shows through
        // between tiles. The overlap is what prevents the seam - an earlier
        // version also rounded the position to whole pixels, which snapped
        // the whole terrain grid to a 1px lattice while every sprite on top
        // of it (trees, the trail, the hero) kept moving smoothly, so the
        // ground visibly juddered under them as the camera glided. Raised by
        // Timothy 2026-09-10: "map kind of herky jerky now too".
        ctx2d.fillRect(px, py, TILE_SIZE_PX + 1, TILE_SIZE_PX + 1);
        break;
      case 'questGlow': {
        const sprite = getQuestGlowSprite();
        if (!sprite) break;
        ctx2d.save();
        ctx2d.globalAlpha = pulse(QUEST_GLOW_PERIOD_MS, QUEST_GLOW_MIN_ALPHA);
        ctx2d.drawImage(sprite, px, py, TILE_SIZE_PX, TILE_SIZE_PX);
        ctx2d.restore();
        break;
      }
      case 'portalShadow': {
        const sprite = getPortalShadowSprite();
        if (!sprite) break;
        const side = TILE_SIZE_PX + sprite.bleed * 2;
        ctx2d.save();
        ctx2d.globalAlpha = pulse(PORTAL_SHADOW_PERIOD_MS, PORTAL_SHADOW_MIN_ALPHA);
        ctx2d.drawImage(sprite.canvas, px - sprite.bleed, py - sprite.bleed, side, side);
        ctx2d.restore();
        break;
      }
      case 'trail':
        drawTrail(op, px, py);
        break;
      case 'glyph':
        if (suppressHeroGlyph && op.isPlayer) break;
        drawGlyph(op, px, py);
        break;
      case 'label':
        drawLabel(op, px, py);
        break;
      default:
        break;
    }
  };

  for (const op of ops) {
    if (op.followsHero) heroOps.push(op);
    else drawOp(op);
  }
  for (const op of heroOps) drawOp(op);

  for (const op of effectOps) {
    const px = (op.gx - camGx) * TILE_SIZE_PX;
    const py = (op.gy - camGy) * TILE_SIZE_PX;
    if (op.op === 'rays') drawRays(op, px, py);
    else if (op.op === 'ring') drawRing(op, px, py);
    else if (op.op === 'glow') drawGlow(op, px, py);
    else if (op.op === 'glyph') drawGlyph(op, px, py);
  }
}

// ---------------------------------------------------------------------------
// Static layer cache
// ---------------------------------------------------------------------------


// Repaints the whole cached layer, centred on where the camera is now.
//
// Every draw helper in this module reads the module-level ctx2d and camGx /
// camGy rather than taking them as arguments, so rather than threading a
// target through all of them, this swaps them for the duration and puts them
// back. Contained and explicit beats rewriting nine drawing functions to
// carry a context they only ever need for this one caller.
function rebuildStaticCache(context) {
  // `context` here is already margin-expanded, so only the cache's own pad is
  // added on top of it. The size check in frame() computes the same thing and
  // the two must not drift apart, or every frame would think the cache is the
  // wrong size and rebuild it.
  const tilesWide = context.tilesWide + CACHE_PAD_TILES * 2;
  const tilesTall = context.tilesTall + CACHE_PAD_TILES * 2;
  const originGx = Math.floor(camGx) - MARGIN_TILES - CACHE_PAD_TILES;
  const originGy = Math.floor(camGy) - MARGIN_TILES - CACHE_PAD_TILES;

  if (!staticCanvas || cacheTilesWide !== tilesWide || cacheTilesTall !== tilesTall) {
    staticCanvas = document.createElement('canvas');
    staticCanvas.width = Math.max(1, Math.round(tilesWide * TILE_SIZE_PX * dpr));
    staticCanvas.height = Math.max(1, Math.round(tilesTall * TILE_SIZE_PX * dpr));
    staticCtx = staticCanvas.getContext ? staticCanvas.getContext('2d') : null;
  }
  if (!staticCtx) return null;

  const layered = buildLayeredDrawList({
    ...context, originGx, originGy, tilesWide, tilesTall,
  });

  const realCtx = ctx2d;
  const realCamGx = camGx;
  const realCamGy = camGy;
  ctx2d = staticCtx;
  camGx = originGx;
  camGy = originGy;
  try {
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, tilesWide * TILE_SIZE_PX, tilesTall * TILE_SIZE_PX);
    // No effects and no hero here - both are live every frame by definition.
    paint(layered.staticOps, [], false, 0);
  } finally {
    ctx2d = realCtx;
    camGx = realCamGx;
    camGy = realCamGy;
  }

  cacheOriginGx = originGx;
  cacheOriginGy = originGy;
  cacheTilesWide = tilesWide;
  cacheTilesTall = tilesTall;
  cachedAnimatedCells = layered.animatedCells;
  staticCacheDirty = false;
  return layered;
}

function invalidateStaticCache() {
  staticCacheDirty = true;
}

// How far a cell's own paint can reach outside its tile, and so how far
// either side of a patched region the cache has to be re-examined.
//
// Measured from the draw list's own numbers rather than guessed: the tallest
// obstacle is FULL_SQUARE_PX * (1 + OBSTACLE_MAX_EXTRA) = 61.2px, bottom
// anchored in a 48px tile, so it reaches 0.275 of a tile into the row above;
// a signpost label is ~15.4px tall and draws entirely above its own tile
// (0.32 of a tile); a trail stroke's round cap overhangs by half its width.
// Guardians reach much further (2.2x) but are zBoosted, which means they live
// in the per-frame layer and never sit in the cache at all. One whole tile is
// therefore a comfortable margin, not a hopeful one.
const PATCH_BLEED_TILES = 1;

// Repaints just the cells a step actually changed, instead of the whole
// cached layer.
//
// Why this exists: rebuilding the cache once per step looked fine on an
// average-per-frame measurement and was terrible to actually play. It turned
// evenly-spread work into one enormous paint every 110ms - a ~9Hz spike.
// Timothy, on the build that did that: "it's really really choppy in the
// outside world ... in town is smooth but outside world with all those paths
// is pretty bad."
//
// The correctness trick is the clip. Redrawing a cell repaints its ground,
// which would erase anything overhanging into it from a neighbour drawn later
// in row-major order - that is exactly the bug the 3x3 live block had. So:
// clip to the rectangle whose pixels may legitimately change, then redraw a
// LARGER region around it in proper row-major order. The larger region
// supplies every neighbour that paints into the clipped area, and the clip
// guarantees nothing outside it is touched. Both bounds come from
// PATCH_BLEED_TILES above.
// Repaints one rectangle of world tiles inside the cached layer, leaving
// every pixel outside it untouched. The shared workhorse for both a step's
// two-tile patch and the freshly-exposed strips after the camera scrolls.
//
// `changedGx/Gy/Wide/Tall` is the region whose CONTENT changed. Two margins
// come off it, and they are different things:
//   - dirty: the pixels that may legitimately change, = changed + bleed,
//     because a changed cell's own paint can reach outside its tile;
//   - draw:  the cells that must be consulted, = dirty + bleed, because a
//     neighbour outside the dirty area can paint into it.
// The clip is set to `dirty`, so redrawing the larger `draw` region cannot
// disturb anything beyond it.
function repaintCacheRegion(changedGx, changedGy, changedWide, changedTall) {
  const dirtyGx = changedGx - PATCH_BLEED_TILES;
  const dirtyGy = changedGy - PATCH_BLEED_TILES;
  const dirtyWide = changedWide + PATCH_BLEED_TILES * 2;
  const dirtyTall = changedTall + PATCH_BLEED_TILES * 2;

  const drawGx = dirtyGx - PATCH_BLEED_TILES;
  const drawGy = dirtyGy - PATCH_BLEED_TILES;
  const drawWide = dirtyWide + PATCH_BLEED_TILES * 2;
  const drawTall = dirtyTall + PATCH_BLEED_TILES * 2;

  const { staticOps } = buildLayeredDrawList({
    ...renderContext, originGx: drawGx, originGy: drawGy, tilesWide: drawWide, tilesTall: drawTall,
  });

  const realCtx = ctx2d;
  const realCamGx = camGx;
  const realCamGy = camGy;
  ctx2d = staticCtx;
  camGx = cacheOriginGx;
  camGy = cacheOriginGy;
  try {
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.save();
    const clipX = (dirtyGx - cacheOriginGx) * TILE_SIZE_PX;
    const clipY = (dirtyGy - cacheOriginGy) * TILE_SIZE_PX;
    ctx2d.beginPath();
    ctx2d.rect(clipX, clipY, dirtyWide * TILE_SIZE_PX, dirtyTall * TILE_SIZE_PX);
    ctx2d.clip();
    ctx2d.clearRect(clipX, clipY, dirtyWide * TILE_SIZE_PX, dirtyTall * TILE_SIZE_PX);
    paint(staticOps, [], false, 0);
    ctx2d.restore();
  } finally {
    ctx2d = realCtx;
    camGx = realCamGx;
    camGy = realCamGy;
  }
}

function patchStaticCache(changedTiles) {
  if (!staticCtx || cacheOriginGx === null) return false;

  let minGx = Infinity; let minGy = Infinity;
  let maxGx = -Infinity; let maxGy = -Infinity;
  for (const { gx, gy } of changedTiles) {
    minGx = Math.min(minGx, gx); maxGx = Math.max(maxGx, gx);
    minGy = Math.min(minGy, gy); maxGy = Math.max(maxGy, gy);
  }

  // A patch reaching outside what the cache covers can't be applied - the
  // caller falls back to a full rebuild, which repositions it anyway.
  const pad = PATCH_BLEED_TILES * 2;
  if (minGx - pad < cacheOriginGx || minGy - pad < cacheOriginGy
    || maxGx + pad >= cacheOriginGx + cacheTilesWide
    || maxGy + pad >= cacheOriginGy + cacheTilesTall) return false;

  repaintCacheRegion(minGx, minGy, maxGx - minGx + 1, maxGy - minGy + 1);
  return true;
}

// Moves the cached layer to a new origin by copying the part that is still
// valid and repainting only the strips that just came into range.
//
// Why this exists: without it, walking off the edge of the cache costs a full
// repaint of the whole thing. The per-frame average absorbed that, but
// Timothy felt it as a regular thump every ~12 steps - "it does do the 12
// step hitch though and it's very noticable". A scroll is one bitmap copy
// plus at most two thin strips, so it costs about the same as an ordinary
// step's patch rather than a whole rebuild.
//
// Double-buffered rather than copying the canvas onto itself: self-copy with
// overlapping regions is defined in the spec, but a second buffer removes any
// question of it, and the two canvases just swap roles each scroll.
function scrollStaticCache(newOriginGx, newOriginGy) {
  if (!staticCtx || cacheOriginGx === null) return false;
  const dx = newOriginGx - cacheOriginGx;
  const dy = newOriginGy - cacheOriginGy;
  if (dx === 0 && dy === 0) return true;
  // Nothing worth keeping: a full repaint is cheaper than a copy plus two
  // strips that between them cover the whole canvas.
  if (Math.abs(dx) >= cacheTilesWide || Math.abs(dy) >= cacheTilesTall) return false;

  if (!staticBackCanvas
    || staticBackCanvas.width !== staticCanvas.width
    || staticBackCanvas.height !== staticCanvas.height) {
    staticBackCanvas = document.createElement('canvas');
    staticBackCanvas.width = staticCanvas.width;
    staticBackCanvas.height = staticCanvas.height;
    staticBackCtx = staticBackCanvas.getContext ? staticBackCanvas.getContext('2d') : null;
  }
  if (!staticBackCtx) return false;

  staticBackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  staticBackCtx.clearRect(0, 0, cacheTilesWide * TILE_SIZE_PX, cacheTilesTall * TILE_SIZE_PX);
  staticBackCtx.drawImage(
    staticCanvas,
    -dx * TILE_SIZE_PX, -dy * TILE_SIZE_PX,
    cacheTilesWide * TILE_SIZE_PX, cacheTilesTall * TILE_SIZE_PX,
  );

  const frontCanvas = staticCanvas;
  const frontCtx = staticCtx;
  staticCanvas = staticBackCanvas;
  staticCtx = staticBackCtx;
  staticBackCanvas = frontCanvas;
  staticBackCtx = frontCtx;

  cacheOriginGx = newOriginGx;
  cacheOriginGy = newOriginGy;

  // The strips the copy left empty, in the cache's new coordinates. Each is
  // repainted through the same clipped path an ordinary patch uses, so the
  // seam against the copied pixels gets its neighbours' overhang correctly.
  if (dx > 0) repaintCacheRegion(newOriginGx + cacheTilesWide - dx, newOriginGy, dx, cacheTilesTall);
  else if (dx < 0) repaintCacheRegion(newOriginGx, newOriginGy, -dx, cacheTilesTall);
  if (dy > 0) repaintCacheRegion(newOriginGx, newOriginGy + cacheTilesTall - dy, cacheTilesWide, dy);
  else if (dy < 0) repaintCacheRegion(newOriginGx, newOriginGy, cacheTilesWide, -dy);
  return true;
}

// ---------------------------------------------------------------------------
// Camera + frame loop
// ---------------------------------------------------------------------------

// The camera's decision logic, as a pure function of its current state - no
// module globals, so it can be driven directly by a test with a controlled
// sequence of dt values instead of needing real requestAnimationFrame calls
// (which this module only gets in a real, OS-focused browser tab - Chrome
// fully suspends rAF for a hidden/unfocused tab, which is what made this bug
// hard to catch live via browser automation - see tests/mapCamera.test.js's
// own header). `cam` is null exactly once, right after a fresh mount.
//
// Returns { camGx, camGy, settled }. `settled` means "already exactly at the
// target, no further frames needed" - the render loop stops scheduling once
// everything active (camera included) reports settled.
export function computeCameraStep(cam, target, smoothingMs, dtMs) {
  if (cam === null) return { camGx: target.gx, camGy: target.gy, settled: true };
  const dx = target.gx - cam.gx;
  const dy = target.gy - cam.gy;
  const distance = Math.hypot(dx, dy);
  if (distance < CAMERA_SETTLE_TILES) {
    return { camGx: target.gx, camGy: target.gy, settled: true };
  }
  if (smoothingMs <= 0 || distance > CAMERA_SNAP_TILES) {
    return { camGx: target.gx, camGy: target.gy, settled: true };
  }
  // The first frame after the render loop wakes from idle has no measured
  // delta yet (frame() below resets lastFrameMs to 0 when it goes idle,
  // precisely so THIS frame can't mistake a long real gap for a normal one).
  //
  // BUG THIS GUARDS, found live 2026-09-10: dtMs<=0 used to be folded into
  // the snap branch above, which meant EVERY step snapped on this very first
  // frame regardless of the smoothing setting - an ordinary step only moves
  // the camera ~1 tile, well under CAMERA_SNAP_TILES, so that frame-0 snap
  // always finished the whole move before any frame with a real delta ever
  // ran. The lerp below was live but structurally unreachable; the slider
  // visibly did nothing at any setting. Returning unsettled with no movement
  // here instead lets the render loop schedule one more real frame, whose
  // measured delta then drives the actual lerp.
  if (dtMs <= 0) return { camGx: cam.gx, camGy: cam.gy, settled: false };
  // Exponential approach: `smoothingMs` is the time to close ~95% of the
  // gap, which makes the Settings slider read as "how long the camera takes
  // to catch up" rather than as an opaque coefficient.
  const k = 1 - Math.pow(0.05, dtMs / smoothingMs);
  return { camGx: cam.gx + dx * k, camGy: cam.gy + dy * k, settled: false };
}

// Where the camera is trying to be, given where the hero is actually being
// drawn this frame. Deliberately NOT renderContext.originGx/originGy: those
// are computed from the hero's logical tile and so jump a whole tile the
// moment a step lands, which is what used to make the camera surge-and-crawl
// once per step - see computeCameraOrigin's own header in world.js for the
// measurements. Falls back to the context's own origin before the hero has a
// position (the frame right after a mount).
function cameraTarget() {
  if (heroGx === null) return { gx: renderContext.originGx, gy: renderContext.originGy };
  const { originGx, originGy } = computeCameraOrigin(
    heroGx, heroGy, renderContext.tilesWide, renderContext.tilesTall, renderContext.bounds,
  );
  return { gx: originGx, gy: originGy };
}

function advanceCamera(dtMs) {
  const cam = camGx === null ? null : { gx: camGx, gy: camGy };
  const result = computeCameraStep(cam, cameraTarget(), renderContext.cameraSmoothingMs, dtMs);
  camGx = result.camGx;
  camGy = result.camGy;
  return result.settled;
}

// The hero's stride toward the tile they logically occupy. Deliberately a
// CONSTANT speed - one tile per `stepMs` - rather than the camera's
// exponential ease: an ease per step would restart on every tile, so holding
// a direction would read as fast-slow-fast-slow rather than one unbroken
// walk. Constant speed matched to the walk cadence means the hero arrives at
// each tile exactly as the next step is taken, which is what makes continuous
// walking look continuous.
export function computeHeroStep(hero, target, stepMs, dtMs) {
  if (hero === null) return { heroGx: target.gx, heroGy: target.gy, settled: true };
  const dx = target.gx - hero.gx;
  const dy = target.gy - hero.gy;
  const distance = Math.hypot(dx, dy);
  if (distance < HERO_SETTLE_TILES) return { heroGx: target.gx, heroGy: target.gy, settled: true };
  // stepMs of 0 is the "camera glide off" setting - see resolveHeroStepMs.
  if (stepMs <= 0 || distance > HERO_SNAP_TILES) {
    return { heroGx: target.gx, heroGy: target.gy, settled: true };
  }
  // Same "no measured delta yet, wait for a real frame" rule the camera has -
  // see computeCameraStep for the bug that came from conflating this with
  // snapping.
  if (dtMs <= 0) return { heroGx: hero.gx, heroGy: hero.gy, settled: false };
  const maxMove = dtMs / stepMs;
  if (distance <= maxMove) return { heroGx: target.gx, heroGy: target.gy, settled: true };
  return {
    heroGx: hero.gx + (dx / distance) * maxMove,
    heroGy: hero.gy + (dy / distance) * maxMove,
    settled: false,
  };
}

// The hero's stride is tied to the walk cadence, not to the camera-glide
// slider's own value: at a 250ms glide the hero would otherwise take 250ms to
// cross a tile while steps keep arriving every 110ms, so they'd fall further
// and further behind the tile they're actually standing on. The slider still
// gates it though - 0 means "no smoothing anywhere", which is what makes that
// end of the slider reproduce the pre-canvas feel exactly.
function resolveHeroStepMs() {
  return renderContext.cameraSmoothingMs > 0 ? renderContext.walkStepMs : 0;
}

function advanceHero(dtMs, playerTile) {
  if (!playerTile) return true;
  const hero = heroGx === null ? null : { gx: heroGx, gy: heroGy };
  const result = computeHeroStep(hero, playerTile, resolveHeroStepMs(), dtMs);
  heroGx = result.heroGx;
  heroGy = result.heroGy;
  return result.settled;
}

// Exported for tests only - see computeCameraStep's own header for why the
// camera's state machine needs a seam like this rather than being driven
// through real requestAnimationFrame calls.
export const __testables = {
  computeCameraStep, CAMERA_SETTLE_TILES, CAMERA_SNAP_TILES,
  computeHeroStep, HERO_SETTLE_TILES, HERO_SNAP_TILES,
  // Where the camera and the hero actually ended up after the frames that
  // have run. The pure functions above can each be correct while frame()
  // wires them together wrongly - which is the whole subject of the
  // camera/hero coupling - and nothing else in this module is observable
  // from outside without a real canvas. See tests/mapWalkSmoothness.test.js.
  readCameraState: () => ({ camGx, camGy, heroGx, heroGy }),
};

function frame(nowMs) {
  rafId = null;
  if (!ctx2d || !renderContext) return;
  const dtMs = lastFrameMs ? nowMs - lastFrameMs : 0;
  lastFrameMs = nowMs;

  // Order matters: the hero advances first, then the camera aims at where the
  // hero now is. Running the camera first would leave it aiming a frame
  // behind the character it is following, which is the same disagreement -
  // one frame's worth of it - that this coupling exists to remove.
  //
  // The player's own tile no longer comes from scanning the viewport for it:
  // mapScreen puts it straight on the context, so the live layer below can
  // visit a handful of cells instead of every one on screen.
  const marginContext = expandForMargin(renderContext);
  const playerTile = { gx: renderContext.playerGx, gy: renderContext.playerGy };
  lastPlayerTile = playerTile;
  const heroSettled = advanceHero(dtMs, playerTile);
  const cameraSettled = advanceCamera(dtMs);

  // Effects anchor to where the hero is actually drawn, not to the tile they
  // logically occupy - otherwise a level-up burst would fire from the tile
  // ahead of them while they're still mid-stride toward it.
  //
  // Sampled BEFORE the cache work below, not after: both painting paths need
  // it, and having it below meant the ?staticCache=off branch referenced it
  // in its temporal dead zone - which threw on every frame and rendered a
  // completely black map. Caught by Timothy trying to use that very switch.
  const effectAnchor = heroGx === null ? playerTile : { gx: heroGx, gy: heroGy };
  const { ops: effectOps, suppressHeroGlyph } = sampleEffects(
    nowMs, effectAnchor, renderContext.playerEmoji, HERO_AND_LOOT_PX,
  );

  const widthCss = canvasEl.width / dpr;
  const heightCss = canvasEl.height / dpr;

  if (!staticCacheEnabled()) {
    // The pre-cache path: one full draw list, every cell painted live.
    const layered = buildLayeredDrawList(marginContext, { splitDynamic: false });
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, widthCss, heightCss);
    paint(layered.staticOps, effectOps, suppressHeroGlyph, nowMs);
    needsPaint = false;
    if (!cameraSettled || !heroSettled || hasActiveEffect(nowMs)
      || layered.hasContinuousAnimation || needsPaint) schedule();
    else lastFrameMs = 0;
    return;
  }

  // The cached layer follows the camera a tile at a time rather than being
  // left alone until the camera falls off its edge.
  //
  // Waiting for the edge meant one scroll every CACHE_PAD_TILES steps, and
  // that scroll had to repaint a strip that many tiles wide - hundreds of
  // cells in one frame, which Timothy still felt: "very minor hitch with
  // cache now ... be cool if it still was not there." Re-centring on every
  // whole tile of camera movement does the same total work, in strips one
  // tile wide, spread evenly over the steps that caused it.
  const desiredGx = Math.floor(camGx) - MARGIN_TILES - CACHE_PAD_TILES;
  const desiredGy = Math.floor(camGy) - MARGIN_TILES - CACHE_PAD_TILES;
  const cacheSizeMatches = cacheTilesWide === marginContext.tilesWide + CACHE_PAD_TILES * 2
    && cacheTilesTall === marginContext.tilesTall + CACHE_PAD_TILES * 2;
  if (staticCacheDirty || cacheOriginGx === null || !cacheSizeMatches) {
    const layered = rebuildStaticCache(marginContext);
    cachedAnimatedCells = layered ? layered.animatedCells : [];
  } else if (desiredGx !== cacheOriginGx || desiredGy !== cacheOriginGy) {
    if (!scrollStaticCache(desiredGx, desiredGy)) {
      const layered = rebuildStaticCache(marginContext);
      cachedAnimatedCells = layered ? layered.animatedCells : [];
    }
  }
  const hasContinuousAnimation = cachedAnimatedCells.length > 0;

  const dynamic = buildDynamicOps(marginContext, cachedAnimatedCells);

  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2d.clearRect(0, 0, widthCss, heightCss);
  blitStaticCache();
  paint(dynamic.ops, effectOps, suppressHeroGlyph, nowMs);
  needsPaint = false;

  // Keep the loop alive only while something is actually changing. Standing
  // still with nothing animating on screen schedules no frames at all.
  if (!cameraSettled || !heroSettled || hasActiveEffect(nowMs) || hasContinuousAnimation || needsPaint) {
    schedule();
  } else {
    lastFrameMs = 0;
  }
}

// One drawImage of the whole cached layer, at the camera's own fractional
// offset - which is what replaces re-issuing every ground fill, trail stroke
// and static sprite on screen, every frame.
function blitStaticCache() {
  if (!staticCanvas || cacheOriginGx === null) return;
  ctx2d.drawImage(
    staticCanvas,
    (cacheOriginGx - camGx) * TILE_SIZE_PX,
    (cacheOriginGy - camGy) * TILE_SIZE_PX,
    cacheTilesWide * TILE_SIZE_PX,
    cacheTilesTall * TILE_SIZE_PX,
  );
}

function schedule() {
  if (rafId !== null || typeof requestAnimationFrame !== 'function') return;
  rafId = requestAnimationFrame(frame);
}

// The draw list covers the viewport plus MARGIN_TILES on every side - see
// that constant's comment. Done here rather than in mapScreen's own geometry
// so the DOM renderer, which needs no margin, isn't made to carry one.
//
// Anchored to the CAMERA, not to the context's own origin. The two used to be
// within a tile of each other, but now that the camera follows the hero's
// interpolated position it trails the hero's logical tile by the hero's own
// sub-tile offset plus the camera's steady-state lag - past two tiles at the
// slowest glide setting, which would have left an unpainted strip at the
// trailing edge. The camera is one frame stale here (it advances after the
// draw list is built, so that it can aim at this frame's hero), which is
// under a quarter tile of movement and well inside the margin.
function expandForMargin(context) {
  const anchorGx = camGx === null ? context.originGx : Math.floor(camGx);
  const anchorGy = camGy === null ? context.originGy : Math.floor(camGy);
  return {
    ...context,
    originGx: anchorGx - MARGIN_TILES,
    originGy: anchorGy - MARGIN_TILES,
    tilesWide: context.tilesWide + MARGIN_TILES * 2,
    tilesTall: context.tilesTall + MARGIN_TILES * 2,
  };
}

// ---------------------------------------------------------------------------
// Hover tooltip
// ---------------------------------------------------------------------------

// Canvas has no `title` attribute to hang a tile's description on, so the
// pointer is hit-tested back to a world coordinate and a tooltip element is
// positioned by hand. Only touched when the tile under the cursor actually
// changes, so moving across one tile costs nothing.
function handlePointerMove(event) {
  if (!renderContext || camGx === null) return;
  const rect = canvasEl.getBoundingClientRect();
  const gx = Math.floor(camGx + (event.clientX - rect.left) / TILE_SIZE_PX);
  const gy = Math.floor(camGy + (event.clientY - rect.top) / TILE_SIZE_PX);
  if (hoverTile && hoverTile.gx === gx && hoverTile.gy === gy) {
    positionTooltip(event);
    return;
  }
  hoverTile = { gx, gy };
  const text = describeSignature(renderContext.signatureAt(gx, gy));
  if (!text) {
    tooltipEl.hidden = true;
    return;
  }
  tooltipEl.textContent = text;
  tooltipEl.hidden = false;
  positionTooltip(event);
}

function positionTooltip(event) {
  if (tooltipEl.hidden) return;
  const rect = canvasEl.getBoundingClientRect();
  tooltipEl.style.left = `${event.clientX - rect.left + 14}px`;
  tooltipEl.style.top = `${event.clientY - rect.top + 18}px`;
}

function handlePointerLeave() {
  hoverTile = null;
  if (tooltipEl) tooltipEl.hidden = true;
}

// ---------------------------------------------------------------------------
// Renderer interface (mirrors js/screens/mapDomRenderer.js)
// ---------------------------------------------------------------------------

export function renderFull(viewport, context) {
  renderContext = context;
  camGx = null;
  camGy = null;
  heroGx = null;
  heroGy = null;
  hoverTile = null;
  // A full rebuild means a new mount, a resize or a cluster change - the
  // cached pixels belong to a world that may not be on screen any more, and
  // the canvas below is about to be replaced outright.
  staticCanvas = null;
  staticCtx = null;
  staticBackCanvas = null;
  staticBackCtx = null;
  cacheOriginGx = null;
  cacheOriginGy = null;
  cachedAnimatedCells = [];
  invalidateStaticCache();

  const canvas = document.createElement('canvas');
  canvas.className = 'map-canvas';
  const tooltip = document.createElement('div');
  tooltip.className = 'map-tooltip';
  tooltip.hidden = true;
  viewport.append(canvas, tooltip);

  canvasEl = canvas;
  tooltipEl = tooltip;
  // jsdom has no canvas implementation - getContext('2d') returns null there
  // (tests/helpers/dom.js). Everything below is a no-op in that case rather
  // than a crash, so mapScreen.js's non-rendering behavior (movement,
  // encounters, callbacks) stays testable without a browser.
  ctx2d = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx2d) return;

  dpr = window.devicePixelRatio || 1;
  invalidateSprites();
  resizeCanvasToViewport(viewport);

  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  // A font that finishes loading after the first paint would otherwise leave
  // tofu boxes baked into the atlas for the life of the session.
  document.fonts?.ready?.then(invalidateSprites).catch(() => {});

  needsPaint = true;
  lastFrameMs = 0;
  schedule();
}

function resizeCanvasToViewport(viewport) {
  const width = viewport.clientWidth || 0;
  const height = viewport.clientHeight || 0;
  canvasEl.width = Math.max(1, Math.round(width * dpr));
  canvasEl.height = Math.max(1, Math.round(height * dpr));
  canvasEl.style.width = `${width}px`;
  canvasEl.style.height = `${height}px`;
}

export function renderStep(context) {
  if (!canvasEl) return false;
  renderContext = context;
  needsPaint = true;
  // A step re-marks the trail on the tile walked onto and the tile walked
  // off, so the cached pixels for those two tiles are now stale. mapScreen
  // says which they are, and patching just those is what keeps a step from
  // costing a full repaint - see patchStaticCache. Anything that does NOT
  // name its changed tiles (a discovery, a cleared gate, any future caller)
  // falls back to repainting everything, because a missed patch would leave
  // stale pixels on screen until the camera happened to move far enough.
  const patched = Array.isArray(context.changedTiles)
    && context.changedTiles.length > 0
    && !staticCacheDirty
    && patchStaticCache(context.changedTiles);
  if (!patched) invalidateStaticCache();
  // A devicePixelRatio change (dragging between monitors) fires no resize
  // event of its own, so it's checked on the hot path - a cheap property
  // read, unlike the clientWidth/clientHeight measurement that was removed
  // from here for forcing a synchronous layout every step.
  const currentDpr = window.devicePixelRatio || 1;
  if (currentDpr !== dpr) {
    dpr = currentDpr;
    invalidateSprites();
    // The cached layer was rasterised at the old ratio, so it is as stale as
    // the glyph atlas is - and its backing canvas needs resizing, not just
    // repainting, which dropping it outright takes care of.
    staticCanvas = null;
    staticCtx = null;
    staticBackCanvas = null;
    staticBackCtx = null;
    if (canvasEl.parentElement) resizeCanvasToViewport(canvasEl.parentElement);
  }
  schedule();
  return true;
}

export function destroy() {
  if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
  rafId = null;
  canvasEl?.removeEventListener('pointermove', handlePointerMove);
  canvasEl?.removeEventListener('pointerleave', handlePointerLeave);
  canvasEl = null;
  ctx2d = null;
  tooltipEl = null;
  renderContext = null;
  camGx = null;
  camGy = null;
  heroGx = null;
  heroGy = null;
  lastPlayerTile = null;
  hoverTile = null;
  lastFrameMs = 0;
  resetEffects();
  glyphCache.clear();
  gradientCache.clear();
  portalShadowSprite = null;
  questGlowSprite = null;
}

// The hero's on-screen rectangle, computed from the camera rather than read
// off an element - see mapScreen.js's getPlayerScreenRect for why both
// renderers answer this.
export function getPlayerScreenRect() {
  if (!canvasEl || !lastPlayerTile || camGx === null) return null;
  const rect = canvasEl.getBoundingClientRect();
  // Their drawn position, not their tile's - an effect anchored here while
  // they're mid-stride (a tool celebration, a fleeing monster) has to start
  // from where they actually appear to be.
  const gx = heroGx === null ? lastPlayerTile.gx : heroGx;
  const gy = heroGy === null ? lastPlayerTile.gy : heroGy;
  return {
    left: rect.left + (gx - camGx) * TILE_SIZE_PX,
    top: rect.top + (gy - camGy) * TILE_SIZE_PX,
    width: TILE_SIZE_PX,
    height: TILE_SIZE_PX,
  };
}

export function playLevelUpEffect(durationMs) {
  startLevelUp(performance.now(), durationMs);
  needsPaint = true;
  schedule();
}

export function playWellHealEffect(durationMs) {
  startWellHeal(performance.now(), durationMs);
  needsPaint = true;
  schedule();
}

export function playPortalPullEffect(durationMs) {
  startPortalPull(performance.now(), durationMs);
  needsPaint = true;
  schedule();
}
