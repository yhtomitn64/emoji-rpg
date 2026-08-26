import { TILES } from '../tiles.js';
import { hash01 } from './world.js';

// How many distinct visits it takes for a tile's trail to reach full wear -
// see docs/superpowers/specs/2026-08-25-worn-path-trail-design.md.
export const TRAIL_WEAR_CAP = 10;

export function trailWearFraction(visitCount) {
  return Math.min(visitCount, TRAIL_WEAR_CAP) / TRAIL_WEAR_CAP;
}

export function trailStrokeWidth(fraction) {
  return 10 + 8 * fraction;
}

// A stroke's width, unlike its color, can't be gradiented along its own
// length - SVG paints (fill/stroke color) support gradients, stroke-width
// doesn't. Averaging the two endpoints' fractions instead is the next best
// thing: it's symmetric (fractionA, fractionB) and (fractionB, fractionA)
// give the same result, so the two tiles sharing an edge always compute the
// exact same width for their half of that connection - no hard step where a
// heavily-worn tile's thick stroke meets a lightly-worn neighbor's thin one.
export function trailStrokeWidthBetween(fractionA, fractionB) {
  return trailStrokeWidth((fractionA + fractionB) / 2);
}

export function trailDotRadius(fraction) {
  return 6 + 6 * fraction;
}

// The edge between two adjacent tiles is always "owned" by whichever tile
// has the lower coordinate on that axis, so both tiles compute the exact
// same (x, y, axis) for their shared border and therefore the same jitter -
// see edgeJitter below. Without this, two tiles independently jittering
// "their own" idea of the same edge would produce a visible seam.
export function edgeOwner(x, y, direction) {
  if (direction === 'e') return { x, y, axis: 'h' };
  if (direction === 'w') return { x: x - 1, y, axis: 'h' };
  if (direction === 's') return { x, y, axis: 'v' };
  if (direction === 'n') return { x, y: y - 1, axis: 'v' };
  throw new Error(`Unknown trail direction: ${direction}`);
}

// Independent salted hash01 stream per axis (same salted-offset convention
// js/screens/mapScreen.js already uses for decoration placement), so a
// tile's north/south edge waviness doesn't move in lockstep with its
// east/west edge waviness.
export function edgeJitter(x, y, axis) {
  const salt = axis === 'h' ? 6000 : 7000;
  return hash01(x + salt, y + salt) - 0.5;
}

// The edge-midpoint a connector stroke reaches toward, per direction, in the
// same 0..size coordinate space as connectorPathD below. Shared by
// connectorPathD (the curve's endpoint) and mapScreen.js (a gradient's
// endpoint needs the same point, in a straight line, to fade color toward
// that edge in the same direction the stroke actually travels).
export function edgeTargetPoint(direction, size = 100) {
  const cx = size / 2, cy = size / 2;
  const targets = { n: [cx, 0], s: [cx, size], w: [0, cy], e: [size, cy] };
  const target = targets[direction];
  if (!target) throw new Error(`Unknown trail direction: ${direction}`);
  return target;
}

// SVG path 'd' for a quadratic curve from a tile's center to the midpoint
// of one edge, bowed perpendicular to that direction by `jitterFraction`
// (-0.5..0.5, from edgeJitter) so it reads as a soft wavy stroke instead of
// a straight line. `size` is the tile's own coordinate-space size (a 0..size
// square) - render() uses a 0..100 SVG viewBox per tile, so callers there
// pass size=100 (the default) and the wear-amount functions above already
// return numbers in that same 0..100-ish scale.
export function connectorPathD(direction, jitterFraction, size = 100) {
  const cx = size / 2, cy = size / 2;
  const [tx, ty] = edgeTargetPoint(direction, size);
  const mx = (cx + tx) / 2, my = (cy + ty) / 2;
  const dx = tx - cx, dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const amp = jitterFraction * size * 0.35;
  const qx = mx + px * amp, qy = my + py * amp;
  return `M ${cx} ${cy} Q ${qx.toFixed(2)} ${qy.toFixed(2)} ${tx} ${ty}`;
}

// Terrain-keyed trail color, not a hardcoded one, so future terrain types
// (sand/swamp/ice - see backlog) are a data addition here, not a rendering
// change. Falls back to the grass color for anything not yet in the map.
const TRAIL_COLOR_BY_TILE = new Map([
  [TILES.grass, '#6b4a2f'],
  [TILES.caveFloor, '#7a7a7a'],
  // Lighter, more saturated blue than water's own base tile color
  // (#2b6cb0, see .map-tile-water in css/styles.css) - reads as a wake/foam
  // trail left by the boat rather than the brown dirt-path color bleeding
  // across blue water.
  [TILES.water, '#4a7fa8'],
]);
const DEFAULT_TRAIL_COLOR = '#6b4a2f';

export function getTrailColor(tile) {
  return TRAIL_COLOR_BY_TILE.get(tile) || DEFAULT_TRAIL_COLOR;
}

// The tile's own actual ground color underneath the trail - matches the
// background each terrain's .map-tile-* CSS class already paints (see
// css/styles.css), so a bare-unworn stroke reads as fully blended into the
// ground and a fully-worn one reads as the solid trail color, with nothing
// in between relying on transparency. `caveFloor` has no dedicated CSS
// class of its own, falling through to the base .map-tile background.
const TRAIL_GROUND_COLOR_BY_TILE = new Map([
  [TILES.grass, '#3f6b34'],
  [TILES.caveFloor, '#333333'],
  [TILES.water, '#2b6cb0'],
]);
const DEFAULT_GROUND_COLOR = '#3f6b34';

export function getGroundColor(tile) {
  return TRAIL_GROUND_COLOR_BY_TILE.get(tile) || DEFAULT_GROUND_COLOR;
}

// Linear per-channel blend from colorA (t=0) to colorB (t=1), both #rrggbb.
export function blendColors(colorA, colorB, t) {
  const parse = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(colorA);
  const [r2, g2, b2] = parse(colorB);
  const mix = (c1, c2) => Math.round(c1 + (c2 - c1) * t);
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

// A wear fraction expressed as a color, not an opacity: fully unworn (0)
// is indistinguishable from the bare ground, fully worn (1) is the solid
// trail color, and everything between is a real blended color - never a
// separate transparency value. This is deliberate: an earlier version used
// opacity for this, which had to live as one flat value per *tile* (to
// avoid overlapping strokes at a junction's center alpha-stacking into a
// dark blob), so two connected tiles with very different wear rendered
// their nominally-matching gradient colors at very different translucency
// and produced a hard seam right at the border - confirmed live against a
// real save (tile with 38 visits next to one with 1: same gradient hex on
// both sides, but 0.8 opacity meeting 0.305). Baking wear into fully-opaque
// color instead sidesteps that class of bug entirely: overlapping strokes
// at a center simply paint over each other with no compositing artifact,
// and two tiles sharing an edge already agree on this fraction (see
// getNeighborWearFraction in mapScreen.js), so their colors always match.
export function trailColorForFraction(baseColor, groundColor, fraction) {
  return blendColors(groundColor, baseColor, fraction);
}
