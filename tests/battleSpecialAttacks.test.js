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
    // own coverage of a plain unparried hit - no press, just wait past
    // PARRY_WINDUP_DURATION_MS).
    // +400 (not +200): tick()'s own isWindupComplete poll only runs every
    // 300ms, so the actual resolution can land up to just under one full
    // tick period after PARRY_WINDUP_DURATION_MS elapses - tests/
    // battleScreenDom.test.js's own unparried-hit wait uses the same
    // "one full tick of margin" buffer for this exact reason.
    await new Promise((resolve) => setTimeout(resolve, PARRY_WINDUP_DURATION_MS + 400));
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
    // +400 (not +200): tick()'s own isWindupComplete poll only runs every
    // 300ms, so the actual resolution can land up to just under one full
    // tick period after PARRY_WINDUP_DURATION_MS elapses - tests/
    // battleScreenDom.test.js's own unparried-hit wait uses the same
    // "one full tick of margin" buffer for this exact reason.
    await new Promise((resolve) => setTimeout(resolve, PARRY_WINDUP_DURATION_MS + 400));
    // Re-query rather than reusing the earlier reference: updateMenu()
    // replaces elements.menu.innerHTML wholesale (see updateMenu's own
    // comment), so the button grabbed before the special attack resolved
    // is a detached node by now - same convention tests/battleScreenDom.
    // test.js already follows (e.g. its shared-parry-cooldown test).
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
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ speed: 1000, specialAttacks: [{ type: 'stun', chancePerTurn: 1, durationMs: 3000 }] }],
    });
    assert.equal(root.querySelector('#btn-attack').disabled, false, 'Attack should start off cooldown/unstunned');
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    await waitForWindupStart(fill);
    // +400 (not +200): tick()'s own isWindupComplete poll only runs every
    // 300ms, so the actual resolution can land up to just under one full
    // tick period after PARRY_WINDUP_DURATION_MS elapses - same buffer the
    // other unparried-hit waits in this file already use.
    await new Promise((resolve) => setTimeout(resolve, PARRY_WINDUP_DURATION_MS + 400));
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
