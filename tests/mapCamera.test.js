// Tests for the canvas map renderer's camera lerp
// (js/screens/mapCanvasRenderer.js's computeCameraStep).
//
// Raised live by Timothy 2026-09-10: "I don't think the camera glide is
// working... it seems it snaps instantly no matter the setting and even on
// default." The cause was that a "no elapsed time measured yet" frame
// (dtMs<=0, which happens on the very first frame after the render loop
// wakes from idle - see frame()'s own lastFrameMs reset) was folded into the
// same branch as "too far behind, snap immediately." Since an ordinary step
// only moves the camera ~1 tile - well under the real snap threshold - that
// first frame always finished the whole move before any frame with a real
// delta ever ran, so the exponential lerp was live code that could never
// actually execute, at any smoothing setting.
//
// This couldn't be caught by watching a real browser, even after the fact:
// confirming it needs replaying multiple animation frames, and the
// automated tab driving that check turned out to have its OS-level
// visibility state hidden (Chrome fully suspends requestAnimationFrame for
// a hidden/unfocused tab), so the game's own render loop never advanced
// there regardless of the fix. computeCameraStep is exported specifically so
// this class of regression has a seam that doesn't depend on real animation
// frames, an OS-focused window, or a canvas implementation (jsdom has none)
// at all - it's tested here as what it actually is, a pure function of
// (current position, target, smoothing setting, elapsed time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { __testables } from '../js/screens/mapCanvasRenderer.js';

const {
  computeCameraStep, CAMERA_SETTLE_TILES, CAMERA_SNAP_TILES,
  computeHeroStep, HERO_SNAP_TILES,
} = __testables;

const FAR = { gx: 10, gy: 0 }; // 10 tiles away - inside CAMERA_SNAP_TILES's "no" range is huge, so pick a nearby target for normal-step tests
const ONE_TILE_AWAY = { gx: 1, gy: 0 };
const ORIGIN = { gx: 0, gy: 0 };

test('mapCamera - the exact regression: dtMs<=0 must not snap', async (t) => {
  await t.test('a zero-delta frame (the render loop waking from idle) does not move the camera at all', () => {
    const result = computeCameraStep(ORIGIN, ONE_TILE_AWAY, 80, 0);
    assert.deepEqual({ gx: result.camGx, gy: result.camGy }, ORIGIN, 'must not have jumped toward the target');
    assert.equal(result.settled, false, 'must stay unsettled so the loop schedules a real frame next');
  });

  await t.test('a negative delta (defensive) is treated the same as zero', () => {
    const result = computeCameraStep(ORIGIN, ONE_TILE_AWAY, 80, -5);
    assert.deepEqual({ gx: result.camGx, gy: result.camGy }, ORIGIN);
    assert.equal(result.settled, false);
  });

  await t.test('once a real delta follows the zero-delta frame, the camera actually moves', () => {
    const first = computeCameraStep(ORIGIN, ONE_TILE_AWAY, 80, 0);
    const cam = { gx: first.camGx, gy: first.camGy };
    const second = computeCameraStep(cam, ONE_TILE_AWAY, 80, 16);
    assert.ok(second.camGx > 0, 'expected real progress toward the target on the first frame with a measured delta');
    assert.ok(second.camGx < 1, 'expected a partial step, not an immediate arrival - that would just be a slower snap');
  });
});

test('mapCamera - normal gliding', async (t) => {
  await t.test('the camera approaches the target smoothly across several frames, never overshooting', () => {
    let cam = ORIGIN;
    const xs = [];
    for (let i = 0; i < 40; i++) {
      const result = computeCameraStep(cam, ONE_TILE_AWAY, 80, 16);
      cam = { gx: result.camGx, gy: result.camGy };
      xs.push(cam.gx);
      if (result.settled) break;
    }
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i] >= xs[i - 1], `camera position must be monotonically non-decreasing toward the target, went backwards at frame ${i}`);
      assert.ok(xs[i] <= ONE_TILE_AWAY.gx + 1e-9, `must never overshoot the target, got ${xs[i]}`);
    }
    assert.ok(xs[xs.length - 1] > ONE_TILE_AWAY.gx - CAMERA_SETTLE_TILES, 'expected the camera to have actually arrived by the end');
  });

  await t.test('a larger smoothing value takes visibly longer to close the same gap', () => {
    const stepsToSettle = (smoothingMs) => {
      let cam = ORIGIN;
      let steps = 0;
      for (let i = 0; i < 1000; i++) {
        const result = computeCameraStep(cam, ONE_TILE_AWAY, smoothingMs, 16);
        cam = { gx: result.camGx, gy: result.camGy };
        steps++;
        if (result.settled) break;
      }
      return steps;
    };
    assert.ok(stepsToSettle(200) > stepsToSettle(40), 'a bigger cameraSmoothingMs should take more frames to settle');
  });

  await t.test('smoothingMs=0 (the pre-canvas instant-snap behavior) arrives in a single frame regardless of dtMs', () => {
    const result = computeCameraStep(ORIGIN, ONE_TILE_AWAY, 0, 16);
    assert.deepEqual({ gx: result.camGx, gy: result.camGy }, ONE_TILE_AWAY);
    assert.equal(result.settled, true);
  });
});

test('mapCamera - snap conditions', async (t) => {
  await t.test('a fresh mount (cam=null) places the camera exactly, never lerping in from nowhere', () => {
    const result = computeCameraStep(null, ONE_TILE_AWAY, 80, 16);
    assert.deepEqual({ gx: result.camGx, gy: result.camGy }, ONE_TILE_AWAY);
    assert.equal(result.settled, true);
  });

  await t.test('a gap larger than CAMERA_SNAP_TILES snaps immediately, so holding a key can never outrun the view', () => {
    assert.ok(Math.hypot(FAR.gx, FAR.gy) > CAMERA_SNAP_TILES, 'test setup: FAR must actually exceed the snap threshold');
    const result = computeCameraStep(ORIGIN, FAR, 80, 16);
    assert.deepEqual({ gx: result.camGx, gy: result.camGy }, FAR);
    assert.equal(result.settled, true);
  });

  await t.test('a gap already inside CAMERA_SETTLE_TILES is treated as arrived', () => {
    const almostThere = { gx: 1 - CAMERA_SETTLE_TILES / 2, gy: 0 };
    const result = computeCameraStep(almostThere, ONE_TILE_AWAY, 80, 16);
    assert.deepEqual({ gx: result.camGx, gy: result.camGy }, ONE_TILE_AWAY);
    assert.equal(result.settled, true);
  });
});

// The hero's own sub-tile stride, added 2026-09-10: "the character seems to
// snap between squares. Can they go smoothly too just like the map does now?"
// Their logical position is always a whole tile, so this interpolates only
// what's drawn. Constant speed rather than the camera's easing - see
// computeHeroStep's own header for why easing would make a held key stutter.
test('mapHero - the stride between tiles', async (t) => {
  const STEP_MS = 110;

  await t.test('crosses exactly one tile per step interval, at a constant rate', () => {
    // Half an interval covers half a tile - not most of it, which is what an
    // ease-out would do, and not a sliver, which is what an ease-in would.
    const half = computeHeroStep({ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, STEP_MS, STEP_MS / 2);
    assert.ok(Math.abs(half.heroGx - 0.5) < 1e-9, `expected exactly half a tile, got ${half.heroGx}`);
    assert.equal(half.settled, false);
  });

  await t.test('arrives exactly on the tile at the end of the interval, never overshooting', () => {
    const arrived = computeHeroStep({ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, STEP_MS, STEP_MS);
    assert.deepEqual({ gx: arrived.heroGx, gy: arrived.heroGy }, { gx: 1, gy: 0 });
    assert.equal(arrived.settled, true, 'arriving must settle so the render loop can go idle');

    const overshot = computeHeroStep({ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, STEP_MS, STEP_MS * 5);
    assert.deepEqual({ gx: overshot.heroGx, gy: overshot.heroGy }, { gx: 1, gy: 0 }, 'a long frame clamps to the tile rather than sailing past it');
  });

  await t.test('covers the same distance per frame diagonally as it does straight', () => {
    // The rate is along the path, not per-axis - otherwise moving on both
    // axes at once would quietly travel faster. A quarter-interval frame so
    // neither case arrives, and both targets stay inside HERO_SNAP_TILES so
    // neither snaps instead of striding.
    const dt = STEP_MS / 4;
    const straight = computeHeroStep({ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, STEP_MS, dt);
    const diagonal = computeHeroStep({ gx: 0, gy: 0 }, { gx: 1, gy: 1 }, STEP_MS, dt);
    assert.equal(straight.settled, false, 'test setup: expected a partial stride, not an arrival');
    assert.equal(diagonal.settled, false, 'test setup: expected a partial stride, not an arrival');
    const straightMoved = Math.hypot(straight.heroGx, straight.heroGy);
    const diagonalMoved = Math.hypot(diagonal.heroGx, diagonal.heroGy);
    assert.ok(Math.abs(straightMoved - diagonalMoved) < 1e-9, `expected the same distance covered either way, got ${straightMoved} vs ${diagonalMoved}`);
  });

  await t.test('a fresh mount places the hero exactly, never sliding in from nowhere', () => {
    const result = computeHeroStep(null, { gx: 7, gy: 3 }, STEP_MS, 16);
    assert.deepEqual({ gx: result.heroGx, gy: result.heroGy }, { gx: 7, gy: 3 });
    assert.equal(result.settled, true);
  });

  await t.test('stepMs of 0 - the glide slider turned off - snaps, reproducing the pre-canvas feel', () => {
    const result = computeHeroStep({ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, 0, 16);
    assert.deepEqual({ gx: result.heroGx, gy: result.heroGy }, { gx: 1, gy: 0 });
    assert.equal(result.settled, true);
  });

  await t.test('a teleport-sized jump snaps rather than gliding across the map', () => {
    const far = { gx: HERO_SNAP_TILES + 5, gy: 0 };
    const result = computeHeroStep({ gx: 0, gy: 0 }, far, STEP_MS, 16);
    assert.deepEqual({ gx: result.heroGx, gy: result.heroGy }, far);
    assert.equal(result.settled, true);
  });

  await t.test('a zero-delta frame waits rather than snapping - same rule the camera has', () => {
    const result = computeHeroStep({ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, STEP_MS, 0);
    assert.deepEqual({ gx: result.heroGx, gy: result.heroGy }, { gx: 0, gy: 0 });
    assert.equal(result.settled, false);
  });
});
