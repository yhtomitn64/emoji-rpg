# Multi-Mob Parry Cooldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace parry's always-available, per-monster-narrow-timing-zone
global sweep with a shared cooldown: solo fights keep the existing 100ms
timing window but only usable once every `PARRY_COOLDOWN_MS`, and 2+
monster fights catch every monster currently mid-wind-up (no timing
zone required) when pressed off cooldown.

**Architecture:** No new files or modules. `PARRY_COOLDOWN_MS` is added
as a new exported constant in the existing `js/systems/parry.js`. All
behavioral changes live in `js/screens/battleScreen.js` (module-level
cooldown state ticked alongside the existing `attackCooldownMs`/
`abilityCooldowns`, a new optional `requireZone` parameter on the
existing `resolveMonsterWindup`, and the existing Parry-button UI's
cooldown-wipe convention reused as-is). `scripts/simulate-balance.js`
gets a matching update to how it models solo parry, since it shares
`js/systems/parry.js`'s real math but hand-rolls its own attack-cadence
loop.

**Tech Stack:** Vanilla JS (no framework), `node:test` + `node:assert/strict`
for unit tests, `jsdom` for DOM tests (`tests/helpers/dom.js`).

**Spec:** `docs/superpowers/specs/2026-09-02-multimob-parry-cooldown-design.md`

## Global Constraints

- `PARRY_COOLDOWN_MS` default is `10000` (10 seconds) — Timothy's own
  starting guess, explicitly not pre-tuned further; don't spend time
  picking a "better" number here.
- Solo (exactly 1 monster alive at press time) parry mechanics are
  otherwise **unchanged** — same 90-100% zone (`PARRY_ZONE_START_PERCENT`/
  `PARRY_ZONE_END_PERCENT`), same reflect math. Only the cooldown gate is
  new for solo.
- The multi-mob zone-skip and the click-to-parry cooldown gating are both
  in scope (see spec's Scope section) — don't skip the click handlers as
  "out of scope," they're an explicit part of this build.
- Every commit that touches non-doc files needs a `CHANGELOG.md` entry
  under `## [Unreleased]` (this repo's own `CLAUDE.md` checklist) — Task 1
  adds the full entry up front; later tasks don't need their own.
- Do not touch ability rotation, the reflect-damage percentage, or the
  90-100% zone bounds themselves — all explicitly out of scope per the
  spec.

---

## Task 1: Cooldown constant, state wiring, and solo-only gating

**Files:**
- Modify: `js/systems/parry.js` (add `PARRY_COOLDOWN_MS` export, after
  `PARRY_REFLECT_FRACTION`)
- Modify: `js/screens/battleScreen.js`:
  - Import line 6 (add `PARRY_COOLDOWN_MS` to the existing import from
    `../systems/parry.js`)
  - After line 74 (`let attackCooldownTotalMs = 0;`) — add
    `parryCooldownMs`/`parryCooldownTotalMs` state
  - Line 1755 (`attackCooldownMs = Math.max(0, attackCooldownMs - 300);`
    inside `tick()`) — add the matching parry decrement right after
  - Line 1984 (`attackCooldownTotalMs = 0;` inside `mount()`'s reset
    block) — add the matching parry reset right after
  - `attemptParry()` (currently lines 1299-1306) — add the cooldown guard
    and set-on-press behavior
  - `updateMenu()` (currently lines 796-856) — compute `parryCooldownPct`
    and wire `disabled`/`cooldownPct` into the `btn-parry`
    `actionButtonHtml()` call, update its `title`
- Modify: `CHANGELOG.md` (add the full `## [Unreleased]` entry for this
  whole feature now — see Step 8 below; later tasks don't touch it again
  until Task 4 moves it under a dated version)
- Test: `tests/battleScreenDom.test.js` (new test in the existing
  `'battleScreen DOM'` suite, placed right after the existing `'clicking
  the Parry button lands a parry the same as the "s" shortcut'` test
  around line 353)

**Interfaces:**
- Produces: `PARRY_COOLDOWN_MS` (exported number, `js/systems/parry.js`)
- Produces: `parryCooldownMs`/`parryCooldownTotalMs` (module-level `let`
  numbers in `battleScreen.js`, same shape/lifecycle as
  `attackCooldownMs`/`attackCooldownTotalMs` — read by Task 2's rewrite
  of `attemptParry()` and the click handlers)

- [ ] **Step 1: Add the cooldown constant**

In `js/systems/parry.js`, right after the existing
`export const PARRY_REFLECT_FRACTION = 0.5;` line, add:

```js
// Gates how often the parry key can be pressed at all - added 2026-09-02
// per the "multi-mob parry feels clunky" backlog item
// (docs/superpowers/BACKLOG.md, Combat pass ideas). Starts the instant
// the key is pressed, whether or not a monster was actually caught -
// that's the entire anti-spam mechanism (Timothy's own call: "the
// penalty being you use the ability and have to wait 10 seconds or
// whatever"). Also closes the separate "parry can win almost anything"
// balance concern for solo fights, since a skilled player can no longer
// chain parries back to back. Starting value, not yet validated against
// real play - see docs/superpowers/specs/2026-09-02-multimob-parry-
// cooldown-design.md's Follow-ups section.
export const PARRY_COOLDOWN_MS = 10000;
```

- [ ] **Step 2: Write the failing test**

In `tests/battleScreenDom.test.js`, add this test right after the
existing `'clicking the Parry button lands a parry the same as the "s"
shortcut'` test (ends at line 353):

```js
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
    const log = root.querySelector('#battle-log').textContent;
    assert.equal((log.match(/You parry/g) || []).length, 1, 'a press while on cooldown should not land a second parry');
    assert.match(log, /hits you for/, 'the second wind-up should resolve as a normal unblocked hit instead');
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test`

Expected: FAIL — with only Step 1 applied so far, `parryCooldownMs`
doesn't exist yet and `attemptParry()` has no cooldown guard, so the
second `keydown('s')` lands a second parry: the test fails on the
`assert.equal((log.match(/You parry/g) || []).length, 1, ...)` line
(sees `2`, not `1`), and likely on `parryBtn.disabled` too (still
`false`).

- [ ] **Step 4: Wire the constant and new state into `battleScreen.js`**

Change the import on line 6 from:

```js
import { createWindupState, startWindup, isWindupComplete, windupElapsedPercent, resolveParryAttempt, rollIncomingDamage, resolveParrySuccess, shiftWindupStart, PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT } from '../systems/parry.js';
```

to:

```js
import { createWindupState, startWindup, isWindupComplete, windupElapsedPercent, resolveParryAttempt, rollIncomingDamage, resolveParrySuccess, shiftWindupStart, PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT, PARRY_COOLDOWN_MS } from '../systems/parry.js';
```

Right after line 74 (`let attackCooldownTotalMs = 0;`), add:

```js
let parryCooldownMs = 0;
let parryCooldownTotalMs = 0;
```

In `tick()`, right after the line `attackCooldownMs = Math.max(0,
attackCooldownMs - 300);` (currently line 1755), add:

```js
parryCooldownMs = Math.max(0, parryCooldownMs - 300);
```

In `mount()`'s per-battle reset block, right after the line
`attackCooldownTotalMs = 0;` (currently line 1984), add:

```js
parryCooldownMs = 0;
parryCooldownTotalMs = 0;
```

- [ ] **Step 5: Gate `attemptParry()` behind the cooldown**

Replace the current `attemptParry()` function body (currently lines
1299-1306):

```js
function attemptParry() {
  if (battleOver) return;
  for (const mc of monsterCombatants) {
    if (mc.hp > 0 && mc.windup.active && resolveParryAttempt(windupElapsedPercent(mc.windup))) {
      resolveMonsterWindup(mc, true);
    }
  }
}
```

with:

```js
function attemptParry() {
  if (battleOver || parryCooldownMs > 0) return;
  parryCooldownMs = parryCooldownTotalMs = PARRY_COOLDOWN_MS;
  for (const mc of monsterCombatants) {
    if (mc.hp > 0 && mc.windup.active && resolveParryAttempt(windupElapsedPercent(mc.windup))) {
      resolveMonsterWindup(mc, true);
    }
  }
  // Explicit re-render: resolveMonsterWindup() above already calls
  // updateMenu() when it actually resolves a monster, but a total whiff
  // (cooldown just started, nothing was in its zone) would otherwise wait
  // for the next 300ms tick to show the button going on cooldown -
  // matches playerAttack()'s own explicit updateMenu() call right after
  // setting attackCooldownMs.
  updateMenu();
}
```

This step deliberately does NOT yet change the multi-mob zone
requirement — solo and multi-mob both still require
`resolveParryAttempt` to pass here. That's Task 2.

- [ ] **Step 6: Wire the Parry button's cooldown UI**

In `updateMenu()`, right after the existing line computing
`attackCooldownPct` (currently line 809: `const attackCooldownPct =
attackCooldownMs > 0 && attackCooldownTotalMs > 0 ? (attackCooldownMs /
attackCooldownTotalMs) * 100 : 0;`), add:

```js
const parryCooldownPct = parryCooldownMs > 0 && parryCooldownTotalMs > 0 ? (parryCooldownMs / parryCooldownTotalMs) * 100 : 0;
const parryCooldownSuffix = parryCooldownMs > 0 ? ` — ${Math.ceil(parryCooldownMs / 1000)}s` : '';
```

Replace the `btn-parry` `actionButtonHtml()` call (currently lines
823-830):

```js
    ${actionButtonHtml({
      id: 'btn-parry',
      icon: '🛡️',
      key: 'S',
      title: "Parry (S) — time it while a monster's wind-up bar is in the red zone to reflect its attack",
      disabled: false,
      extraClass: ' battle-parry-button',
    })}
```

with:

```js
    ${actionButtonHtml({
      id: 'btn-parry',
      icon: '🛡️',
      key: 'S',
      title: `Parry (S) — solo: time it while a monster's wind-up bar is in the red zone; 2+ monsters: catches everyone mid-wind-up instead. ${PARRY_COOLDOWN_MS / 1000}s cooldown${parryCooldownSuffix}`,
      disabled: parryCooldownMs > 0,
      cooldownPct: parryCooldownPct,
      extraClass: ' battle-parry-button',
    })}
```

- [ ] **Step 7: Run the test to verify it now passes**

Run: `npm run test`

Expected: PASS — all tests green, including the cooldown test from
Step 2.

- [ ] **Step 8: Add the full CHANGELOG.md entry for this feature**

In `CHANGELOG.md`, replace:

```markdown
## [Unreleased]

## [0.17.4] - 2026-09-02
```

with:

```markdown
## [Unreleased]

### Changed
- Parry (`js/systems/parry.js`, `js/screens/battleScreen.js`) now shares
  a 10-second cooldown (`PARRY_COOLDOWN_MS`) across every parry input -
  the `s`/`S` key, the Parry button, and the per-monster ATB-bar/parry-
  hint click shortcuts. Pressing it starts the cooldown immediately
  whether or not it actually catches a monster, which is the entire
  anti-spam mechanism (no separate penalty needed). This also closes the
  separate "parry can win almost anything" balance concern, since a
  skilled player can no longer chain unlimited parries in a solo fight
  either.
- In fights with 2+ monsters, landing a parry while off cooldown now
  catches *every* monster currently mid-wind-up, regardless of how far
  into its wind-up it is - not just those inside the narrow 90-100%
  zone. Solo fights are unchanged otherwise: still requires hitting that
  same zone. This replaces the old always-available global sweep (which
  required the same narrow zone per monster, making multi-mob parry play
  out as repeated solo parries with more visual noise) with a genuine
  multi-mob-specific mechanic. The per-monster ATB-bar/parry-hint click
  shortcuts now share the same cooldown as the keyboard/button path -
  see `docs/superpowers/specs/2026-09-02-multimob-parry-cooldown-
  design.md`.
- `scripts/simulate-balance.js`'s solo parry modeling updated to match:
  an attempt is only possible off cooldown, and a miss costs the
  cooldown the same as a hit, replacing the old flat per-attack
  probability that had no cooldown concept at all. Existing dragon/
  NG+2-tier matchup numbers were tuned against that old assumption and
  haven't been re-validated against this one yet - flagged for a real
  playtest pass, not re-tuned blind here.

## [0.17.4] - 2026-09-02
```

- [ ] **Step 9: Commit**

```bash
git add js/systems/parry.js js/screens/battleScreen.js tests/battleScreenDom.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: gate parry behind a shared cooldown

Parry (keyboard, button, and per-monster click shortcuts) now shares a
10s cooldown across every input instead of being available on every
windup - the cooldown itself is the anti-spam mechanism, and it also
closes the separate "parry wins almost anything" balance concern for
solo fights. Multi-mob's own zone-skip behavior lands in the next
commit.
EOF
)"
```

---

## Task 2: Multi-mob zone-skip and click-path cooldown gating

**Files:**
- Modify: `js/screens/battleScreen.js`:
  - `resolveMonsterWindup(monster, parried)` (currently lines 1698-1725)
    — add an optional third parameter
  - `attemptParry()` (as left by Task 1) — rewrite to detect multi-mob
    and skip the zone check
  - `mount()`'s per-monster click wiring (currently lines 1996-2010,
    inside the `monsterCombatants.forEach` block) — gate both
    `onclick` handlers behind the same cooldown
- Test: `tests/battleScreenDom.test.js` (two new tests, placed right
  after Task 1's new cooldown test)

**Interfaces:**
- Consumes: `parryCooldownMs`/`parryCooldownTotalMs` (from Task 1)
- Produces: `resolveMonsterWindup(monster, parried, { requireZone =
  true } = {})` — every other call site in the file keeps calling it
  with two arguments and gets the default `true` (unchanged behavior)

- [ ] **Step 1: Write the failing tests**

In `tests/battleScreenDom.test.js`, add these two tests right after
Task 1's `'parry has a shared cooldown...'` test:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`

Expected: the multi-mob test FAILs with `0` (or fewer than `3`) matches
of `/You parry/`, since today's code still requires each monster to be
in its own 90-100% zone. The click-cooldown test FAILs with `2` matches,
since the click handler doesn't check the cooldown yet.

- [ ] **Step 3: Add `requireZone` to `resolveMonsterWindup`**

Change the function signature and its parry-check condition (currently
lines 1698 and 1705):

```js
function resolveMonsterWindup(monster, parried) {
```

to:

```js
function resolveMonsterWindup(monster, parried, { requireZone = true } = {}) {
```

and change:

```js
  if (parried && resolveParryAttempt(elapsedPercent)) {
```

to:

```js
  if (parried && (!requireZone || resolveParryAttempt(elapsedPercent))) {
```

- [ ] **Step 4: Rewrite `attemptParry()` for the multi-mob case**

Replace `attemptParry()` (as left by Task 1) with:

```js
function attemptParry() {
  if (battleOver || parryCooldownMs > 0) return;
  parryCooldownMs = parryCooldownTotalMs = PARRY_COOLDOWN_MS;
  const aliveMonsters = monsterCombatants.filter((mc) => mc.hp > 0);
  const isMultiMob = aliveMonsters.length > 1;
  for (const mc of aliveMonsters) {
    if (!mc.windup.active) continue;
    if (isMultiMob) {
      // No zone requirement in multi-mob - catching everyone currently
      // mid-wind-up is the whole point of this rework (see the design
      // doc's Purpose section).
      resolveMonsterWindup(mc, true, { requireZone: false });
    } else if (resolveParryAttempt(windupElapsedPercent(mc.windup))) {
      resolveMonsterWindup(mc, true);
    }
  }
  updateMenu();
}
```

`isMultiMob` is computed fresh from monsters *currently alive* on every
press, so a group fight whittled down to one survivor correctly reverts
to solo's precision behavior for the rest of that fight.

- [ ] **Step 5: Gate the per-monster click handlers behind the cooldown**

In `mount()`'s `monsterCombatants.forEach` block, change (currently
lines 2002-2009):

```js
    elements.monsterAtbBars[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
    elements.parryHints[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
```

to:

```js
    elements.monsterAtbBars[i].onclick = (event) => {
      event.stopPropagation();
      if (parryCooldownMs > 0) return;
      parryCooldownMs = parryCooldownTotalMs = PARRY_COOLDOWN_MS;
      resolveMonsterWindup(mc, true);
      updateMenu();
    };
    elements.parryHints[i].onclick = (event) => {
      event.stopPropagation();
      if (parryCooldownMs > 0) return;
      parryCooldownMs = parryCooldownTotalMs = PARRY_COOLDOWN_MS;
      resolveMonsterWindup(mc, true);
      updateMenu();
    };
```

Both keep calling `resolveMonsterWindup(mc, true)` with the default
`requireZone: true` — clicking a specific monster stays a precision
action requiring its own zone, same as today; only the keyboard/button
sweep gets the multi-mob zone-skip from Step 4.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test`

Expected: PASS — all tests green, including both new ones and Task 1's.

- [ ] **Step 7: Commit**

```bash
git add js/screens/battleScreen.js tests/battleScreenDom.test.js
git commit -m "$(cat <<'EOF'
feat: multi-mob parry catches every mid-windup monster, no zone needed

Landing a parry while 2+ monsters are alive now sweeps every monster
currently mid-windup regardless of timing, instead of requiring each one
independently hit its own narrow 90-100% zone. Solo fights are
unaffected - still need the zone. The per-monster ATB-bar/parry-hint
click shortcuts now share the same cooldown as the keyboard/button path,
closing an unlimited-precision escape hatch around the whole point of
the cooldown added in the previous commit.
EOF
)"
```

---

## Task 3: Update the balance simulator's solo parry modeling

**Files:**
- Modify: `scripts/simulate-balance.js`:
  - Import line 45 (add `PARRY_COOLDOWN_MS`)
  - `simulateBattle()`'s per-trial state block (currently around line
    386, after `let attackStreakIdleMs = 0;`)
  - The tick loop's cooldown-decrement block (currently around line 401,
    right after `attackCooldownMs = Math.max(0, attackCooldownMs -
    300);`)
  - The `isReady(monster.atb)` block (currently lines 412-432)
  - The module docstring's "What's deliberately NOT modeled" bullet
    (currently lines 339-346) and the `PARRY_LAND_RATE_DEFAULT` comment
    (currently lines 57-75)

**Interfaces:**
- Consumes: `PARRY_COOLDOWN_MS` (from `js/systems/parry.js`, added in
  Task 1)

This file is solo-only (`runMatchup`/`simulateBattle` take one
`monsterStats`, never a group) — this task only changes how solo parry
is modeled, it does not add any multi-mob simulation. It has no
`npm run test` coverage by design (see its own top-of-file comment: it's
a stochastic report, not a pass/fail suite) — verification here is
running it and confirming it completes and prints a sane report.

- [ ] **Step 1: Import the cooldown constant**

Change line 45 from:

```js
import { rollIncomingDamage, resolveParrySuccess } from '../js/systems/parry.js';
```

to:

```js
import { rollIncomingDamage, resolveParrySuccess, PARRY_COOLDOWN_MS } from '../js/systems/parry.js';
```

- [ ] **Step 2: Add per-trial cooldown state**

Right after the line `let attackStreakIdleMs = 0;` (currently around
line 386, inside `simulateBattle()`), add:

```js
  let parryCooldownMs = 0;
```

- [ ] **Step 3: Decrement it every tick**

Right after the line `attackCooldownMs = Math.max(0, attackCooldownMs -
300);` (currently around line 401), add:

```js
    parryCooldownMs = Math.max(0, parryCooldownMs - 300);
```

- [ ] **Step 4: Replace the flat-probability parry check with a cooldown-gated one**

Replace the `isReady(monster.atb)` block (currently lines 412-432):

```js
    if (isReady(monster.atb)) {
      // A landed parry never touches player.hp/atb at all - mirrors
      // battleScreen.js's resolveMonsterWindup, which only ever writes
      // monster.hp/monster.atb on the parried branch (the windup clock is
      // decoupled from the ATB gauge in the real game too). Both branches'
      // result objects share the same monsterHp/monsterAtb field names, so
      // that assignment is written once below regardless of which fired.
      let result;
      if (Math.random() < parryLandRate) {
        const { damage } = rollIncomingDamage(monster, player, Math.random);
        result = resolveParrySuccess(monster, damage);
      } else {
        result = resolveMonsterAttack(monster, player, Math.random, build.thornsPercent);
        player.hp = result.playerHp;
        player.atb = result.playerAtb;
      }
      monster.atb = result.monsterAtb;
      monster.hp = result.monsterHp;
      if (player.hp <= 0) return { outcome: 'lost', hpLeft: 0, potionsUsed, ticks };
      if (monster.hp <= 0) return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
    }
```

with:

```js
    if (isReady(monster.atb)) {
      // A landed parry never touches player.hp/atb at all - mirrors
      // battleScreen.js's resolveMonsterWindup, which only ever writes
      // monster.hp/monster.atb on the parried branch (the windup clock is
      // decoupled from the ATB gauge in the real game too). Both branches'
      // result objects share the same monsterHp/monsterAtb field names, so
      // that assignment is written once below regardless of which fired.
      //
      // Cooldown-gated to match battleScreen.js's attemptParry (2026-09-02
      // multi-mob-parry-cooldown rework): an attempt is only even possible
      // off cooldown, and starts the cooldown whether it lands or not.
      let result;
      if (parryCooldownMs <= 0 && Math.random() < parryLandRate) {
        parryCooldownMs = PARRY_COOLDOWN_MS;
        const { damage } = rollIncomingDamage(monster, player, Math.random);
        result = resolveParrySuccess(monster, damage);
      } else {
        if (parryCooldownMs <= 0) parryCooldownMs = PARRY_COOLDOWN_MS;
        result = resolveMonsterAttack(monster, player, Math.random, build.thornsPercent);
        player.hp = result.playerHp;
        player.atb = result.playerAtb;
      }
      monster.atb = result.monsterAtb;
      monster.hp = result.monsterHp;
      if (player.hp <= 0) return { outcome: 'lost', hpLeft: 0, potionsUsed, ticks };
      if (monster.hp <= 0) return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
    }
```

- [ ] **Step 5: Update the stale comments describing the old model**

In the module docstring, change this bullet (currently lines 341-346):

```
 *   - The parry wind-up itself (monsters still attack the instant their ATB
 *     is ready in this simulation) - but a landed parry's outcome IS now
 *     modeled as a flat parryLandRate chance per monster attack, standing
 *     in for a human's windup-timing skill the same way TIMING_HIT_RATE
 *     stands in for ability-timing skill (see PARRY_LAND_RATE_DEFAULT below
 *     and --parry-rate in parseArgs).
```

to:

```
 *   - The parry wind-up itself (monsters still attack the instant their ATB
 *     is ready in this simulation) - but a landed parry's outcome IS now
 *     modeled as cooldown-gated (PARRY_COOLDOWN_MS, js/systems/parry.js):
 *     an attempt is only possible once off cooldown, rolling parryLandRate
 *     as a stand-in for a human's windup-timing skill the same way
 *     TIMING_HIT_RATE stands in for ability-timing skill, and the cooldown
 *     starts whether or not that roll succeeds (see PARRY_LAND_RATE_DEFAULT
 *     below and --parry-rate in parseArgs).
```

Update the `PARRY_LAND_RATE_DEFAULT` comment (currently lines 57-69) by
changing its second sentence — from:

```
// no windup/keypress to model (monsters still attack the instant their ATB
// is ready - simulateBattle rolls this chance instead, see its
// isReady(monster.atb) branch below). Every number this file produced before
```

to:

```
// no windup/keypress to model (monsters still attack the instant their ATB
// is ready - simulateBattle rolls this chance instead, gated by the same
// PARRY_COOLDOWN_MS cooldown the real game now uses, see its
// isReady(monster.atb) branch below). Every number this file produced before
```

- [ ] **Step 6: Run it and confirm it still works**

Run: `node scripts/simulate-balance.js --trials 500`

Expected: completes without throwing and prints the usual per-matchup
report table. Numbers for matchups near the edge (dragon/NG+2 hard-tier)
may now read as somewhat harder than the last time this was run, since
the cooldown is a real nerf to how often the parry payoff can fire
compared to the old uncapped-per-attack model — that's expected and is
exactly what Task 1's CHANGELOG entry already flags as unvalidated;
don't chase it further here.

- [ ] **Step 7: Commit**

```bash
git add scripts/simulate-balance.js
git commit -m "$(cat <<'EOF'
fix: model parry cooldown in the balance simulator

simulate-balance.js's solo parry modeling was a flat probability per
monster attack with no cooldown concept at all, which no longer matches
battleScreen.js's real mechanic after the previous two commits. Now
gated the same way: an attempt is only possible off cooldown, and
missing the timing roll still costs the cooldown, same as a hit.
EOF
)"
```

---

## Task 4: Version bump and final verification

**Files:**
- Modify: `CHANGELOG.md` (move the `## [Unreleased]` content from Task 1
  into a new dated `## [0.18.0]` section)
- Modify: `js/data/playerChangelog.js` (add a matching `0.18.0` entry)

**Interfaces:** None — this is documentation/versioning only, per this
repo's own `CLAUDE.md` versioning checklist (every push is a release;
`Unreleased` must be bumped into a dated section before pushing, and
`PLAYER_CHANGELOG[0]` must match).

- [ ] **Step 1: Bump CHANGELOG.md's Unreleased section into a dated version**

In `CHANGELOG.md`, change:

```markdown
## [Unreleased]

### Changed
```

to:

```markdown
## [Unreleased]

## [0.18.0] - 2026-09-02

### Changed
```

(Use the actual current date when you run this step, if it differs from
2026-09-02.) This is a MINOR bump per this repo's own versioning rule
("MINOR bumps for a completed feature/build... one bump per finished
design-doc/plan under docs/superpowers/plans/") — this plan and its
spec are exactly that.

- [ ] **Step 2: Add the matching PLAYER_CHANGELOG entry**

In `js/data/playerChangelog.js`, add this as the new first entry in the
`PLAYER_CHANGELOG` array (right after the opening `export const
PLAYER_CHANGELOG = [`, before the existing `0.17.4` entry):

```js
  {
    version: '0.18.0',
    date: '2026-09-02',
    highlights: [
      'Changed: Parry now has a 10-second cooldown instead of being usable on every attack.',
      'Changed: in fights against multiple monsters, landing a parry during that cooldown now catches every monster mid-attack at once, instead of needing to time each one\'s narrow window individually.',
    ],
  },
```

(Match the date to whatever you used in Step 1.)

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`

Expected: PASS — every test green, including
`tests/versionSync.test.js`'s two tests (confirms `PLAYER_CHANGELOG[0]`
now matches CHANGELOG.md's newest dated version, `0.18.0`, and that
`PLAYER_CHANGELOG` stays newest-first with no duplicates).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md js/data/playerChangelog.js
git commit -m "$(cat <<'EOF'
docs: changelog + version bump for parry cooldown rework (0.18.0)
EOF
)"
```

- [ ] **Step 5: Report status, do not push**

This repo deploys straight to production on push to `main` (no separate
release step) — per standing instructions, do not push without explicit
user approval. Report the four commits made and that `npm run test`
passes, and let the user decide when (and whether, after their own
live playtest) to push.
