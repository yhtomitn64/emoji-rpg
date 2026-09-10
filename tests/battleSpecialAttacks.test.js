// Real DOM tests for monster specialAttacks (slow/stun/cooldownOverload),
// mirroring tests/battleScreenDom.test.js's exact jsdom/real-wall-clock
// pattern for parry timing - see that file's own comment for why a real
// wall-clock wait is the correct approach here (this IS the timing
// behavior under test), rather than a mocked clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT, PARRY_ZONE_END_PERCENT } from '../js/systems/parry.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), ...overrides };
}

// Copied verbatim from tests/battleScreenDom.test.js - see that file's own
// comment for why a real wall-clock wait is the correct approach here
// (this IS the timing behavior under test).
async function waitForWindupStart(fill) {
  const pollStart = Date.now();
  while (!fill.style.animation) {
    if (Date.now() - pollStart > 2000) throw new Error('windup animation never started');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return Date.now();
}

async function waitUntilZoneMidpoint(windupStart) {
  const midpointPercent = (PARRY_ZONE_START_PERCENT + PARRY_ZONE_END_PERCENT) / 2;
  const targetElapsedMs = (midpointPercent / 100) * PARRY_WINDUP_DURATION_MS;
  const remaining = windupStart + targetElapsedMs - Date.now();
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

// Raised 2026-09-07: the three unparried-hit tests below used to wait a
// fixed PARRY_WINDUP_DURATION_MS + 400 (one tick's worth of margin past
// tick()'s own 300ms isWindupComplete poll) and then check the outcome
// exactly once - fine on a fast, otherwise-idle machine, but CI runs
// every test file's own timers in the same process, and under that
// contention the actual resolution can land past the fixed margin,
// failing an assertion that was simply checked too early (seen twice in
// a row on GitHub Actions, never locally in isolation). Polling for the
// real condition instead of guessing a duration removes the race
// entirely regardless of system load - see the systematic-debugging
// skill's condition-based-waiting technique.
// timeoutMs is a FAILURE deadline, not a wait: the loop returns the moment
// the predicate holds, so a green run never spends it and a generous cap
// costs nothing. It was 5000ms, which isn't enough headroom under a loaded
// `node --test` runner (files run in parallel) - the cooldownOverload test
// below was observed timing out at 5336ms on an otherwise-passing run, and
// re-running the same file alone passed. Every predicate here is waiting on
// a 300ms tick() loop that starves under contention, so the cap has to
// clear a stalled runner by a wide margin rather than a healthy one by a
// little.
async function waitForCondition(predicate, description, timeoutMs = 20000) {
  const pollStart = Date.now();
  while (!predicate()) {
    if (Date.now() - pollStart > timeoutMs) throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

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

  await t.test('an unparried slow special applies its debuff and logs it', async () => {
    // 'boar' supplies real hp/attack/defense/speed; monsterOverrides
    // layers specialAttacks on top, same merge main.js's own
    // ngPlusOverridesList already does for real battles.
    const { root } = await mountBattle(['boar'], {
      // speed: 1000 saturates the ATB gauge on the first 300ms tick (same
      // trick tests/battleScreenDom.test.js's own parry tests use) so
      // windup starts immediately instead of waiting out boar's real
      // speed (4, ~7.5s to fill from 0).
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'slow', chancePerTurn: 1, slowPercent: 20, durationMs: 3000 }] }],
    });
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    await waitForWindupStart(fill);
    // Let the windup expire unparried (mirrors battleScreenDom.test.js's
    // own coverage of a plain unparried hit - no press, just wait for the
    // log line the resolved hit produces).
    await waitForCondition(
      () => /slows you down/.test(root.querySelector('#battle-log').textContent),
      'the slow debuff log line to appear',
    );
    assert.match(root.querySelector('#battle-log').textContent, /slows you down/);
  });

  await t.test('a successful parry against a special attack negates it, not just the damage', async () => {
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'slow', chancePerTurn: 1, slowPercent: 20, durationMs: 3000 }] }],
    });
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    const windupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(windupStart);
    const { keydown } = await import('./helpers/dom.js');
    keydown('s'); // same parry shortcut tests/battleScreenDom.test.js already uses
    const log = root.querySelector('#battle-log').textContent;
    assert.match(log, /parry .*negate it/);
    assert.doesNotMatch(log, /slows you down/);
  });

  await t.test('an unparried cooldownOverload special disables an off-cooldown ability button', async () => {
    const state = baseState();
    state.player.level = 6; // unlocks stab/chop/slash
    const { root } = await mountBattle(['boar'], {
      state,
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'cooldownOverload', chancePerTurn: 1, gcdMs: 6000 }] }],
    });
    assert.equal(root.querySelector('#btn-ability-stab').disabled, false, 'stab should start off cooldown');
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    await waitForWindupStart(fill);
    // Re-queried inside the predicate (not a reference captured before the
    // special attack resolved): updateMenu() replaces elements.menu.
    // innerHTML wholesale (see updateMenu's own comment), so a button
    // grabbed early is a detached node by the time the real one updates -
    // same convention tests/battleScreenDom.test.js already follows (e.g.
    // its shared-parry-cooldown test).
    await waitForCondition(
      () => root.querySelector('#btn-ability-stab')?.disabled === true,
      'stab to be pushed onto cooldown by the special attack',
    );
    assert.equal(root.querySelector('#btn-ability-stab').disabled, true, 'stab should be pushed onto cooldown by the special attack');
  });

  // Raised in the superboss final-review pass: playerStunDebuff already
  // blocked playerAttack/playerUseAbility (js/screens/battleScreen.js's own
  // guards), but the Attack/ability buttons rendered fully clickable while
  // stunned, giving zero visual feedback for a silent no-op press. Mirrors
  // the cooldownOverload test above closely - same mount/wait shape, a
  // different special-attack type and a real click attempted mid-debuff.
  await t.test('an unparried stun special creates a live debuff that blocks a subsequent Attack press and renders Attack disabled', async () => {
    const { click } = await import('./helpers/dom.js');
    // durationMs is deliberately much longer than this test needs, and
    // deliberately longer than waitForCondition's own timeout above:
    // nothing here asserts the stun *expires* - only that it lands,
    // disables Attack, and no-ops a press while live - so the window has
    // to outlast the worst case wait, or the same race just moves.
    //
    // At 3000ms it didn't. This test waits on a log line (a proxy) and then
    // asserts LIVE button state four statements later, so under a loaded
    // `node --test` runner the 300ms tick() can expire the debuff in
    // between; updateMenu() re-enables Attack and assertion (c) fails with
    // "Attack should render disabled while playerStunDebuff is live". That
    // is the shape that made it fragile - the two `slow` tests above only
    // assert append-only log text, and the cooldownOverload test waits on
    // its own assertion, so neither is exposed the same way.
    //
    // Failed on CI on two consecutive runs (blocking the 0.30.0/0.31.0
    // deploys) while passing locally, and was separately seen twice in ~7
    // full-suite runs by a concurrent session, never in isolation.
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'stun', chancePerTurn: 1, durationMs: 30000 }] }],
    });
    assert.equal(root.querySelector('#btn-attack').disabled, false, 'Attack should start off cooldown/unstunned');
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    await waitForWindupStart(fill);
    await waitForCondition(
      () => /leaves you reeling/.test(root.querySelector('#battle-log').textContent),
      'the stun debuff log line to appear',
    );
    // (a) the debuff actually landed.
    assert.match(root.querySelector('#battle-log').textContent, /leaves you reeling/);
    // (c) the button renders disabled while stunned - re-queried, not the
    // reference from above, since updateMenu() replaced it wholesale.
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
