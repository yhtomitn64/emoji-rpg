// The map's one-shot effects (level-up, well heal, portal pull) as pure
// tweens: given a clock reading, each returns draw ops. No DOM, no canvas,
// no timers - mapCanvasRenderer.js samples this once per frame from inside
// its own requestAnimationFrame loop, and tests sample it at chosen
// timestamps to assert the actual curve values.
//
// These were CSS keyframe animations on the player's own .map-tile-player
// cell (css/styles.css) under the DOM renderer, which still uses them. They
// were ported rather than kept as an overlay so the map has exactly one
// animation system: effects can now depth-sort against tiles (the level-up
// rays really do sit behind the hero), and adding a new one is a tween here
// instead of a CSS/JS split across two files.
//
// Deliberately NOT ported: playMonsterFleeEffect, which stays a
// document.body element under both renderers - it's meant to fly outside the
// map viewport, which a canvas draw would be clipped to. See its comment in
// mapScreen.js.

// CSS timing functions. `ease-out`/`ease-in` are the CSS keywords' own
// control points; the third is the one .map-well-heal-ring names explicitly.
const EASE_OUT = [0, 0, 0.58, 1];
const EASE_IN = [0.42, 0, 1, 1];
const WELL_RING_EASE = [0.3, 0.6, 0.3, 1];

// Standard cubic-bezier easing: the curve is parametric, so finding y for a
// given x means solving for the parameter t first. Newton-Raphson converges
// in a couple of iterations for the well-behaved curves above; the bisection
// fallback covers the flat-derivative case Newton can't escape.
function bezierEase([x1, y1, x2, y2], x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const curveX = (t) => {
    const u = 1 - t;
    return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
  };
  const curveY = (t) => {
    const u = 1 - t;
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
  };
  const slopeX = (t) => {
    const u = 1 - t;
    return 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
  };
  let t = x;
  for (let i = 0; i < 5; i++) {
    const dx = curveX(t) - x;
    if (Math.abs(dx) < 1e-6) return curveY(t);
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= dx / d;
  }
  let lo = 0, hi = 1;
  t = x;
  for (let i = 0; i < 20; i++) {
    const cx = curveX(t);
    if (Math.abs(cx - x) < 1e-6) break;
    if (cx < x) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return curveY(t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// A CSS keyframe track: stops of [progress, value], interpolated pairwise
// with `easing` applied between each adjacent pair - which is how a CSS
// animation's timing function actually behaves (per segment, not once across
// the whole animation).
function track(stops, easing, progress) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, v0] = stops[i];
    const [p1, v1] = stops[i + 1];
    if (progress <= p1 || i === stops.length - 2) {
      const span = p1 - p0;
      const local = span <= 0 ? 1 : Math.min(1, Math.max(0, (progress - p0) / span));
      return lerp(v0, v1, bezierEase(easing, local));
    }
  }
  return stops[stops.length - 1][1];
}

// @keyframes map-tile-levelup-pulse / map-levelup-rays-burst
const LEVEL_UP_HERO_SCALE = [[0, 1], [0.3, 2.2], [1, 1]];
const LEVEL_UP_RAYS_SCALE = [[0, 0.2], [1, 1.4]];
const LEVEL_UP_RAYS_ROTATE = [[0, 0], [1, 60]];
const LEVEL_UP_RAYS_ALPHA = [[0, 0], [0.3, 1], [1, 0]];
// repeating-conic-gradient(from 0deg, rgba(255,245,160,0.7) 0deg 8deg,
// transparent 8deg 24deg) - 15 wedges of 8deg every 24deg.
export const LEVEL_UP_RAY_COUNT = 15;
export const LEVEL_UP_RAY_ARC_DEG = 8;
export const LEVEL_UP_RAY_COLOR = 'rgba(255, 245, 160, 0.7)';
// .map-levelup-rays is 300% of the tile.
const LEVEL_UP_RAYS_BASE_SCALE = 3;

// @keyframes map-well-heal-ring - the element is a 6px box with an animated
// border, so its outer diameter is 6 + 2*borderWidth and the stroke sits
// halfway in. Radius here is mid-stroke, which is what ctx.arc + lineWidth
// wants.
const WELL_RING_SCALE = [[0, 24], [1, 1]];
const WELL_RING_ALPHA = [[0, 0.9], [0.7, 0.9], [1, 0]];
const WELL_RING_BORDER = [[0, 2], [0.7, 4], [1, 6]];
const WELL_RING_BASE_PX = 6;
export const WELL_RING_COLOR = 'rgba(90, 170, 255, ALPHA)';
// @keyframes map-well-heal-glow - starts 750ms in, runs 700ms.
const WELL_GLOW_DELAY_MS = 750;
const WELL_GLOW_DURATION_MS = 700;
const WELL_GLOW_SCALE = [[0, 0.3], [1, 1.4]];
const WELL_GLOW_ALPHA = [[0, 0.9], [1, 0]];
// .map-well-heal-glow is 60% of the tile.
const WELL_GLOW_BASE_FRACTION = 0.6;

// @keyframes map-tile-player-portal-pull
const PORTAL_PULL_SCALE = [[0, 1], [1, 0.15]];
const PORTAL_PULL_ROTATE = [[0, 0], [1, 35]];
const PORTAL_PULL_ALPHA = [[0, 1], [1, 0]];
const PORTAL_PULL_BRIGHTNESS = [[0, 1], [1, 2.2]];

// Active effects, each `{ startedAt, durationMs }` or null. Module-level
// (rather than passed in) so mapScreen.js can fire one from a callback
// without threading state through the renderer, matching how the DOM
// renderer's own setTimeout-based effects behaved.
let levelUp = null;
let wellHeal = null;
let portalPull = null;

export function startLevelUp(now, durationMs) {
  levelUp = { startedAt: now, durationMs };
}

export function startWellHeal(now, durationMs) {
  wellHeal = { startedAt: now, durationMs };
}

export function startPortalPull(now, durationMs) {
  portalPull = { startedAt: now, durationMs };
}

export function reset() {
  levelUp = null;
  wellHeal = null;
  portalPull = null;
}

export function hasActiveEffect(now) {
  return [levelUp, wellHeal, portalPull].some((fx) => fx && now - fx.startedAt < fx.durationMs);
}

function progressOf(fx, now) {
  if (!fx) return null;
  const elapsed = now - fx.startedAt;
  if (elapsed < 0 || elapsed >= fx.durationMs) return null;
  return elapsed / fx.durationMs;
}

// Draw ops for whatever is currently animating, anchored to the player's
// tile. Returns `suppressHeroGlyph` when an effect draws the hero itself
// (level-up scales them, portal pull spins them away), so the painter can
// skip the plain hero glyph the draw list already emitted rather than
// double-drawing it.
export function sampleEffects(now, playerTile, playerEmoji, heroSizePx) {
  const ops = [];
  let suppressHeroGlyph = false;
  if (!playerTile) return { ops, suppressHeroGlyph };
  const { gx, gy } = playerTile;

  const levelUpProgress = progressOf(levelUp, now);
  if (levelUpProgress !== null) {
    suppressHeroGlyph = true;
    // z-index: -1 on .map-levelup-rays - behind the hero, above the ground.
    ops.push({
      op: 'rays', gx, gy,
      // In tile widths, not pixels - .map-levelup-rays sized itself as a
      // percentage of its tile, so this stays resolution-independent and the
      // painter multiplies by the tile size.
      radiusTiles: (LEVEL_UP_RAYS_BASE_SCALE * track(LEVEL_UP_RAYS_SCALE, EASE_OUT, levelUpProgress)) / 2,
      rotateDeg: track(LEVEL_UP_RAYS_ROTATE, EASE_OUT, levelUpProgress),
      alpha: track(LEVEL_UP_RAYS_ALPHA, EASE_OUT, levelUpProgress),
    });
    ops.push({
      op: 'glyph', gx, gy, emoji: playerEmoji, sizePx: heroSizePx, anchor: 'center',
      scale: track(LEVEL_UP_HERO_SCALE, EASE_OUT, levelUpProgress),
      isPlayer: true,
    });
  }

  const wellProgress = progressOf(wellHeal, now);
  if (wellProgress !== null) {
    const scale = track(WELL_RING_SCALE, WELL_RING_EASE, wellProgress);
    const border = track(WELL_RING_BORDER, WELL_RING_EASE, wellProgress);
    ops.push({
      op: 'ring', gx, gy,
      radiusPx: ((WELL_RING_BASE_PX + border) * scale) / 2,
      lineWidthPx: border * scale,
      alpha: track(WELL_RING_ALPHA, WELL_RING_EASE, wellProgress),
    });
    // The glow is a separately-delayed animation on its own element, not a
    // later keyframe of the ring's - so it runs on its own clock.
    const glowElapsed = (now - wellHeal.startedAt) - WELL_GLOW_DELAY_MS;
    if (glowElapsed >= 0 && glowElapsed < WELL_GLOW_DURATION_MS) {
      const glowProgress = glowElapsed / WELL_GLOW_DURATION_MS;
      ops.push({
        op: 'glow', gx, gy,
        // Tile widths, like the rays above - .map-well-heal-glow was 60% of
        // its tile. The ring's own radius, by contrast, really is in pixels:
        // it came from a fixed 6px box plus an animated border width.
        radiusTiles: (WELL_GLOW_BASE_FRACTION * track(WELL_GLOW_SCALE, EASE_OUT, glowProgress)) / 2,
        alpha: track(WELL_GLOW_ALPHA, EASE_OUT, glowProgress),
      });
    }
  }

  const pullProgress = progressOf(portalPull, now);
  if (pullProgress !== null) {
    suppressHeroGlyph = true;
    ops.push({
      op: 'glyph', gx, gy, emoji: playerEmoji, sizePx: heroSizePx, anchor: 'center',
      scale: track(PORTAL_PULL_SCALE, EASE_IN, pullProgress),
      rotateDeg: track(PORTAL_PULL_ROTATE, EASE_IN, pullProgress),
      alpha: track(PORTAL_PULL_ALPHA, EASE_IN, pullProgress),
      brightness: track(PORTAL_PULL_BRIGHTNESS, EASE_IN, pullProgress),
      isPlayer: true,
    });
  }

  return { ops, suppressHeroGlyph };
}

// Exported for tests - the tween helpers are the part worth asserting
// directly, independent of any particular effect.
export const __testables = { bezierEase, track, EASE_OUT, EASE_IN, WELL_RING_EASE };
