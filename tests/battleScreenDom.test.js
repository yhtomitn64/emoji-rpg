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
import { PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT, PARRY_ZONE_END_PERCENT } from '../js/systems/parry.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), ...overrides };
}

// Root-cause fix for a CI-only flake (2026-09-02): these tests need to press
// during the real-time parry sweet spot, so a wall-clock wait is legitimate
// here (this IS the timing behavior under test) - but the wait used to be a
// single hardcoded guess (350ms + 850ms = 1200ms from mount) aimed at the
// *old* 80-100% zone. d67cf27 narrowed the zone to 90-100% (a 100ms window,
// half the old one) without updating these waits, which left the guess
// sitting exactly on the new zone's lower edge with zero margin - any
// scheduling jitter (the GitHub Actions runner, not this machine) could push
// the real elapsed time just past 1000ms and land after the window closes
// entirely. Fixed properly rather than just re-guessing a new constant: poll
// for the fill's animation to actually appear (replacing the "windup starts
// ~300ms after mount" assumption with a measured real start time), then wait
// for the *actual* midpoint of the current zone - derived from the real
// exported constants, so a future window resize can't silently reintroduce
// this same gap.
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

  // Raised 2026-08-31: with pause now able to freeze mid-battle specifically
  // so a player can go read tooltips (see the mid-battle pause entry in
  // BACKLOG_SHIPPED.md), every action button needs an actual "what this
  // does" description in its tooltip, not just name/cooldown/numbers -
  // matching what Parry's tooltip already had. One assertion per button,
  // checking real button text rather than pure ABILITIES data, so a typo in
  // the template string (not just the data) would be caught.
  await t.test('every action button has a plain-language description in its tooltip, not just name/cooldown', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 10 } }) });
    assert.match(root.querySelector('#btn-parry').title, /reflect its attack/);
    assert.match(root.querySelector('#btn-attack').title, /decays/);
    assert.match(root.querySelector('#btn-item').title, /potion/i);
    assert.match(root.querySelector('#btn-flee').title, /retreat|escape/);
    assert.match(root.querySelector('#btn-ability-stab').title, /prime/);
    assert.match(root.querySelector('#btn-ability-chop').title, /bonus damage/);
    assert.match(root.querySelector('#btn-ability-slash').title, /prime/);
    assert.match(root.querySelector('#btn-ability-sweep').title, /every living enemy/);
    assert.match(root.querySelector('#btn-ability-superScream').title, /boosts all your damage/);
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

  await t.test('Item button opens the quick-select menu, and selecting the heal potion heals without closing the menu', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ player: { ...createNewGame().player, hp: 5 }, inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    assert.equal(root.querySelector('#btn-item').disabled, false);
    click(root.querySelector('#btn-item'));
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    click(root.querySelector('button[data-slot="0"]'));
    // Stays open - raised live during testing: chaining several potion
    // picks (e.g. 2, 3, 4 in a row) shouldn't require reopening the menu
    // each time. Escape is the only way to close it now.
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    assert.match(root.querySelector('#battle-log').textContent, /drink Potion and heal/);
    keydown('Escape');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, true);
  });

  await t.test('Item button is disabled when the loadout has nothing usable', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ inventory: [], loadout: [null, null, null, null] }) });
    assert.equal(root.querySelector('#btn-item').disabled, true);
  });

  await t.test('pressing "i" opens the item menu, and pressing "1" selects slot 1 without closing it', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    keydown('i');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    keydown('1');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    assert.match(root.querySelector('#battle-log').textContent, /drink Potion and heal/);
  });

  await t.test('quickly pressing several loadout number keys in a row drinks each one without reopening the menu', async () => {
    const { root, state } = await mountBattle(['boar'], {
      state: baseState({
        inventory: [
          { itemId: 'strengthDraught', quantity: 1 },
          { itemId: 'swiftElixir', quantity: 1 },
        ],
        loadout: ['strengthDraught', 'swiftElixir', null, null],
      }),
    });
    keydown('i');
    keydown('1');
    keydown('2');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    assert.equal(state.inventory.find((e) => e.itemId === 'strengthDraught'), undefined);
    assert.equal(state.inventory.find((e) => e.itemId === 'swiftElixir'), undefined);
    assert.match(root.querySelector('#battle-log').textContent, /Strength Draught/);
    assert.match(root.querySelector('#battle-log').textContent, /Swift Elixir/);
  });

  await t.test('the item menu auto-closes on its own after settings.itemMenuAutoCloseMs with nothing picked', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'potion', quantity: 1 }], settings: { itemMenuAutoCloseMs: 100 } }),
    });
    keydown('i');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, true);
  });

  await t.test('picking a potion resets the auto-close timer instead of letting it expire mid-sequence', async () => {
    const { root, state } = await mountBattle(['boar'], {
      state: baseState({
        inventory: [
          { itemId: 'strengthDraught', quantity: 1 },
          { itemId: 'swiftElixir', quantity: 1 },
        ],
        loadout: ['strengthDraught', 'swiftElixir', null, null],
        settings: { itemMenuAutoCloseMs: 150 },
      }),
    });
    keydown('i');
    keydown('1');
    // Wait past half the window, then pick again - if the timer weren't
    // reset on pick, the original 150ms deadline would already be close
    // to firing by the time this second pick lands.
    await new Promise((resolve) => setTimeout(resolve, 100));
    keydown('2');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, false);
    assert.equal(state.inventory.find((e) => e.itemId === 'swiftElixir'), undefined);
    // Now let the (reset) timer actually run out.
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, true);
  });

  await t.test('pressing Escape while the item menu is open cancels without consuming anything', async () => {
    const { root, state } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    keydown('i');
    keydown('Escape');
    assert.equal(root.querySelector('#battle-item-menu-overlay').hidden, true);
    assert.equal(state.inventory.find((e) => e.itemId === 'potion').quantity, 1);
  });

  await t.test('drinking a timed buff potion logs a confirmation and shows it on the potion buff indicator', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'strengthDraught', quantity: 1 }], loadout: ['strengthDraught', null, null, null] }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    assert.match(root.querySelector('#battle-log').textContent, /Strength Draught/);
    assert.match(root.querySelector('#battle-potion-buff-indicator').textContent, /12s/);
  });

  await t.test('drinking a one-shot potion logs a confirmation', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'berserkerTonic', quantity: 1 }], loadout: ['berserkerTonic', null, null, null] }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    assert.match(root.querySelector('#battle-log').textContent, /guaranteed to crit/);
  });

  await t.test('drinking a potion logs a potion_used telemetry event with inBattle true', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const { root } = await mountBattle(['boar'], {
      state: baseState({ inventory: [{ itemId: 'potion', quantity: 1 }] }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const potionEvent = events.find((e) => e.type === 'potion_used');
    assert.ok(potionEvent);
    assert.equal(potionEvent.itemId, 'potion');
    assert.equal(potionEvent.inBattle, true);
  });

  await t.test('using an ability logs an ability_used telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const { root } = await mountBattle(['boar'], {
      state: baseState({ player: { ...createNewGame().player, level: 10 } }),
    });
    click(root.querySelector('#btn-ability-superScream'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const abilityEvent = events.find((e) => e.type === 'ability_used');
    assert.ok(abilityEvent);
    assert.equal(abilityEvent.abilityId, 'superScream');
    assert.equal(abilityEvent.inBattle, true);
  });

  await t.test('a locked ability (below its unlock level) never renders, and its key press is a no-op', async () => {
    const { root, state } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 1 } }) });
    assert.equal(root.querySelector('#btn-ability-stab'), null);
    const hpBefore = root.querySelector('#battle-monster-hp-text-0').textContent;
    keydown('1'); // would be Stab's slot if unlocked
    assert.equal(root.querySelector('#battle-monster-hp-text-0').textContent, hpBefore);
    assert.equal(state.player.level, 1); // sanity: still the state we set up
  });

  await t.test('using Impale resolves synchronously - no timing meter to wait through', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 2 } }) });
    const before = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-ability-stab'));
    // No await needed at all - resolves in the same synchronous click handler.
    assert.notEqual(root.querySelector('#battle-monster-hp-text-0').textContent, before);
    assert.match(root.querySelector('#battle-log').textContent, /You use Impale/);
  });

  await t.test('using Sever against 2+ monsters also hits one random other living enemy', async () => {
    const { root } = await mountBattle(['boar', 'boar', 'boar'], { state: baseState({ player: { ...createNewGame().player, level: 4 } }) });
    const hpText = (i) => root.querySelector(`#battle-monster-hp-text-${i}`).textContent;
    const before = [hpText(0), hpText(1), hpText(2)];
    click(root.querySelector('#btn-ability-chop'));
    const after = [hpText(0), hpText(1), hpText(2)];
    const hitCount = after.filter((text, i) => text !== before[i]).length;
    assert.equal(hitCount, 2, 'Sever should hit exactly the selected target plus one other');
  });

  await t.test('using Sever solo (one monster) only hits that one monster, no crash', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ player: { ...createNewGame().player, level: 4 } }) });
    const before = root.querySelector('#battle-monster-hp-text-0').textContent;
    click(root.querySelector('#btn-ability-chop'));
    assert.notEqual(root.querySelector('#battle-monster-hp-text-0').textContent, before);
  });

  await t.test('parry windup fill drives from a real-time CSS animation, not a stale JS width snapshot', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    // speed: 1000 saturates the monster's ATB gauge on the very first
    // 300ms tick (tickGauge clamps to 100), so windup starts right away
    // instead of waiting out boar's real speed (4, ~7.5s to fill from 0).
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    const windupStart = await waitForWindupStart(fill);
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
    // Press at the real midpoint of the current parry zone (see
    // waitUntilZoneMidpoint above) and confirm the parry lands, then that
    // resolution clears the animation.
    await waitUntilZoneMidpoint(windupStart);
    keydown('s');
    assert.match(root.querySelector('#battle-log').textContent, /You parry/);
    assert.equal(fill.style.animation, '');
  });

  await t.test('clicking the Parry button lands a parry the same as the "s" shortcut', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    const parryBtn = root.querySelector('#btn-parry');
    assert.ok(parryBtn, 'Parry button should always render, not gated on unlock level');
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    const windupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(windupStart);
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
  await t.test('parry has a shared cooldown - a second press before it expires does not land, even mid-wind-up', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    const firstWindupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(firstWindupStart);
    keydown('s');
    assert.match(root.querySelector('#battle-log').textContent, /You parry/);

    const parryBtn = root.querySelector('#btn-parry');
    assert.equal(parryBtn.disabled, true, 'Parry button should be disabled immediately after a press, while on cooldown');
    assert.ok(
      parryBtn.querySelector('.battle-ability-cooldown-wipe'),
      'Parry button should show the same cooldown-wipe overlay Attack already uses',
    );

    // boar's speed:1000 override saturates its ATB gauge on the very next
    // tick too, so a fresh wind-up starts again almost immediately after
    // the first one resolves - press into that second wind-up's own zone
    // while still well inside the 10s cooldown from the first press.
    const secondWindupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(secondWindupStart);
    keydown('s');
    // Pressing while on cooldown is a total no-op (unlike a normal miss, it
    // doesn't even force-resolve the wind-up) - wait for it to finish on its
    // own and for tick()'s 300ms poll to catch that completion.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const log = root.querySelector('#battle-log').textContent;
    assert.equal((log.match(/You parry/g) || []).length, 1, 'a press while on cooldown should not land a second parry');
    assert.match(log, /hits you for/, 'the second wind-up should resolve as a normal unblocked hit instead');
  });

  await t.test('multi-mob parry catches every monster mid-wind-up regardless of timing, not just those in the zone', async () => {
    const { root } = await mountBattle(['boar', 'boar', 'boar'], {
      monsterOverrides: [{ speed: 1000 }, { speed: 1000 }, { speed: 1000 }],
    });
    const fill0 = root.querySelector('#battle-monster-atb-fill-0');
    // All three share the same speed:1000 override, so their wind-ups all
    // saturate and start on the same synchronous tick - waiting for the
    // first one's animation to appear confirms all three have started.
    await waitForWindupStart(fill0);
    // Press immediately, well before any monster nears its 90% zone - this
    // is the whole point of the fix: no zone timing required in multi-mob.
    keydown('s');
    const log = root.querySelector('#battle-log').textContent;
    assert.equal((log.match(/You parry/g) || []).length, 3, 'all three monsters mid-wind-up should be parried, even this early');
  });

  await t.test('clicking a monster\'s ATB bar to parry also respects the shared cooldown', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    const windupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(windupStart);
    keydown('s'); // burns the shared cooldown via the keyboard path
    assert.match(root.querySelector('#battle-log').textContent, /You parry/);

    const secondWindupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(secondWindupStart);
    click(root.querySelector('#battle-monster-atb-bar-0'));
    const log = root.querySelector('#battle-log').textContent;
    assert.equal((log.match(/You parry/g) || []).length, 1, 'clicking the ATB bar while on cooldown should not land a second parry');
  });

  await t.test('a landed parry shows a distinct PARRY! badge and hero-emoji flash, with no dialog shake', async () => {
    const { root } = await mountBattle(['boar'], { monsterOverrides: [{ speed: 1000 }] });
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    const windupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(windupStart);
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
    // Every ability resolves synchronously post-rotation-v2 (js/systems/abilities.js) - no timing-meter wait needed for any of them.
    click(root.querySelector('#btn-ability-chop'));
    const sprite = document.querySelector('.battle-swing-sprite');
    assert.ok(sprite, 'expected a swing sprite element on using Chop');
    assert.equal(sprite.textContent, '🪓');
  });

  await t.test('using Sweep hits each target in sequence with a single traveling swing sprite, not all at once', async () => {
    const { root } = await mountBattle(['boar', 'boar', 'boar'], { state: baseState({ player: { ...createNewGame().player, level: 8 } }) });
    const hpText = (i) => root.querySelector(`#battle-monster-hp-text-${i}`).textContent;
    const before = [hpText(0), hpText(1), hpText(2)];
    // Faultline (js/systems/abilities.js) resolves synchronously too - the only await before the first target resolves is the staggered sequence's own delay.
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

  await t.test('clicking Attack in a fresh battle beats the (zero) recorded best and shows a NEW MAX! badge', async () => {
    const { root, state } = await mountBattle(['boar']);
    click(root.querySelector('#btn-attack'));
    const badge = document.querySelector('.battle-perfect-timing-badge-max');
    assert.ok(badge, 'expected a NEW MAX! badge on a hit beating the recorded best');
    assert.equal(badge.textContent, 'NEW MAX!');
    assert.ok(state.bestDamage.attack > 0, 'expected the hit\'s damage to be recorded in state.bestDamage.attack');
  });

  await t.test('clicking Attack when the recorded best already beats the roll shows no NEW MAX! badge', async () => {
    const { root } = await mountBattle(['boar'], { state: baseState({ bestDamage: { attack: 99999 } }) });
    click(root.querySelector('#btn-attack'));
    const badge = document.querySelector('.battle-perfect-timing-badge-max');
    assert.equal(badge, null, 'an already-unbeatable recorded best should show no badge');
  });

  await t.test('the DPS meter reads DPS: 0.0 immediately on mount, before any damage is dealt', async () => {
    const { root } = await mountBattle(['boar']);
    assert.equal(root.querySelector('#battle-dps').textContent, 'DPS: 0.0');
  });

  await t.test('the DPS meter climbs above zero once damage has been dealt and a tick has passed', async () => {
    const { root } = await mountBattle(['boar']);
    click(root.querySelector('#btn-attack'));
    await new Promise((resolve) => setTimeout(resolve, 350)); // let one 300ms tick fire
    const dpsText = root.querySelector('#battle-dps').textContent;
    assert.match(dpsText, /^DPS: \d+\.\d$/);
    assert.ok(parseFloat(dpsText.slice('DPS: '.length)) > 0, `expected a positive DPS reading, got "${dpsText}"`);
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

  await t.test('an active Strength Draught increases Attack damage over the unbuffed baseline', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5; // fixed variance roll, no crit (rollCrit needs < 0.1)
    try {
      const { root: unbuffedRoot } = await mountBattle(['boar'], { state: baseState() });
      click(unbuffedRoot.querySelector('#btn-attack'));
      const unbuffedDamage = Number(unbuffedRoot.querySelector('#battle-log').textContent.match(/for (\d+)/)[1]);
      const { unmount } = await import('../js/screens/battleScreen.js');
      unmount();
      // buildDom()/updateMenu() look elements up via document.getElementById,
      // not scoped to a specific root - removing the first root's DOM (not
      // just unmounting its listeners/timers) avoids duplicate ids
      // resolving to the wrong (stale) battle's elements once a second
      // battle mounts below.
      unbuffedRoot.remove();

      const { root: buffedRoot } = await mountBattle(['boar'], {
        state: baseState({ inventory: [{ itemId: 'strengthDraught', quantity: 1 }], loadout: ['strengthDraught', null, null, null] }),
      });
      click(buffedRoot.querySelector('#btn-item'));
      click(buffedRoot.querySelector('button[data-slot="0"]'));
      keydown('Escape'); // menu stays open after a pick now - close it before attacking
      click(buffedRoot.querySelector('#btn-attack'));
      // Only the Attack line contains "for <N>" - the drink confirmation
      // line above it doesn't - so the same simple match used for the
      // unbuffed case works here too.
      const buffedDamage = Number(buffedRoot.querySelector('#battle-log').textContent.match(/for (\d+)/)[1]);
      assert.ok(buffedDamage > unbuffedDamage, `expected buffed damage ${buffedDamage} > unbuffed ${unbuffedDamage}`);
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('Berserker Tonic guarantees the next Attack is a crit even when the crit roll would miss', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99; // never satisfies rollCrit()'s own < 0.1 check on its own
    try {
      const { root } = await mountBattle(['boar'], {
        state: baseState({ inventory: [{ itemId: 'berserkerTonic', quantity: 1 }], loadout: ['berserkerTonic', null, null, null] }),
      });
      click(root.querySelector('#btn-item'));
      click(root.querySelector('button[data-slot="0"]'));
      keydown('Escape'); // menu stays open after a pick now - close it before attacking
      click(root.querySelector('#btn-attack'));
      assert.match(root.querySelector('#battle-log').textContent, /Critical! You hit/);
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('Berserker Tonic\'s guaranteed crit only applies to the next hit, not the one after', async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
      const { root } = await mountBattle(['boar'], {
        state: baseState({ inventory: [{ itemId: 'berserkerTonic', quantity: 1 }], loadout: ['berserkerTonic', null, null, null] }),
      });
      click(root.querySelector('#btn-item'));
      click(root.querySelector('button[data-slot="0"]'));
      keydown('Escape'); // menu stays open after a pick now - close it before attacking
      click(root.querySelector('#btn-attack')); // consumes the guaranteed crit
      const logAfterFirst = root.querySelector('#battle-log').textContent;
      assert.match(logAfterFirst, /Critical! You hit/);
      const linesAfterFirst = root.querySelectorAll('#battle-log div').length;
      // Attack's own spam-cooldown (attackCooldownMsForStreak, streak 1 =
      // 700ms) blocks a same-tick second click - a disabled button doesn't
      // fire click handlers even via a dispatched event, matching real
      // browser behavior. Wait past 3 ticks (900ms) so tick()'s own
      // `attackCooldownMs -= 300` decays it back to 0 first.
      await new Promise((resolve) => setTimeout(resolve, 950));
      click(root.querySelector('#btn-attack')); // should NOT be a crit (0.99 never satisfies rollCrit on its own)
      const linesAfterSecond = root.querySelectorAll('#battle-log div').length;
      assert.equal(linesAfterSecond, linesAfterFirst + 1, 'second Attack should have logged exactly one new line');
      const secondLine = [...root.querySelectorAll('#battle-log div')].pop().textContent;
      assert.doesNotMatch(secondLine, /Critical!/);
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('Second Wind survives a lethal hit at 1 HP', async () => {
    const { root, state } = await mountBattle(['boar'], {
      state: baseState({
        player: { ...createNewGame().player, hp: 1 },
        inventory: [{ itemId: 'secondWind', quantity: 1 }],
        loadout: ['secondWind', null, null, null],
      }),
      monsterOverrides: [{ speed: 1000 }], // ready to wind up on the first tick
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]'));
    // Menu stays open after a pick now - close it so combat resumes at
    // full speed (300ms ticks) before the real-time waits below, which
    // are tuned for that cadence, not the item menu's 25% slow-mo.
    keydown('Escape');
    // Same unparried-hit forcing pattern as the existing "a Retribution
    // Charm reflects damage..." test above: wait past the first tick
    // (windup starts, ~300ms), then past the full PARRY_WINDUP_DURATION_MS
    // without pressing parry, then one more tick so tick()'s own
    // isWindupComplete poll resolves the attack.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await new Promise((resolve) => setTimeout(resolve, PARRY_WINDUP_DURATION_MS));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(state.player.hp, 1);
    assert.match(root.querySelector('#battle-log').textContent, /Second Wind kicks in/);
  });

  await t.test('a second Second Wind can\'t be drunk while one is already armed', async () => {
    const { root } = await mountBattle(['boar'], {
      state: baseState({
        inventory: [{ itemId: 'secondWind', quantity: 2 }],
        loadout: ['secondWind', null, null, null],
      }),
    });
    click(root.querySelector('#btn-item'));
    click(root.querySelector('button[data-slot="0"]')); // arms it - 1 copy left in inventory
    click(root.querySelector('#btn-item'));
    assert.equal(root.querySelector('button[data-slot="0"]').disabled, true);
  });
});
