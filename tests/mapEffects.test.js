// Tests for the map's one-shot effects as canvas tweens
// (js/systems/mapEffects.js), ported from the CSS keyframe animations the
// DOM renderer still uses (css/styles.css). Pure functions of a clock
// reading, so each curve can be sampled at chosen timestamps instead of
// waiting on real animation frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startLevelUp, startWellHeal, startPortalPull, reset, hasActiveEffect, sampleEffects,
  __testables,
} from '../js/systems/mapEffects.js';

const { bezierEase, track, EASE_OUT } = __testables;
const TILE = { gx: 3, gy: 4 };
const HERO = '🧙';
const HERO_SIZE = 36;

function sampleAt(t) {
  return sampleEffects(t, TILE, HERO, HERO_SIZE);
}

function opOf(result, kind) {
  return result.ops.find((op) => op.op === kind);
}

test('mapEffects - easing', async (t) => {
  await t.test('a cubic-bezier easing is pinned at both ends and monotonic between', () => {
    assert.equal(bezierEase(EASE_OUT, 0), 0);
    assert.equal(bezierEase(EASE_OUT, 1), 1);
    let previous = 0;
    for (let x = 0.05; x <= 1; x += 0.05) {
      const y = bezierEase(EASE_OUT, x);
      assert.ok(y >= previous, `easing went backwards at x=${x}`);
      previous = y;
    }
  });

  await t.test('ease-out front-loads its progress, which is what makes a burst read as a burst', () => {
    assert.ok(bezierEase(EASE_OUT, 0.25) > 0.25, 'ease-out is ahead of linear early on');
  });

  await t.test('a keyframe track eases between each adjacent pair, not once across the whole animation', () => {
    // The CSS this mirrors is 0% -> 30% -> 100%, so the peak lands at 0.3 and
    // the value comes back down after it, rather than interpolating straight
    // from the first stop to the last.
    const stops = [[0, 1], [0.3, 2.2], [1, 1]];
    assert.equal(track(stops, EASE_OUT, 0), 1);
    assert.equal(track(stops, EASE_OUT, 0.3).toFixed(4), '2.2000');
    assert.equal(track(stops, EASE_OUT, 1), 1);
    assert.ok(track(stops, EASE_OUT, 0.15) > 1.5, 'rises toward the peak before it');
    assert.ok(track(stops, EASE_OUT, 0.6) < 2.2, 'falls away from the peak after it');
  });
});

test('mapEffects - level up', async (t) => {
  t.beforeEach(() => reset());

  await t.test('scales the hero up and back down, peaking at 2.2x 30% in', () => {
    startLevelUp(0, 1200);
    assert.equal(opOf(sampleAt(0), 'glyph').scale, 1);
    assert.equal(opOf(sampleAt(360), 'glyph').scale.toFixed(4), '2.2000');
    assert.ok(opOf(sampleAt(1199), 'glyph').scale < 1.1, 'settles back to its normal size');
  });

  await t.test('draws the hero itself, so the plain hero glyph must be suppressed', () => {
    startLevelUp(0, 1200);
    const result = sampleAt(300);
    assert.equal(result.suppressHeroGlyph, true, 'otherwise the hero draws twice, once unscaled');
    const glyph = opOf(result, 'glyph');
    assert.equal(glyph.emoji, HERO);
    assert.equal(glyph.sizePx, HERO_SIZE);
    assert.equal(glyph.isPlayer, true);
  });

  await t.test('rays burst outward, rotate, and fade - emitted before the hero so they sit behind', () => {
    startLevelUp(0, 1200);
    const early = sampleAt(60);
    const late = sampleAt(1100);
    assert.ok(early.ops.findIndex((op) => op.op === 'rays') < early.ops.findIndex((op) => op.op === 'glyph'));
    assert.ok(opOf(late, 'rays').radiusTiles > opOf(early, 'rays').radiusTiles, 'rays expand');
    assert.ok(opOf(late, 'rays').rotateDeg > opOf(early, 'rays').rotateDeg, 'rays rotate');
    assert.equal(opOf(sampleAt(0), 'rays').alpha, 0, 'starts invisible');
    assert.ok(opOf(sampleAt(1199), 'rays').alpha < 0.05, 'ends invisible');
  });

  await t.test('stops producing ops once its duration is up', () => {
    startLevelUp(0, 1200);
    assert.equal(hasActiveEffect(1199), true);
    assert.equal(hasActiveEffect(1200), false);
    assert.deepEqual(sampleAt(1200).ops, []);
  });
});

test('mapEffects - well heal', async (t) => {
  t.beforeEach(() => reset());

  await t.test('the ring collapses inward onto the player, thickening as it lands', () => {
    startWellHeal(0, 1100);
    const start = opOf(sampleAt(0), 'ring');
    const end = opOf(sampleAt(1099), 'ring');
    assert.ok(start.radiusPx > end.radiusPx * 10, 'starts far out and collapses in');
    assert.ok(end.lineWidthPx > 0);
    assert.equal(start.alpha, 0.9);
    assert.ok(end.alpha < 0.1, 'fades out right as it lands');
  });

  await t.test('the glow is delayed 750ms and runs on its own clock, not as a later ring keyframe', () => {
    startWellHeal(0, 1100);
    assert.equal(opOf(sampleAt(700), 'glow'), undefined, 'nothing before the delay');
    const glow = opOf(sampleAt(800), 'glow');
    assert.ok(glow, 'appears once the delay has passed');
    assert.ok(glow.radiusTiles > 0);
    assert.ok(opOf(sampleAt(1050), 'glow').radiusTiles > glow.radiusTiles, 'blooms outward');
  });

  await t.test('does not touch the hero glyph - the effect arrives on the character, it is not the character', () => {
    startWellHeal(0, 1100);
    assert.equal(sampleAt(500).suppressHeroGlyph, false);
  });
});

test('mapEffects - portal pull', async (t) => {
  t.beforeEach(() => reset());

  await t.test('spins the hero down to nothing while brightening, and suppresses the plain glyph', () => {
    startPortalPull(0, 420);
    const start = sampleAt(0);
    const end = sampleAt(419);
    assert.equal(start.suppressHeroGlyph, true);
    assert.equal(opOf(start, 'glyph').scale, 1);
    assert.ok(opOf(end, 'glyph').scale < 0.25, 'shrinks toward the portal');
    assert.ok(opOf(end, 'glyph').rotateDeg > 30, 'rotates as it goes');
    assert.ok(opOf(end, 'glyph').alpha < 0.1, 'fades out');
    assert.ok(opOf(end, 'glyph').brightness > 2, 'brightens, matching the CSS filter it replaces');
  });
});

test('mapEffects - general', async (t) => {
  t.beforeEach(() => reset());

  await t.test('produces nothing when the player is off screen', () => {
    startLevelUp(0, 1200);
    assert.deepEqual(sampleEffects(300, null, HERO, HERO_SIZE).ops, []);
  });

  await t.test('effects stack, and every op is anchored to the player tile', () => {
    startLevelUp(0, 1200);
    startWellHeal(0, 1100);
    const result = sampleAt(900);
    assert.ok(result.ops.length >= 3, 'expected the level-up and well-heal ops together');
    for (const op of result.ops) {
      assert.equal(op.gx, TILE.gx);
      assert.equal(op.gy, TILE.gy);
    }
  });

  await t.test('reset clears everything, so a remount never inherits a half-finished effect', () => {
    startLevelUp(0, 1200);
    reset();
    assert.equal(hasActiveEffect(100), false);
    assert.deepEqual(sampleAt(100).ops, []);
  });
});
