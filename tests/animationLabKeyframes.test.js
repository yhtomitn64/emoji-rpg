import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveXY, buildTransform, buildWaapiKeyframes } from '../tools/animation-lab/keyframes.js';

test('resolveXY', async (t) => {
  await t.test('resolves a plain offset with no dx/dy contribution', () => {
    assert.deepEqual(resolveXY({ x: 10, y: -5 }, 999, 999), { x: 10, y: -5 });
  });

  await t.test('adds dx/dy scaled by dxFactor/dyFactor, matching the dx * 0.15 + 40 pattern already used in battleScreen.js', () => {
    assert.deepEqual(resolveXY({ x: 40, y: -50, dxFactor: 0.15, dyFactor: 0.15 }, 100, 200), { x: 55, y: -20 });
  });
});

test('buildTransform', async (t) => {
  await t.test('free mode matches today\'s exact translate-then-rotate-then-scale composition', () => {
    const kf = { x: 10, y: 20, rotate: 45, scale: 1 };
    const result = buildTransform(false, { x: 0, y: 0 }, kf, 0, 0);
    assert.equal(result, 'translate(-50%, -50%) translate(10px, 20px) rotate(45deg) scale(1)');
  });

  await t.test('pinned mode rotates around the fixed anchor, riding an arm out to the keyframe position', () => {
    const anchor = { x: 5, y: 5 };
    const kf = { x: 25, y: 5, rotate: 90, scale: 1 };
    const result = buildTransform(true, anchor, kf, 0, 0);
    // arm = kf - anchor = (20, 0)
    assert.equal(result, 'translate(-50%, -50%) translate(5px, 5px) rotate(90deg) translate(20px, 0px) scale(1)');
  });

  await t.test('pinned mode anchor itself can track dx/dy via dxFactor/dyFactor', () => {
    const anchor = { x: 0, y: 0, dxFactor: 0.2, dyFactor: 0 };
    const kf = { x: 0, y: 0, rotate: 0, scale: 2 };
    const result = buildTransform(true, anchor, kf, 100, 0);
    // anchor resolves to (20, 0); arm = (0,0) - (20,0) = (-20, 0)
    assert.equal(result, 'translate(-50%, -50%) translate(20px, 0px) rotate(0deg) translate(-20px, 0px) scale(2)');
  });
});

test('buildWaapiKeyframes', async (t) => {
  await t.test('maps every design keyframe through buildTransform, carrying offset through unchanged', () => {
    const design = {
      pinned: false,
      anchor: { x: 0, y: 0 },
      keyframes: [
        { offset: 0, x: 0, y: 0, rotate: 0, scale: 1 },
        { offset: 1, x: 10, y: 10, rotate: 90, scale: 1.5 },
      ],
    };
    const result = buildWaapiKeyframes(design, 50, 50);
    assert.equal(result.length, 2);
    assert.equal(result[0].offset, 0);
    assert.equal(result[1].offset, 1);
    assert.equal(result[1].transform, 'translate(-50%, -50%) translate(10px, 10px) rotate(90deg) scale(1.5)');
  });
});
