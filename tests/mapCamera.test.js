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

const { computeCameraStep, CAMERA_SETTLE_TILES, CAMERA_SNAP_TILES } = __testables;

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
