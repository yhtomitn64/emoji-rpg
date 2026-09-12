// Tests for the static/dynamic split behind the map's cached layer
// (js/systems/mapDrawList.js's buildLayeredDrawList / buildDynamicOps).
//
// These exist because of a real bug that shipped past the whole suite and was
// caught by Timothy looking at the screen, 2026-09-10. The first version of
// the cache kept a 3x3 block around the player OUT of the cached layer and
// repainted it live every frame. Repainting a cell repaints its ground - and
// that ground erased anything overhanging INTO the block from outside it.
// Two symptoms, one cause:
//
//   - "when I'm above a tree then a tall tree below that one gets cut off"
//     (obstacles are bottom-anchored and bleed upward into the row above);
//   - "the shop sign goes away when I'm in its 3x3 square", and the quest
//     board's plank vanished from exactly three tiles north of it (a sign
//     label draws ENTIRELY in the row above its own tile - see drawLabel).
//
// The invariant that was missing, and is asserted here: an ordinary cell may
// never appear in the live layer. Enlarging the live block would only have
// moved the seam outward - a sub-rectangle of an interleaved-paint-order
// scene cannot be redrawn over a cached whole without losing the overhang
// from outside it. So the live layer is now only what genuinely differs
// frame to frame: the hero (already held back by paint()), and cells whose
// own content animates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { townMap } from '../js/maps/townMap.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';
import { buildLayeredDrawList, buildDynamicOps, isDynamicCell } from '../js/systems/mapDrawList.js';

async function mountAndContext(mapConfig, maps, state) {
  const { mount, __getRenderContextForTest } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  mount(root, {
    renderer: 'canvas',
    state,
    mapConfig,
    maps,
    worldGrid: buildWorldGrid(maps),
    callbacks: { onFirstVisit: () => {}, onMove: () => {}, onAction: () => {}, onWornPathHint: () => {} },
  });
  return __getRenderContextForTest();
}

function opKey(op) {
  return `${op.op}@${op.gx},${op.gy}:${op.emoji ?? op.color ?? op.text ?? ''}`;
}

test('the cached layer keeps every ordinary cell', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('the live layer holds nothing but hero ops and animated cells', async () => {
    const maps = { town: townMap };
    const state = { ...createNewGame(), position: { ...townMap.startPosition } };
    const ctx = await mountAndContext(townMap, maps, state);
    const { dynamicOps } = buildLayeredDrawList(ctx);

    for (const op of dynamicOps) {
      if (op.followsHero) continue;
      const signature = ctx.signatureAt(op.gx, op.gy);
      assert.ok(
        isDynamicCell(signature),
        `${opKey(op)} is in the live layer but its cell does not animate - `
        + 'repainting it will erase anything overhanging into it from the cache',
      );
    }
  });

  await t.test("the player's own cell contributes only hero ops to the live layer", async () => {
    // The exact shape of the bug: the player's ground and trail must stay
    // cached. The hero is drawn from a followsHero op in a final pass, so the
    // cell never needed to be live in the first place.
    const maps = { town: townMap };
    const state = { ...createNewGame(), position: { ...townMap.startPosition } };
    const ctx = await mountAndContext(townMap, maps, state);
    const { ops } = buildDynamicOps(ctx, []);

    assert.ok(ops.length > 0, 'sanity: the hero has to be drawn from somewhere');
    for (const op of ops) {
      assert.ok(op.followsHero, `${opKey(op)} would repaint over the cached layer`);
    }
    assert.ok(
      ops.some((op) => op.isPlayer),
      'sanity: one of those ops should actually be the hero',
    );
  });

  await t.test('a signpost and its label both stay in the cached layer', async () => {
    // Town has real signposts. The label is the op that made the bug visible,
    // because it draws wholly in the row ABOVE its own tile, so it is the
    // first thing a live neighbour would erase.
    const maps = { town: townMap };
    const state = { ...createNewGame(), position: { ...townMap.startPosition } };
    const ctx = await mountAndContext(townMap, maps, state);
    const { staticOps, dynamicOps } = buildLayeredDrawList(ctx);

    const labels = staticOps.filter((op) => op.op === 'label');
    assert.ok(labels.length > 0, 'sanity: town should have at least one signpost label');
    assert.equal(
      dynamicOps.filter((op) => op.op === 'label').length, 0,
      'a label must never be in the live layer',
    );
  });

  await t.test('splitting loses nothing - every op still lands in exactly one layer', async () => {
    const maps = { town: townMap };
    const state = { ...createNewGame(), position: { ...townMap.startPosition } };
    const ctx = await mountAndContext(townMap, maps, state);
    const whole = buildLayeredDrawList(ctx, { splitDynamic: false });
    const split = buildLayeredDrawList(ctx);

    assert.equal(whole.dynamicOps.length, 0, 'splitDynamic:false must put everything in one layer');
    assert.equal(
      split.staticOps.length + split.dynamicOps.length,
      whole.staticOps.length,
      'the split must partition the same ops, not drop or duplicate any',
    );
    assert.deepEqual(
      [...split.staticOps, ...split.dynamicOps].map(opKey).sort(),
      whole.staticOps.map(opKey).sort(),
      'the two layers together must be exactly the unsplit list',
    );
  });
});

// Both painting paths, driven through the real frame loop.
//
// This exists because of a bug that reached Timothy: the ?staticCache=off
// branch referenced two variables in their temporal dead zone, so frame()
// threw on every single frame and the map rendered solid black. Nothing in
// the suite ran frame() with that flag set - the flag was read straight off
// `location`, which no test can set - so nothing could have caught it. The
// flag now arrives on the render context instead, which is what makes this
// test possible at all.
//
// The assertion is deliberately coarse: not "the pixels match" (jsdom has no
// canvas) but "this path paints something and does not throw". That is the
// failure that actually happened.
test('both painting paths run without throwing and paint something', async (t) => {
  const FIELD_WIDE = 60;
  const FIELD_TALL = 40;
  const fieldMap = {
    id: 'field',
    legend: { '.': 'grass' },
    rows: Array.from({ length: FIELD_TALL }, () => '.'.repeat(FIELD_WIDE)),
    startPosition: { x: 20, y: 20 },
    encounterChance: 0, cacheChance: 0, miniDungeonChance: 0,
    monsterTable: [], neighbors: {},
  };

  // A recording stub - jsdom's getContext('2d') returns null, which would make
  // the renderer no-op out of frame() before reaching anything worth testing.
  function install() {
    const calls = { count: 0 };
    const noop = () => { calls.count += 1; };
    const ctx = new Proxy({}, {
      get(target, prop) {
        if (prop === 'canvas') return { width: 1008, height: 624 };
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => { calls.count += 1; return { addColorStop: () => {} }; };
        }
        if (prop in target) return target[prop];
        return noop;
      },
      set(target, prop, value) { target[prop] = value; return true; },
    });
    window.HTMLCanvasElement.prototype.getContext = () => ctx;
    return calls;
  }

  // A real animation-frame QUEUE, not one slot: mapScreen's walk loop and the
  // renderer's draw loop both hold a registration at once, and a single-
  // callback stub silently drops one of them.
  function manualFrames() {
    let pending = new Map();
    let nextId = 1;
    global.requestAnimationFrame = (cb) => { const h = nextId++; pending.set(h, cb); return h; };
    global.cancelAnimationFrame = (h) => { pending.delete(h); };
    window.requestAnimationFrame = global.requestAnimationFrame;
    window.cancelAnimationFrame = global.cancelAnimationFrame;
    return (now) => {
      const due = pending;
      pending = new Map();
      for (const cb of due.values()) cb(now);
    };
  }

  for (const staticCache of [true, false]) {
    await t.test(`staticCache: ${staticCache}`, async () => {
      setupDom();
      const calls = install();
      const tick = manualFrames();
      const { mount, unmount } = await import('../js/screens/mapScreen.js');
      const maps = { field: fieldMap };
      const state = { ...createNewGame(), position: { ...fieldMap.startPosition } };
      mount(createRoot(), {
        renderer: 'canvas', staticCache, state, mapConfig: fieldMap, maps,
        worldGrid: buildWorldGrid(maps),
        debugNoEncounters: true,
        callbacks: { onFirstVisit: () => {}, onMove: () => {}, onAction: () => {}, onWornPathHint: () => {} },
      });

      let now = 0;
      tick((now += 16.7));
      const afterFirstFrame = calls.count;

      // Walk far enough to cross whatever the cache does at its edges.
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      for (let i = 0; i < 240; i += 1) tick((now += 16.7));
      window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));

      assert.ok(
        afterFirstFrame > 0,
        `staticCache=${staticCache} painted nothing on its first frame - `
        + 'a throw inside frame() looks exactly like this, and renders black',
      );
      assert.ok(
        calls.count > afterFirstFrame,
        `staticCache=${staticCache} stopped painting partway through the walk`,
      );
      assert.ok(state.position.x > fieldMap.startPosition.x, 'sanity: the character should have walked');

      unmount();
      teardownDom();
    });
  }
});
