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
import { PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT } from '../js/systems/parry.js';

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
    // Combo status moved from the button's own text into its title tooltip
    // as part of the icon-only redesign - the gold glow class is the
    // always-visible signal now, the tooltip carries the wording.
    assert.match(chopBtn.title, /Combo Ready/);
    assert.ok(chopBtn.classList.contains('battle-ability-button-combo'));
    // playPerfectTimingEffect appends to <body> (same escape-the-dialog's-
    // overflow-hidden pattern as showDamageNumber's damage numbers), not
    // inside root - see battleScreen.js.
    assert.ok(document.querySelector('.battle-perfect-timing-badge'), 'a Perfect timing! hit should show the perfect-timing badge');
  });

  await t.test('parry windup fill drives from a real-time CSS animation, not a stale JS width snapshot', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    // speed: 1000 saturates the monster's ATB gauge on the very first
    // 300ms tick (tickGauge clamps to 100), so windup starts right away
    // instead of waiting out boar's real speed (4, ~7.5s to fill from 0).
    await new Promise((resolve) => setTimeout(resolve, 350));
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    assert.equal(fill.style.animation, `battle-windup-fill ${PARRY_WINDUP_DURATION_MS}ms linear forwards`);
    // A couple more 300ms ticks fire while still winding (updateAtbBars
    // runs each time) - confirm they don't stomp the animation with a
    // stale width snapshot, which is exactly the bug this fix closes.
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(
      fill.style.animation,
      `battle-windup-fill ${PARRY_WINDUP_DURATION_MS}ms linear forwards`,
      'animation should survive intervening ticks while still winding',
    );
    // Press inside the real 80-100% zone (~800-1000ms after windup started,
    // which began on the first tick ~300ms after mount) and confirm the
    // parry lands, then that resolution clears the animation.
    await new Promise((resolve) => setTimeout(resolve, 250));
    keydown('s');
    assert.match(root.querySelector('#battle-log').textContent, /You parry/);
    assert.equal(fill.style.animation, '');
  });

  await t.test('clicking the Parry button lands a parry the same as the "s" shortcut', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    const parryBtn = root.querySelector('#btn-parry');
    assert.ok(parryBtn, 'Parry button should always render, not gated on unlock level');
    await new Promise((resolve) => setTimeout(resolve, 350));
    // Same real 80-100% zone timing as the keyboard-shortcut test above.
    await new Promise((resolve) => setTimeout(resolve, 850));
    click(parryBtn);
    assert.match(root.querySelector('#battle-log').textContent, /You parry/);
  });

  // Raised 2026-08-28: "that dialog moving for in battle stuff is too much" -
  // a landed parry used to shake the whole dialog box via
  // .battle-dialog-shake-crit; only the character-level sway remains now.
  // Raised again 2026-08-29: with the shake gone, the player needs its own
  // clear "that worked" signal distinct from a monster's own timing-hit
  // "PERFECT!" badge - a gold "PARRY!" badge plus a flash on the hero's own
  // emoji (see playParryEffect in battleScreen.js).
  await t.test('a landed parry shows a distinct PARRY! badge and hero-emoji flash, with no dialog shake', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await new Promise((resolve) => setTimeout(resolve, 850));
    keydown('s');
    assert.match(root.querySelector('#battle-log').textContent, /You parry/);

    const dialog = root.querySelector('.overlay-panel.battle-screen');
    assert.equal(dialog.classList.contains('battle-dialog-shake-crit'), false);

    // playPerfectTimingEffect/playParryEffect append to <body>, same as the
    // ability-timing-hit badge (see the level-4 combo test above).
    const badge = document.querySelector('.battle-perfect-timing-badge-parry');
    assert.ok(badge, 'a landed parry should show its own distinctly-styled badge');
    assert.equal(badge.textContent, 'PARRY!');

    const heroEmoji = root.querySelector('#battle-hero-emoji');
    assert.equal(heroEmoji.classList.contains('battle-parry-flash'), true);
  });

  await t.test('parry zone marker is scheduled to pulse via a real-time-delayed CSS animation', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const zone = root.querySelector('#battle-monster-parry-zone-0');
    const expectedDelayMs = (PARRY_ZONE_START_PERCENT / 100) * PARRY_WINDUP_DURATION_MS;
    assert.equal(zone.style.animation, `battle-zone-pulse 0.35s ease-out ${expectedDelayMs}ms`);
  });

  await t.test('a Retribution Charm reflects damage back at the attacking monster on its unparried attack', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ equipment: { ...createNewGame().equipment, accessory: 'retributionCharm' } }),
      monsterOverrides: [{ speed: 1000 }],
    });
    // windup starts on the first tick (~300ms); wait past the full
    // PARRY_WINDUP_DURATION_MS (1000ms) without pressing the parry key
    // ('s'), then past one more 300ms tick so tick()'s own
    // isWindupComplete poll catches it and resolves an unparried attack -
    // same windup mechanics the existing parry tests above use, just
    // letting the window close instead of pressing in time.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await new Promise((resolve) => setTimeout(resolve, 350));
    const log = root.querySelector('#battle-log').textContent;
    assert.match(log, /hits you for/);
    assert.match(log, /Retribution Charm reflects/);
  });

  await t.test('ability timing meter sweet spot is scheduled to pulse via a real-time-delayed CSS animation', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 4 } }) });
    click(root.querySelector('#btn-ability-stab'));
    const sweetSpot = root.querySelector('#battle-timing-sweet-spot');
    // TIMING_SWEET_SPOT_START (80) / TIMING_METER_DURATION_MS (1000) in
    // battleScreen.js - not exported, so asserted by value here.
    assert.equal(sweetSpot.style.animation, 'battle-zone-pulse 0.35s ease-out 800ms');
  });

  await t.test('clicking Attack spawns a swing sprite carrying the equipped weapon\'s emoji', async () => {
    const { root } = await mountBattle(['boar']);
    click(root.querySelector('#btn-attack'));
    const sprite = document.querySelector('.battle-swing-sprite');
    assert.ok(sprite, 'expected a swing sprite element on a basic Attack');
    // createNewGame() starts the player with starterSword equipped (js/state.js) -
    // its item emoji (js/data/items.js) is what Attack's swing should carry,
    // since Attack has no ability icon of its own to fall back on.
    assert.equal(sprite.textContent, '🗡️');
  });

  await t.test('clicking Attack with the Dragon Fang Blade equipped swings a blade, not its own tooth-shaped inventory icon', async () => {
    // Raised 2026-08-30: Timothy equipped Dragon Fang Blade (js/data/items.js,
    // emoji '🦷' - a literal tooth, chosen for inventory-row flavor, not for
    // being swung) and the Attack swing carried that tooth emoji verbatim.
    // A weapon's swingEmoji override (when present) should win over its own
    // display emoji for this specific purpose.
    const state = baseState();
    state.equipment.weapon = 'dragonFang';
    const { root } = await mountBattle(['boar'], { state });
    click(root.querySelector('#btn-attack'));
    const sprite = document.querySelector('.battle-swing-sprite');
    assert.ok(sprite, 'expected a swing sprite element on a basic Attack');
    assert.notEqual(sprite.textContent, '🦷', 'should not swing the raw tooth emoji');
  });

  await t.test('using Chop spawns a swing sprite carrying Chop\'s own icon, not the equipped weapon\'s', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 4 } }) });
    // Chop is a combo payoff (js/systems/abilities.js) - it skips the timing
    // meter entirely, so clicking it resolves synchronously like Attack does,
    // no need for the timing-meter wait/keydown dance the Stab test above uses.
    click(root.querySelector('#btn-ability-chop'));
    const sprite = document.querySelector('.battle-swing-sprite');
    assert.ok(sprite, 'expected a swing sprite element on using Chop');
    assert.equal(sprite.textContent, '🪓');
  });

  await t.test('using Sweep hits each target in sequence with a single traveling swing sprite, not all at once', async () => {
    const { root } = await mountBattle(['boar', 'boar', 'boar'], { state: baseState({ player: { ...createNewGame().player, level: 8 } }) });
    const hpText = (i) => root.querySelector(`#battle-monster-hp-text-${i}`).textContent;
    const before = [hpText(0), hpText(1), hpText(2)];
    // Sweep is a combo payoff (js/systems/abilities.js) - like Chop, it skips
    // the timing meter, so the only await before the first target resolves
    // is the new staggered sequence's own delay.
    click(root.querySelector('#btn-ability-sweep'));
    assert.deepEqual([hpText(0), hpText(1), hpText(2)], before, 'no target should be hit yet, immediately after pressing Sweep');
    assert.equal(
      document.querySelectorAll('.battle-swing-sprite:not(.battle-swing-trail)').length, 1,
      'Sweep should use exactly one traveling swing sprite, not one per target',
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.notEqual(hpText(0), before[0], 'the first target should be hit after roughly one stagger step');
    assert.equal(hpText(1), before[1], 'the second target should not be hit yet');
    assert.equal(hpText(2), before[2], 'the third target should not be hit yet');
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.notEqual(hpText(1), before[1], 'the second target should be hit by now');
    assert.notEqual(hpText(2), before[2], 'the third target should be hit by now');
  });

  await t.test('unmounting mid-Sweep-stagger does not throw touching a torn-down document', async () => {
    const { mount, unmount } = await import('../js/screens/battleScreen.js');
    const root = createRoot();
    mount(root, {
      state: baseState({ player: { ...createNewGame().player, level: 8 } }),
      monsterIds: ['boar', 'boar', 'boar'],
      callbacks: { onBattleEnd: () => {} },
    });
    click(root.querySelector('#btn-ability-sweep'));
    // Tear down before any of the staggered loop's awaited sleeps resolve.
    // Without the `unmounted` guard (js/screens/battleScreen.js), the loop
    // would resume after this, call playHitEffect -> showDamageNumber, and
    // throw reaching for a document/elements this screen no longer owns -
    // this is node:test's own uncaughtException path, not a regular assert,
    // so the absence of a thrown error after waiting out the full sequence
    // below is itself the assertion.
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 900));
  });

  await t.test('a crit hit\'s swing gets an afterimage trail', async () => {
    const originalRandom = Math.random;
    // Forces every rollCrit() roll (js/systems/combat.js's CRIT_CHANCE = 0.1)
    // to land as a crit, for the whole test.
    Math.random = () => 0.01;
    try {
      const { root } = await mountBattle(['boar']);
      click(root.querySelector('#btn-attack'));
      // Let all staggered trail ghosts (TRAIL_GHOST_STAGGER_MS apart) spawn.
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.ok(document.querySelectorAll('.battle-swing-trail').length > 0, 'a crit swing should spawn afterimage trail ghosts');
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('a non-crit hit\'s swing has no afterimage trail', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99; // never satisfies rollCrit()'s < 0.1 check
    try {
      const { root } = await mountBattle(['boar']);
      click(root.querySelector('#btn-attack'));
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(document.querySelectorAll('.battle-swing-trail').length, 0, 'a non-crit swing should not spawn any trail ghosts');
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('Sweep always shows a trail on its traveling sprite, regardless of crit', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99; // forces every hit in the sequence to be a non-crit
    try {
      const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 8 } }) });
      click(root.querySelector('#btn-ability-sweep'));
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.ok(document.querySelectorAll('.battle-swing-trail').length > 0, "Sweep's traveling sprite should always carry a trail");
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('a crit killing blow can play the split-death animation instead of the spin', async () => {
    const originalRandom = Math.random;
    // 0.01 satisfies both rollCrit()'s < 0.1 check and the split-death
    // chance roll in the same breath - forces a crit AND the split variant.
    Math.random = () => 0.01;
    try {
      const { root } = await mountBattle(['boar'], { monsterOverrides: [{ hp: 1 }] });
      click(root.querySelector('#btn-attack'));
      const emojiEl = root.querySelector('#battle-monster-emoji-0');
      assert.ok(emojiEl.classList.contains('battle-death-split'), 'a crit kill should be able to play the split-death animation');
      assert.ok(!emojiEl.classList.contains('battle-death-spin'), 'split-death should replace the spin, not layer on top of it');
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('a non-crit killing blow always uses the normal spin animation', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99; // never a crit, so split-death never rolls either
    try {
      const { root } = await mountBattle(['boar'], { monsterOverrides: [{ hp: 1 }] });
      click(root.querySelector('#btn-attack'));
      const emojiEl = root.querySelector('#battle-monster-emoji-0');
      assert.ok(emojiEl.classList.contains('battle-death-spin'), 'a non-crit kill should always use the spin animation');
      assert.ok(!emojiEl.classList.contains('battle-death-split'));
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('a killing blow sets --battle-death-anim-ms, the value the death CSS animation actually runs on', async () => {
    // Regression guard for the "two hardcoded durations that must agree"
    // hazard raised 2026-08-31: css/styles.css's .battle-death-spin/-split
    // no longer hardcode their own animation-duration - they read this
    // custom property, set here from updateHpBars()'s own
    // DEATH_HIDE_DELAY_MS (900ms as of this writing - update this literal
    // alongside that constant if it's ever retuned). Without this wiring,
    // the CSS falls back to its own 0.9s default silently - no visual or
    // functional break today since that happens to match, but a future
    // DEATH_HIDE_DELAY_MS change would then silently desync from the
    // animation's real on-screen duration with nothing to catch it.
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ hp: 1 }] });
    click(root.querySelector('#btn-attack'));
    const emojiEl = root.querySelector('#battle-monster-emoji-0');
    assert.equal(emojiEl.style.getPropertyValue('--battle-death-anim-ms'), '900ms');
  });

  await t.test('a hit sets the floating damage number\'s animation-duration inline, the value its CSS animation actually runs on', async () => {
    // Same "two hardcoded durations that must agree" hazard as
    // --battle-death-anim-ms above: css/styles.css's .battle-damage-number
    // no longer hardcodes its own animation-duration in the animation
    // shorthand - it's set here from showDamageNumber()'s own
    // DAMAGE_NUMBER_DURATION_MS (1400ms as of this writing - update this
    // literal alongside that constant if it's ever retuned), the same value
    // the element's removal setTimeout waits out.
    const { root } = await mountBattle(['boar']);
    click(root.querySelector('#btn-attack'));
    const numberEl = document.querySelector('.battle-damage-number');
    assert.ok(numberEl, 'expected a floating damage number on a basic Attack');
    assert.equal(numberEl.style.animationDuration, '1400ms');
  });

  await t.test('a landed parry sets the PERFECT!/PARRY! badge\'s animation-duration inline, the value its CSS animation actually runs on', async () => {
    // Same hazard again, for playPerfectTimingEffect()'s own
    // PERFECT_TIMING_BADGE_MS (900ms as of this writing) and
    // .battle-perfect-timing-badge in css/styles.css.
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await new Promise((resolve) => setTimeout(resolve, 850));
    keydown('s');
    assert.match(root.querySelector('#battle-log').textContent, /You parry/);
    const badge = document.querySelector('.battle-perfect-timing-badge-parry');
    assert.ok(badge, 'expected a PARRY! badge on a landed parry');
    assert.equal(badge.style.animationDuration, '900ms');
  });

  await t.test('action buttons stay on screen but are inert during the post-battle pause', async () => {
    // Raised 2026-08-31: buttons used to be cleared the instant the battle
    // ended; now they're deliberately left in place (see updateMenu()) so
    // the whole action bar fades away together with the dialog instead of
    // vanishing early. That only works if every action function guards on
    // `battleOver` - otherwise a still-visible-but-inert button could
    // re-run a real attack and call endBattle() a second time.
    const { root, battleEnds } = await mountBattle(['boar'], { monsterOverrides: [{ hp: 1 }] });
    const attackBtn = root.querySelector('#btn-attack');
    click(attackBtn); // the killing blow - triggers endBattle('won')
    assert.ok(root.querySelector('#btn-attack'), 'Attack should still be in the DOM right after battle ends, not cleared');
    const logAfterKill = root.querySelector('#battle-log').textContent;
    click(attackBtn); // should be a no-op now, not a second attack
    assert.equal(root.querySelector('#battle-log').textContent, logAfterKill, 'clicking Attack again after the battle ended should not log another hit');
    // Battle-ending pause now waits out DAMAGE_NUMBER_DURATION_MS (1400ms)
    // before the exit animation, plus EXIT_ANIM_MS (400ms) - see endBattle().
    await new Promise((resolve) => setTimeout(resolve, 1900));
    assert.equal(battleEnds.length, 1, 'onBattleEnd should fire exactly once, not twice from the extra click');
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

  await t.test('clicking the pause button shows the paused overlay and flips the button to a resume icon', async () => {
    const { root } = await mountBattle(['boar']);
    const overlay = root.querySelector('#battle-paused-overlay');
    const btn = root.querySelector('#battle-pause-btn');
    assert.equal(overlay.hidden, true);
    click(btn);
    assert.equal(overlay.hidden, false);
    assert.equal(btn.textContent, '▶️');
  });

  await t.test('clicking the pause button again resumes: overlay hides and the icon flips back', async () => {
    const { root } = await mountBattle(['boar']);
    const overlay = root.querySelector('#battle-paused-overlay');
    const btn = root.querySelector('#battle-pause-btn');
    click(btn);
    click(btn);
    assert.equal(overlay.hidden, true);
    assert.equal(btn.textContent, '⏸️');
  });

  await t.test('the "p" keybind toggles pause the same as clicking the button', async () => {
    const { root } = await mountBattle(['boar']);
    const overlay = root.querySelector('#battle-paused-overlay');
    assert.equal(overlay.hidden, true);
    keydown('p');
    assert.equal(overlay.hidden, false);
    keydown('p');
    assert.equal(overlay.hidden, true);
  });

  await t.test('while paused, Attack (button or "a" key) is a no-op', async () => {
    const { root } = await mountBattle(['boar']);
    keydown('p');
    const hpBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-attack'));
    keydown('a');
    assert.equal(root.querySelector('#battle-monster-hp-text-0').textContent, hpBefore);
  });

  await t.test('unpausing restores normal play - Attack works again after a pause/resume cycle', async () => {
    const { root } = await mountBattle(['boar']);
    keydown('p');
    keydown('p');
    const hpBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-attack'));
    assert.notEqual(root.querySelector('#battle-monster-hp-text-0').textContent, hpBefore);
  });
});
