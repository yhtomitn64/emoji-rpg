// DOM tests for monster specialAttacks (slow/stun/cooldownOverload).
//
// Driven by node:test's built-in mock.timers instead of real wall-clock
// waits - raised 2026-09-10 (docs/superpowers/BACKLOG.md, "battleSpecial
// Attacks.test.js flakes under parallel load") after the cooldownOverload
// test below timed out under CI's parallel `node --test` load (every other
// file's own real timers starve this one's 300ms setInterval), and again
// on 2026-09-12 after a prior fix (5000ms -> 20000ms polling deadline,
// 8e74e53) only bought margin rather than removing the race. Enabling
// `t.mock.timers` for `setInterval`/`setTimeout`/`Date` per subtest means
// js/screens/battleScreen.js's tick() (a real `setInterval(tick, 300)`, see
// its own file) fires only when this file explicitly advances the fake
// clock - no real waiting, no dependency on the CI runner's own CPU being
// free when the real timer would have fired. `battleScreen.js` itself is
// unchanged; every relevant read (`Date.now()` in js/systems/parry.js's
// isWindupComplete/windupElapsedPercent, tick()'s own `Date.now()` calls)
// already respects whatever the ambient Date is, which is exactly what
// mock.timers patches.
//
// tests/battleScreenDom.test.js has its own, separate copies of the old
// real-wall-clock helpers this file used to share a pattern with - it is
// deliberately untouched here; converting it is a bigger, separate piece of
// work (many more timing-sensitive tests) that hasn't been asked for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT, PARRY_ZONE_END_PERCENT } from '../js/systems/parry.js';

// Every fixture below overrides monster speed to 1000, so a single batched
// tick() advance (see WINDUP_RESOLVES_AT_MS) can drive the monster through
// more than one real attack. A high player HP isn't a magic number, it's a
// deliberate safety margin: found live while stress-testing this file's own
// mock-timer conversion, a monster crit that happened to land for exactly
// the player's starting 20 HP ended the battle (loss) right as the special-
// attack effect resolved, and the post-loss teardown left the ability
// button re-queried as its default (non-disabled) state - a real, pre-
// existing hazard from ordinary damage-roll randomness, not a mock-timer
// bug, just newly exposed because these tests now reliably reach a second
// or third monster turn instead of racing a poll that used to often return
// before one came around. These tests are about whether a special-attack
// effect lands, not about survival odds, so removing "can the player die
// mid-test" entirely is the right fix, not a lucky HP/damage tuning.
function baseState(overrides = {}) {
  const state = createNewGame();
  state.player.hp = 9999;
  state.player.maxHp = 9999;
  return { ...state, ...overrides };
}

// battleScreen.js's own setInterval(tick, 300) - the cadence every fake-
// clock advance below is expressed in terms of.
const TICK_MS = 300;

// Every fixture below overrides monster speed to 1000, which saturates the
// ATB gauge on the very first tick (tickGauge scales by speed) - so the
// windup always starts at fake time TICK_MS, deterministically, with no
// need to poll for it.
const WINDUP_STARTS_AT_MS = TICK_MS;

// The fake-clock instant (relative to mount) at which the windup started at
// WINDUP_STARTS_AT_MS is guaranteed *complete*: the first tick() whose real
// elapsed time (now - windup.startedAt) reaches PARRY_WINDUP_DURATION_MS.
// Ticks land on multiples of TICK_MS, so this rounds the completion instant
// up to the next tick boundary after WINDUP_STARTS_AT_MS + duration.
const WINDUP_RESOLVES_AT_MS = WINDUP_STARTS_AT_MS
  + Math.ceil(PARRY_WINDUP_DURATION_MS / TICK_MS) * TICK_MS;

// A real node:test mock.timers quirk, confirmed by direct experiment while
// building this file: `t.mock.timers.tick(delta)` advances the fake clock to
// its FINAL value before running any of the timer callbacks that fall due
// within that span - every callback in one tick() call sees the same,
// already-fully-advanced Date.now(), not the incrementally-correct value at
// its own nominal firing time. That's invisible for a callback that ignores
// "now" (a plain counter), but js/screens/battleScreen.js's tick() reads
// Date.now() to both *stamp* a windup's startedAt (when it begins) and
// *measure against* it (to decide when it's complete) - stamping and
// measuring in the same batched tick() call corrupts the measurement: the
// windup appears to start and complete at the identical instant, so it
// never resolves. A single `tick(WINDUP_RESOLVES_AT_MS)` from mount
// reproduces exactly this: the windup starts already stamped with the
// batch's own end time, so it never looks complete. The fix is always at
// least two separate tick() calls - one that stops exactly at
// WINDUP_STARTS_AT_MS (so startedAt is stamped correctly, in its own
// batch), and a later one for the remaining duration (so the completion
// check reads a genuinely later Date.now() against that correct
// startedAt). Every test below follows that shape - never collapse it back
// into one tick() call spanning both the start and the resolution.

async function mountBattle(monsterIds, { state = baseState(), callbacks = {}, monsterOverrides } = {}) {
  const { mount } = await import('../js/screens/battleScreen.js');
  const root = createRoot();
  const battleEnds = [];
  mount(root, {
    state,
    monsterIds,
    monsterOverrides,
    callbacks: { onBattleEnd: (...args) => battleEnds.push(args), ...callbacks },
  });
  return { root, state, battleEnds };
}

test('battle special attacks', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/battleScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('an unparried slow special applies its debuff and logs it', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
    // 'boar' supplies real hp/attack/defense/speed; monsterOverrides
    // layers specialAttacks on top, same merge main.js's own
    // ngPlusOverridesList already does for real battles.
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'slow', chancePerTurn: 1, slowPercent: 20, durationMs: 3000 }] }],
    });
    // Two separate tick() calls, not one covering the whole span - see the
    // WINDUP_RESOLVES_AT_MS comment above for why that matters here.
    t.mock.timers.tick(WINDUP_STARTS_AT_MS);
    t.mock.timers.tick(WINDUP_RESOLVES_AT_MS - WINDUP_STARTS_AT_MS);
    assert.match(root.querySelector('#battle-log').textContent, /slows you down/);
  });

  await t.test('a successful parry against a special attack negates it, not just the damage', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'slow', chancePerTurn: 1, slowPercent: 20, durationMs: 3000 }] }],
    });
    const midpointPercent = (PARRY_ZONE_START_PERCENT + PARRY_ZONE_END_PERCENT) / 2;
    const targetElapsedMs = (midpointPercent / 100) * PARRY_WINDUP_DURATION_MS;
    // Two separate tick() calls, not one covering the whole span - see the
    // WINDUP_RESOLVES_AT_MS comment above. The first stamps windup.startedAt
    // at exactly WINDUP_STARTS_AT_MS, in its own batch; the second just
    // advances Date.now() further (no new windup starts in it, so the
    // ordering hazard doesn't apply) to land exactly at the zone midpoint.
    // attemptParryOnMonster (js/screens/battleScreen.js) then reads
    // windupElapsedPercent off that live Date.now() at keypress time, not
    // off tick()'s own cadence, so this doesn't need to land on a tick
    // boundary the way WINDUP_RESOLVES_AT_MS does.
    t.mock.timers.tick(WINDUP_STARTS_AT_MS);
    t.mock.timers.tick(targetElapsedMs);
    const { keydown } = await import('./helpers/dom.js');
    keydown('s'); // same parry shortcut tests/battleScreenDom.test.js already uses
    const log = root.querySelector('#battle-log').textContent;
    assert.match(log, /parry .*negate it/);
    assert.doesNotMatch(log, /slows you down/);
  });

  await t.test('an unparried cooldownOverload special disables an off-cooldown ability button', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
    const state = baseState();
    state.player.level = 6; // unlocks stab/chop/slash
    const { root } = await mountBattle(['boar'], {
      state,
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'cooldownOverload', chancePerTurn: 1, gcdMs: 6000 }] }],
    });
    assert.equal(root.querySelector('#btn-ability-stab').disabled, false, 'stab should start off cooldown');
    t.mock.timers.tick(WINDUP_STARTS_AT_MS);
    // Sanity check that the windup actually engaged, not just that time
    // passed - set synchronously by tick() the instant the windup starts
    // (js/screens/battleScreen.js), so no poll is needed for it either.
    assert.ok(root.querySelector('#battle-monster-atb-fill-0').style.animation, 'expected the windup fill animation to have started');
    t.mock.timers.tick(WINDUP_RESOLVES_AT_MS - WINDUP_STARTS_AT_MS);
    // Re-queried (not the reference from above): updateMenu() replaces
    // elements.menu.innerHTML wholesale (see updateMenu's own comment), so
    // a button grabbed earlier is a detached node by the time the real one
    // updates - same convention tests/battleScreenDom.test.js follows.
    assert.equal(root.querySelector('#btn-ability-stab').disabled, true, 'stab should be pushed onto cooldown by the special attack');
  });

  // Raised in the superboss final-review pass: playerStunDebuff already
  // blocked playerAttack/playerUseAbility (js/screens/battleScreen.js's own
  // guards), but the Attack/ability buttons rendered fully clickable while
  // stunned, giving zero visual feedback for a silent no-op press. Mirrors
  // the cooldownOverload test above closely - same mount/advance shape, a
  // different special-attack type and a real click attempted mid-debuff.
  await t.test('an unparried stun special creates a live debuff that blocks a subsequent Attack press and renders Attack disabled', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
    const { click } = await import('./helpers/dom.js');
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'stun', chancePerTurn: 1, durationMs: 3000 }] }],
    });
    assert.equal(root.querySelector('#btn-attack').disabled, false, 'Attack should start off cooldown/unstunned');
    // Two separate tick() calls, not one covering the whole span - see the
    // WINDUP_RESOLVES_AT_MS comment above for why that matters here.
    t.mock.timers.tick(WINDUP_STARTS_AT_MS);
    t.mock.timers.tick(WINDUP_RESOLVES_AT_MS - WINDUP_STARTS_AT_MS);
    // (a) the debuff actually landed.
    assert.match(root.querySelector('#battle-log').textContent, /leaves you reeling/);
    // (c) the button renders disabled while stunned - deterministic now
    // (the fake clock only ever advances when this test tells it to), so
    // durationMs no longer needs the inflated margin the old real-wall-
    // clock version of this test relied on to outlast the worst-case wait.
    assert.equal(root.querySelector('#btn-attack').disabled, true, 'Attack should render disabled while playerStunDebuff is live');
    // (b) a press attempted during the stun window is a real no-op: no new
    // "You hit" log line, and the monster's own HP text is unchanged.
    const hpBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    const logBefore = root.querySelector('#battle-log').textContent;
    click(root.querySelector('#btn-attack'));
    assert.equal(root.querySelector('#battle-monster-hp-text-0').textContent, hpBefore, 'a stunned Attack press must not damage the monster');
    assert.equal(root.querySelector('#battle-log').textContent, logBefore, 'a stunned Attack press must not add a new log line');
  });
});
