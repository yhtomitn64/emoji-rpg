// Tests for held-key continuous movement (js/screens/mapScreen.js's
// WALK_REPEAT_INTERVAL_MS / walkTick).
//
// Raised by Timothy 2026-09-10: "if you hold down up/left/right/down it's
// kind of janky and not smooth... if you hold down character should walk
// fast just smoothly." Holding a direction used to be driven entirely by the
// browser's own keyboard auto-repeat, which waits ~half a second before it
// starts and then fires at whatever rate that machine is configured for - so
// a held key gave one step, a pause, then a machine-dependent burst, and
// travel speed was never the same for two players. A fixed cadence owned by
// mapScreen replaces it, and `event.repeat` keydowns are ignored outright.
//
// These use real timers rather than mocked ones on purpose: the thing under
// test IS the timing behavior, and mapScreen's interval is real. Waits are
// kept short and assertions are ranges, not exact step counts, so ordinary
// scheduler jitter can't make them flaky.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, keydown, keyup } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';

// Open ground, big enough that several steps in any direction stay in bounds.
const PLAINS = {
  id: 'plains',
  legend: { '.': 'grass' },
  rows: Array.from({ length: 11 }, () => '.'.repeat(21)),
  neighbors: {},
  monsterTable: [],
  encounterChance: 0,
  cacheChance: 0,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The cadence these tests run the walk at, deliberately far below the game's
// own 110ms (WALK_REPEAT_INTERVAL_MS in mapScreen.js). Every wait below is
// expressed as a multiple of it, so the intent survives a change to either
// number. What's under test is that the walk repeats, alternates and stops -
// not the exact speed - and Node runs test files in parallel, so seconds spent
// genuinely asleep here are enough to starve other timing-sensitive suites
// (caught making an unrelated battle test flake). mount() takes the cadence as
// a prop for exactly this reason.
//
// Kept comfortably above one animation frame: steps are paced by accumulated
// frame time now (see the walkFrame comment in mapScreen.js), and jsdom's own
// frames land around 16ms, so a cadence near that would quantise unevenly and
// make the step counts below jittery for reasons that have nothing to do with
// the behavior under test.
const INTERVAL_MS = 50;

async function mountPlains() {
  const { mount } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  const maps = { plains: PLAINS };
  const state = { ...createNewGame(), map: 'plains', position: { x: 10, y: 5 } };
  const moves = [];
  mount(root, {
    renderer: 'dom',
    walkRepeatMs: INTERVAL_MS,
    state,
    mapConfig: PLAINS,
    maps,
    worldGrid: buildWorldGrid(maps),
    callbacks: {
      onFirstVisit: () => {},
      onMove: (position) => moves.push({ ...position }),
      onAction: () => {},
      onEncounter: () => {},
      onWornPathHint: () => {},
      onCacheFound: () => {},
      onEnterMiniDungeon: () => {},
      onLockedGate: () => {},
      onToolGateCleared: () => {},
      onToolGateNearby: () => {},
      onGateReward: () => {},
    },
  });
  return { state, moves };
}

test('mapWalk - tapping a direction', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('steps exactly once, immediately, and never again after release', async () => {
    const { moves } = await mountPlains();
    keydown('ArrowRight');
    assert.equal(moves.length, 1, 'a tap must step in the same tick, not wait out an interval first');
    keyup('ArrowRight');
    await wait(INTERVAL_MS * 4);
    assert.equal(moves.length, 1, 'a released key must not keep walking');
  });
});

test('mapWalk - holding a direction', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('keeps stepping on a steady cadence for as long as it is held', async () => {
    const { moves } = await mountPlains();
    keydown('ArrowRight');
    await wait(INTERVAL_MS * 4);
    keyup('ArrowRight');
    // The immediate step plus roughly one per interval. Generous bounds: the
    // point is that it repeats at all and doesn't run away, not the exact count.
    assert.ok(moves.length >= 3, `expected repeated steps while held, got ${moves.length}`);
    assert.ok(moves.length <= 7, `expected a bounded cadence, got ${moves.length}`);
  });

  await t.test('the browser own auto-repeat keydowns are ignored, so cadence stays ours', async () => {
    const { moves } = await mountPlains();
    keydown('ArrowRight');
    // What a real browser delivers while a key is held. Each of these used to
    // step directly, which is what made travel speed an OS setting.
    for (let i = 0; i < 20; i++) keydown('ArrowRight', { repeat: true });
    keyup('ArrowRight');
    assert.equal(moves.length, 1, '20 auto-repeat events must not produce 20 steps');
  });

  await t.test('releasing stops the walk', async () => {
    const { moves } = await mountPlains();
    keydown('ArrowRight');
    await wait(INTERVAL_MS * 2.5);
    keyup('ArrowRight');
    const afterRelease = moves.length;
    assert.ok(afterRelease >= 2, 'sanity check: expected it to have been walking');
    await wait(INTERVAL_MS * 4);
    assert.equal(moves.length, afterRelease, 'no further steps once released');
  });
});

// Raised by Timothy 2026-09-10: "I don't even care if the character can travel
// diagonally, I actually like that they have to go up and then right... I just
// want to be able to hold both keys to make the game do that." So two
// perpendicular directions alternate rather than one winning - every step
// stays a single cardinal move, which is what lets the worn-path trail record
// a staircase as an ordinary connected route with no new geometry at all.
test('mapWalk - two directions held at once', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('alternates between them, walking a staircase on both axes at once', async () => {
    const { state } = await mountPlains();
    const startX = state.position.x;
    const startY = state.position.y;

    keydown('ArrowRight');
    keydown('ArrowUp');
    await wait(INTERVAL_MS * 6);
    keyup('ArrowRight');
    keyup('ArrowUp');

    const movedX = state.position.x - startX;
    const movedY = startY - state.position.y;
    assert.ok(movedX > 0, `expected horizontal progress, moved ${movedX}`);
    assert.ok(movedY > 0, `expected vertical progress, moved ${movedY}`);
    // Alternating means neither axis runs away from the other.
    assert.ok(Math.abs(movedX - movedY) <= 1, `expected an even staircase, got ${movedX} across and ${movedY} up`);
  });

  await t.test('every step is still a single cardinal move, never a diagonal one', async () => {
    const { moves } = await mountPlains();
    keydown('ArrowRight');
    keydown('ArrowUp');
    await wait(INTERVAL_MS * 6);
    keyup('ArrowRight');
    keyup('ArrowUp');

    for (let i = 1; i < moves.length; i++) {
      const dx = Math.abs(moves[i].x - moves[i - 1].x);
      const dy = Math.abs(moves[i].y - moves[i - 1].y);
      assert.equal(dx + dy, 1, `step ${i} moved (${dx}, ${dy}) - every step must stay cardinal so the trail can record the edge it crossed`);
    }
  });

  await t.test('releasing one falls back to the direction still held', async () => {
    const { state } = await mountPlains();
    keydown('ArrowRight');
    keydown('ArrowUp');
    await wait(INTERVAL_MS * 4);

    keyup('ArrowUp');
    const xWhenReleased = state.position.x;
    const yWhenReleased = state.position.y;
    await wait(INTERVAL_MS * 3);
    assert.ok(state.position.x > xWhenReleased, 'expected it to carry on with the direction still held');
    assert.equal(state.position.y, yWhenReleased, 'expected vertical movement to stop with Up released');
  });

  await t.test('two opposing directions do not deadlock - the newest one wins', async () => {
    const { state } = await mountPlains();
    const startX = state.position.x;
    keydown('ArrowLeft');
    keydown('ArrowRight');
    await wait(INTERVAL_MS * 4);
    keyup('ArrowLeft');
    keyup('ArrowRight');
    assert.ok(state.position.x > startX, 'expected the most recently pressed direction to win, not a standstill');
  });

  await t.test('both released stops the walk entirely', async () => {
    const { moves } = await mountPlains();
    keydown('ArrowRight');
    keydown('ArrowUp');
    await wait(INTERVAL_MS * 3);
    keyup('ArrowRight');
    keyup('ArrowUp');
    const settled = moves.length;
    await wait(INTERVAL_MS * 4);
    assert.equal(moves.length, settled, 'both released, so fully stopped');
  });
});

test('mapWalk - a held key never outlives the screen', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  // Alt-tabbing away mid-walk delivers no keyup at all, which would otherwise
  // leave the key recorded as held forever.
  await t.test('losing window focus releases everything', async () => {
    const { moves } = await mountPlains();
    keydown('ArrowRight');
    window.dispatchEvent(new window.Event('blur'));
    await wait(INTERVAL_MS * 4);
    assert.equal(moves.length, 1, 'a blurred window must not keep walking');
  });

  // An encounter can fire on a step taken while a direction is still held;
  // the battle overlay that opens on top pauses this screen, and the walk
  // must not carry on underneath it.
  await t.test('pause() stops the walk, and resume() does not restart it on its own', async () => {
    const { moves } = await mountPlains();
    const { pause, resume } = await import('../js/screens/mapScreen.js');
    keydown('ArrowRight');
    pause();
    await wait(INTERVAL_MS * 4);
    assert.equal(moves.length, 1, 'paused screen must not keep stepping');
    resume();
    await wait(INTERVAL_MS * 4);
    assert.equal(moves.length, 1, 'resuming must wait for a real keypress, not resume a stale held key');
  });

  // Steps are paced by accumulated animation-frame time, so a long gap with a
  // key still held (a hidden tab, a stalled thread) builds up a backlog. It
  // must not cash out as a burst of queued steps when frames resume - that
  // would teleport the character several tiles the moment you came back.
  await t.test('a long stall does not cash out as a burst of catch-up steps', async () => {
    const { state, moves } = await mountPlains();
    const startX = state.position.x;
    keydown('ArrowRight');
    const afterFirst = moves.length;

    // Frames stop entirely for far longer than the cadence, then resume.
    const raf = global.requestAnimationFrame;
    global.requestAnimationFrame = () => 0;
    await wait(INTERVAL_MS * 8);
    global.requestAnimationFrame = raf;
    await wait(INTERVAL_MS * 2);
    keyup('ArrowRight');

    const stepsTaken = moves.length - afterFirst;
    assert.ok(stepsTaken <= 6, `expected the backlog to be dropped, not replayed - took ${stepsTaken} steps`);
    assert.ok(state.position.x - startX <= 7, 'the character must not teleport on catching up');
  });

  await t.test('unmount() stops the walk, so a timer cannot outlive the screen', async () => {
    const { moves } = await mountPlains();
    const { unmount } = await import('../js/screens/mapScreen.js');
    keydown('ArrowRight');
    unmount();
    await wait(INTERVAL_MS * 4);
    assert.equal(moves.length, 1, 'an unmounted screen must not keep stepping');
  });
});
