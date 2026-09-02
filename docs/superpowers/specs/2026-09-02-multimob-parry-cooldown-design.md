# Multi-Mob Parry Cooldown Rework — Design

## Purpose

Multi-mob parry feels clunky (backlog: "Rhythm-style multi-hit parry /
synchronized multi-mob parry bar," `docs/superpowers/BACKLOG.md`,
Combat pass ideas). Talking it through with Timothy narrowed the
complaint to three things at once: with up to 6 monsters on screen,
each running its own independent 1000ms windup with only a 100ms parry
zone at the end (`PARRY_ZONE_START/END_PERCENT` in
`js/systems/parry.js`), it's hard to track which bar is about to enter
its zone; the existing global sweep (`attemptParry` in
`js/screens/battleScreen.js`) can feel imprecise since it's not tied to
whichever monster is actually selected; and because each windup starts
independently off that monster's own ATB timer, zones rarely line up —
in practice multi-mob parry plays out as repeated solo parries with
more visual noise, not really its own thing.

The direction that resolved all three at once, and the one built here:
stop asking for precision at all once a fight has more than one
monster. A shared cooldown gates the parry key everywhere (solo and
multi-mob both); in multi-mob specifically, landing it while on
cooldown catches *every* monster currently mid-windup regardless of how
far into its windup it is — no zone to hit. The skill moves from
"time it across N independent bars" to "judge the moment to spend a
once-per-cooldown button." The same cooldown also closes a separate,
already-open balance thread — Timothy: "if you do parries correctly you
can win almost anything" — since a skilled player can no longer chain
parries back to back in solo fights either.

Explicitly not part of this build (raised in the same conversation,
parked as separate backlog items — see `docs/superpowers/BACKLOG.md`'s
"Ability rotation v2" entry under Combat pass ideas): tying the
multi-mob trigger to a not-yet-designed ability from a future rotation
redesign, and a selectable-dropdown mechanism for comparing alternate
parry designs live. Both were floated and explicitly deferred/declined
during design.

## Scope

In scope:
- A new `PARRY_COOLDOWN_MS` constant (`js/systems/parry.js`), default
  10000 — Timothy's own starting number ("10 seconds or whatever"),
  explicitly a first guess to retune after playtesting, same spirit as
  the window-narrowing constant's own comment in the same file.
- `attemptParry()` (the `s`/`S` key and the Parry button) gated by a
  shared, module-level cooldown in `battleScreen.js`, ticked down every
  300ms tick alongside every other cooldown already tracked there
  (`attackCooldownMs`, `abilityCooldowns`). Pressing it while off
  cooldown starts the cooldown immediately, whether or not it actually
  catches a monster — that's the entire anti-spam mechanism, nothing
  else needed (Timothy's own call: "the penalty being you use the
  ability and have to wait 10 seconds or whatever").
- Solo (exactly one monster alive at press time): unchanged mechanically
  from today — still requires landing inside the existing 90-100%
  window (`resolveParryAttempt`). Only the cooldown gate is new.
- Multi-mob (2+ monsters alive at press time): every monster currently
  mid-windup (`windup.active`, any elapsed percent) resolves as a full
  parry success — same payoff as today (negate the hit, reflect 50%,
  reset that monster's own attack timer via `resolveParrySuccess`) —
  with no zone requirement at all.
- The two existing per-monster mouse-click parry paths
  (`elements.monsterAtbBars[i].onclick` and
  `elements.parryHints[i].onclick` in `mount()`) share the same
  cooldown. These call `resolveMonsterWindup(mc, true)` directly today,
  bypassing `attemptParry()` entirely and its own comment block never
  mentioned them — found while tracing every parry entry point. Without
  gating these too, they'd be an unlimited-precision escape hatch
  around the whole point of the cooldown, so they're brought in scope
  even though Timothy didn't call them out directly.
- `resolveMonsterWindup` gains a way for a caller to skip its internal
  zone re-check (see Mechanics below) so the multi-mob sweep can force
  a windup to resolve as parried before it's reached its zone.
- Parry button UI reuses the existing ability/Attack cooldown-wipe
  convention (`actionButtonHtml`'s `cooldownPct`/`disabled` params,
  `.battle-ability-cooldown-wipe` in CSS) rather than inventing a new
  visual treatment.
- `scripts/simulate-balance.js`'s parry modeling, updated from "flat
  probability per monster attack" to "cooldown-gated, guaranteed once
  landed" (see Simulator implications below) — it's solo-only today, so
  this only changes how solo parries are modeled, not new multi-mob
  simulation.

Out of scope (deliberately, parked as their own backlog items):
- Tying the multi-mob trigger to ability #3 from a future ability
  rotation redesign.
- A selectable-dropdown mechanism for comparing parry variants live.
- Any change to the reflect-damage math, the negation payoff itself, or
  solo's 90-100% zone bounds.
- New multi-mob balance modeling in the simulator — it only ever
  modeled 1v1 matchups before this and still does; not building group
  simulation as part of this.
- Re-tuning the cooldown length, or re-validating existing
  dragon/NG+2-tier matchup numbers against the new model — flagged
  under Follow-ups, Timothy's own call is to playtest and tweak after
  this ships rather than pre-tune blind.

## Mechanics

### Shared cooldown

`battleScreen.js` gets two new module-level variables mirroring the
existing `attackCooldownMs`/`attackCooldownTotalMs` pair exactly:
`parryCooldownMs` and `parryCooldownTotalMs`, both reset to 0 on
mount/battle end. `tick()` decrements `parryCooldownMs` by 300 each
call, floored at 0, in the same block that already decrements
`attackCooldownMs` and calls `tickCooldowns` for abilities.

`attemptParry()` gains a guard at its top: `if (battleOver ||
parryCooldownMs > 0) return;`. If it proceeds, the very next thing it
does — before checking any monster's state — is set `parryCooldownMs =
parryCooldownTotalMs = PARRY_COOLDOWN_MS`. This is what makes a whiff
cost the same as a hit: the cooldown starts the instant the action
fires, regardless of what the sweep below finds.

### Multi-mob sweep bypasses the zone check

`resolveMonsterWindup(monster, parried)` today re-derives whether a
parry actually lands from `elapsedPercent` internally
(`if (parried && resolveParryAttempt(elapsedPercent))`) — it doesn't
trust the caller's `parried` flag as a final answer, it treats it as
"the player is attempting one." This build adds a third parameter,
`requireZone = true`: `if (parried && (!requireZone ||
resolveParryAttempt(elapsedPercent)))`. Every existing call site
(`tick()`'s natural-completion poll, the click-to-parry handlers, solo's
own path) keeps passing two arguments and gets the default
`requireZone = true`, so their behavior is unchanged. `attemptParry()`'s
multi-mob branch is the only caller that ever passes `false`.

`attemptParry()` becomes:

```js
function attemptParry() {
  if (battleOver || parryCooldownMs > 0) return;
  parryCooldownMs = parryCooldownTotalMs = PARRY_COOLDOWN_MS;
  const aliveMonsters = monsterCombatants.filter((mc) => mc.hp > 0);
  const isMultiMob = aliveMonsters.length > 1;
  for (const mc of aliveMonsters) {
    if (!mc.windup.active) continue;
    if (isMultiMob) {
      resolveMonsterWindup(mc, true, { requireZone: false });
    } else if (resolveParryAttempt(windupElapsedPercent(mc.windup))) {
      resolveMonsterWindup(mc, true);
    }
  }
}
```

`isMultiMob` is evaluated fresh on every press from however many
monsters are alive *right now* — a group fight whittled down to its
last survivor reverts to solo's precision behavior for the rest of that
fight, consistent with how every other per-monster mechanic already
treats a 1-element array as "solo," not a special case
(`docs/superpowers/specs/2026-08-21-multi-mob-encounters-design.md`).

The two mouse-click paths (`monsterAtbBars`/`parryHints` onclick) get
the same cooldown guard prepended (`if (parryCooldownMs > 0) return;`)
and, on proceeding, set the cooldown exactly like `attemptParry()` does.
They keep calling `resolveMonsterWindup(mc, true)` with the default
`requireZone: true` unchanged — clicking a specific monster stays a
precision action requiring its own zone, same as today; only the
keyboard/button sweep gets the multi-mob zone-skip.

### UI

The Parry button (`btn-parry` in `updateMenu()`) picks up the same
`cooldownPct`/`disabled` treatment `btn-attack` already has:

```js
const parryCooldownPct = parryCooldownMs > 0 && parryCooldownTotalMs > 0
  ? (parryCooldownMs / parryCooldownTotalMs) * 100 : 0;
...
actionButtonHtml({
  id: 'btn-parry',
  icon: '🛡️',
  key: 'S',
  title: <updated, see below>,
  disabled: parryCooldownMs > 0,
  cooldownPct: parryCooldownPct,
  extraClass: ' battle-parry-button',
})
```

This reuses `.battle-ability-cooldown-wipe`'s existing CSS wipe/overlay
— no new styling needed. The title text is updated to describe both
modes and append a live cooldown suffix, matching the
`${cooldownSuffix}` pattern ability tooltips already use — exact
wording is an implementation detail, not a design decision (e.g. "Parry
(S) — solo: time the red zone; group fights: catches every monster
mid-wind-up. 10s cooldown" plus a live " — Xs" suffix while on
cooldown).

### Simulator implications

`scripts/simulate-balance.js` is solo-only (`runMatchup` takes one
`monsterStats`, not a group) — this build doesn't add multi-mob
simulation, only updates how solo parry is modeled to match the new
mechanic. Today, at every `isReady(monster.atb)` event it rolls
`Math.random() < parryLandRate` with no cooldown at all — every
attack is an independent, memoryless attempt. That no longer reflects
reality once parry is cooldown-gated, so the sim needs its own
`parryCooldownMs`, ticked down by 300 in the same loop that already
ticks `abilityCooldowns` via `tickCooldowns`:

- If `parryCooldownMs > 0` when the monster is ready: always resolve as
  a normal hit (`resolveMonsterAttack`), no roll, cooldown unaffected
  (it's already ticking down).
- If `parryCooldownMs <= 0`: the simulated player always attempts (same
  "assume they try every time" stance the old model took), rolls
  `Math.random() < parryLandRate` for whether the timing lands, and
  **sets `parryCooldownMs = PARRY_COOLDOWN_MS` either way** — a missed
  attempt still cost the cooldown, mirroring the real game exactly.

`parryLandRate`'s meaning is unchanged (a stand-in for how often a
skilled player hits the 100ms window when they do attempt it) — only
how often an attempt is even possible changes. The CLI flag's own
`--parry-rate` help text and the file's module docstring (both describe
today's "flat chance per attack" model) need a matching update so they
don't describe stale mechanics.

**Not done here:** re-running the existing dragon/NG+2-tier matchup
numbers under this new model. The whole point of narrowing the window
to 100ms (`js/systems/parry.js`'s own comment, 2026-09-01) was tuned
against the *old* unlimited-attempts assumption; a cooldown is a much
bigger nerf to how often the payoff can fire at all, so those matchups
may now read as harder than intended. Flagged under Follow-ups —
Timothy's explicit call was to ship this and retune from real play
rather than guess numbers now.

## Testing

`tests/parry.test.js` covers the pure `js/systems/parry.js` functions
today (windup timing, zone resolution, reflect math) — add coverage for
`resolveParrySuccess`/`resolveParryAttempt` being called with the new
`requireZone` semantics is actually a `battleScreenDom.test.js`-level
concern since `requireZone` lives on `resolveMonsterWindup` in
`battleScreen.js`, not in the pure module.

`tests/battleScreenDom.test.js` already has real-time parry tests
(windup persistence, click-vs-keydown parity, the PARRY! badge) that
the 0.17.4 fix made poll for actual windup start time rather than
hardcoded waits — new cases follow that same pattern:
- A second `s` press within the cooldown window does nothing (no
  monster's windup resolves, HP/ATB unchanged) even if a monster is
  sitting in its zone.
- In a 2+ monster fight, pressing `s` while a monster is mid-windup but
  *below* 90% elapsed still resolves it as a full parry (this is the
  actual behavior change under test — the whole reason for this build).
- The Parry button shows a cooldown wipe/disabled state matching
  `btn-attack`'s existing pattern immediately after a press.
- The per-monster click-to-parry path (`monsterAtbBars`/`parryHints`)
  is also blocked while `parryCooldownMs > 0`.

## Follow-ups (explicitly not resolved by this build)

- Retune `PARRY_COOLDOWN_MS` (and possibly the dragon/NG+2 matchup
  numbers it may have quietly invalidated) against real play, per
  Timothy's own "I can test it all out later and tweak."
- Ability rotation v2 (`docs/superpowers/BACKLOG.md`) may eventually
  want to trigger multi-mob parry from a specific ability instead of
  (or alongside) the standalone key — explicitly deferred, not this
  build.
