// Real DOM tests for js/screens/battleScreen.js, using jsdom (see
// tests/helpers/dom.js). This is the first screen module to get this kind
// of coverage - see docs/superpowers/BACKLOG_SHIPPED.md's "Testing infra"
// entry for why (a parry-timing race that only ever showed up live, plus
// the token/time cost of verifying screen changes via a real browser).
//
// Scope: DOM structure and event wiring (does clicking this button call the
// right function with the right args, does the right element exist/update),
// not pixel-level rendering/CSS - jsdom's layout engine is a no-op, so an
// occasional live-browser look is still the right tool for that class of bug.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), ...overrides };
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

test('battleScreen DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/battleScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('mount renders Attack/Item/Flee and hides abilities below level 2', async () => {
    const { root, state } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 1 } }) });
    assert.ok(root.querySelector('#btn-attack'));
    assert.ok(root.querySelector('#btn-item'));
    assert.ok(root.querySelector('#btn-flee'));
    assert.equal(root.querySelector('#btn-ability-stab'), null);
    assert.equal(state.player.level, 1);
  });

  await t.test('mount renders unlocked ability buttons once level requirement is met', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 2 } }) });
    assert.ok(root.querySelector('#btn-ability-stab'));
    assert.equal(root.querySelector('#btn-ability-chop'), null); // unlocks at 4
  });

  await t.test('clicking Attack deals damage to the target monster', async () => {
    const { root } = await mountBattle(['boar']);
    const hpTextBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-attack'));
    const hpTextAfter = root.querySelector('#battle-monster-hp-text-0').textContent;
    assert.notEqual(hpTextBefore, hpTextAfter);
    assert.match(hpTextAfter, /^HP \d+\/\d+$/);
  });

  await t.test('the "a" keyboard shortcut attacks the same as clicking the button', async () => {
    const { root } = await mountBattle(['boar']);
    const hpTextBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    keydown('a');
    const hpTextAfter = root.querySelector('#battle-monster-hp-text-0').textContent;
    assert.notEqual(hpTextBefore, hpTextAfter);
  });

  // Split into two tests (rather than two mounts in one) so each test does
  // exactly one mount/unmount cycle - battleScreen.js is a singleton module
  // with a live setInterval(tick, 300) started on mount(), so a second
  // mount() without an intervening unmount() leaks the first battle's
  // interval into every later test in this file (it keeps ticking against
  // whatever module state is current, silently corrupting later tests).
  await t.test('Item button is disabled with no potions', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ inventory: [] }) });
    assert.equal(root.querySelector('#btn-item').disabled, true);
  });

  await t.test('Item button heals when a potion is used', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ player: { ...createNewGame().player, hp: 5 }, inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    assert.equal(root.querySelector('#btn-item').disabled, false);
    click(root.querySelector('#btn-item'));
    assert.match(root.querySelector('#battle-log').textContent, /drink a potion and heal/);
  });

  await t.test('a locked ability (below its unlock level) never renders, and its key press is a no-op', async () => {
    const { root, state } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 1 } }) });
    assert.equal(root.querySelector('#btn-ability-stab'), null);
    const hpBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    keydown('1'); // would be Stab's slot if unlocked
    assert.equal(root.querySelector('#battle-monster-hp-text-0').textContent, hpBefore);
    assert.equal(state.player.level, 1); // sanity: still the state we set up
  });

  await t.test('a landed hit on a timing-hit Stab primes Chop for an instant combo bonus', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 4 } }) });
    const stabBtn = root.querySelector('#btn-ability-stab');
    assert.ok(stabBtn, 'Stab should be unlocked at level 4');
    click(stabBtn);
    // Land inside the timing sweet spot (80-100% of the 1000ms meter) with a
    // real wait - this is the one test in this file that isn't instantaneous,
    // proving the harness can drive the same timing minigame a real player
    // interacts with, not just instant synchronous button clicks.
    await new Promise((resolve) => setTimeout(resolve, 900));
    keydown(' ', { code: 'Space' });
    // Let the ability's own promise resolution/render settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(root.querySelector('#battle-log').textContent, /Perfect timing!/);
    const chopBtn = root.querySelector('#btn-ability-chop');
    assert.ok(chopBtn, 'Chop should be unlocked at level 4');
    assert.match(chopBtn.textContent, /Combo Ready/);
    // playPerfectTimingEffect appends to <body> (same escape-the-dialog's-
    // overflow-hidden pattern as showDamageNumber's damage numbers), not
    // inside root - see battleScreen.js.
    assert.ok(document.querySelector('.battle-perfect-timing-badge'), 'a Perfect timing! hit should show the perfect-timing badge');
  });

  await t.test('unmount removes the keydown listener - a keypress after unmount is inert', async () => {
    const { mount, unmount } = await import('../js/screens/battleScreen.js');
    const root = createRoot();
    mount(root, { state: baseState(), monsterIds: ['boar'], callbacks: { onBattleEnd: () => {} } });
    unmount();
    // battleScreen.js's own unmount() only clears timers/listeners - in the
    // real app, screenManager.js's unmountOverlay() is what actually clears
    // the DOM (`root.innerHTML = ''`) as a separate step. Mirror that here:
    // without it, the first root's stale ids linger in the document and
    // getElementById (used internally by mount()) can resolve to them
    // instead of the second mount's own elements, since ids are
    // document-global, not scoped to whichever root queried them.
    root.remove();
    // Re-mount a second, unrelated battle so there's a live root to assert
    // against, then confirm the *first* battle's now-unmounted listener
    // doesn't also fire (it would throw reaching into a torn-down module's
    // stale closures if it did, since the first root/state are gone).
    const root2 = createRoot();
    mount(root2, { state: baseState(), monsterIds: ['boar'], callbacks: { onBattleEnd: () => {} } });
    const hpBefore = root2.querySelector('#battle-monster-hp-text-0').textContent;
    keydown('a');
    assert.notEqual(root2.querySelector('#battle-monster-hp-text-0').textContent, hpBefore);
    unmount();
  });
});
