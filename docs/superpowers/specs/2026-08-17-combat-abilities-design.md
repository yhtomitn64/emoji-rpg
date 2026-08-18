# Combat Abilities (Phase 1: Single-Target) — Design

## Purpose

Combat today is a single "Attack" button pressed every time the ATB gauge
fills — Timothy's own phrasing, "dragon warrior style." This build replaces
that with a small, level-gated set of named abilities (Stab, Chop, Slash,
Sweep, Super Scream) that layer real cooldown management, a buff-timing
"rotation," and an optional skill-timing minigame on top of the existing ATB
turn gate — closer to active combat, without discarding the ATB pacing
already in place.

This is explicitly **Phase 1 of two**. The originating idea also included
multi-enemy battles (some abilities hitting several monsters at once), but
that's a separate, comparably-sized architectural project — today's battle
screen assumes exactly one `monsterId` everywhere. Building both together
was considered and rejected: Phase 1 ships a complete, fun rotation against
today's single-monster fights; Phase 2 (multi-enemy battles, a future
project) is what lets Slash/Sweep start hitting more than one target. Slash
and Sweep are designed now so that transition is additive, not a rework.

## Scope

**In scope:**
- Five abilities, unlocked one per level-up on a fixed schedule, identical
  for every character (no player choice in unlock order):
  - Level 2 — **Stab** (single-target filler)
  - Level 4 — **Chop** (single-target finisher)
  - Level 6 — **Slash** (multi-target-shaped filler; hits the one monster
    present today)
  - Level 8 — **Sweep** (multi-target-shaped finisher; hits the one monster
    present today)
  - Level 10 — **Super Scream** (self-buff)
- Real-time cooldowns per ability, ticking independently of the ATB gauge.
- A rotation bonus: using any damaging ability while Super Scream's buff is
  active deals bonus damage.
- A timing minigame on every ability use (not on Attack): a short meter with
  a "sweet spot," hit for a bonus, miss and the ability still lands at its
  normal value. Never a hard fail — timing is upside, never a requirement.
- New pure module `js/systems/abilities.js`.
- Battle screen UI: ability buttons (with cooldown countdown), a buff
  indicator, and the timing-meter overlay.

**Out of scope (deliberately):**
- Multi-enemy battles/targeting. Phase 2, a separate future project. Slash
  and Sweep hit the single monster present, exactly like Stab/Chop, just
  with the differentiated stat profile described below — no code branches
  on "how many enemies" anywhere in this build.
- Any form of player choice in which abilities are unlocked or in what
  order — the fixed schedule above is the whole system.
- Persisting ability cooldowns or the Super Scream buff across battles, or
  in save data at all. Both are fully ephemeral, reset every battle, exactly
  like the existing ATB gauges already are.
- Wiring abilities into `scripts/simulate-balance.js`. The balance simulator
  models a much simpler always-attack AI loop; teaching it to use abilities
  intelligently is its own project, not a blocker for shipping this.
- Any boss-tier or NG+-specific ability behavior — abilities work
  identically everywhere; no special-casing.
- Sound/audio feedback — the project has no audio system today; the timing
  minigame is visual-only.

## Mechanics

### Ability roster

All values below are starting points for balance, not locked constants —
tuned via `npm test` + manual play the same way every other combat constant
in this project (`CRIT_CHANCE`, `SPEED_DAMAGE_BONUS_THRESHOLD`, the XP ramp,
etc.) has been treated: pick a reasonable start, adjust after playing it.

| Ability | Level | Type | Damage multiplier | Cooldown | Secondary effect |
|---|---|---|---|---|---|
| Stab | 2 | Single-target, filler | 1.3× | 4s | — |
| Chop | 4 | Single-target, finisher | 1.8× | 10s | — |
| Slash | 6 | Multi-shaped, filler | 1.0× | 6s | +20% of its own damage again, one tick later |
| Sweep | 8 | Multi-shaped, finisher | 1.5× | 12s | Target's defense reduced 15% for 2 of the player's turns |
| Super Scream | 10 | Self-buff | — | 30s | Player attack +40% for 12s |

Slash/Sweep are deliberately *not* re-skinned copies of Stab/Chop even
though they hit one target today (per the "different stat profile" call) —
Slash trades peak damage for a delayed second hit, Sweep trades peak damage
for softening the target up, so both already have a reason to exist before
Phase 2 gives them a second (or third) target to actually spread across.

Stab/Chop and Slash/Sweep are deliberately paired the same way: a short-
cooldown filler and a long-cooldown finisher, so a level-10 character always
has *something* worth pressing between Super Scream windows — the "rotation"
feel comes from timing the finishers and Super Scream, not from spamming a
single best button.

### Cooldowns run independently of ATB

- The ATB gauge still gates *whether you can act at all* — unchanged from
  today, still driven by `speed` via `tickGauge`.
- Each unlocked ability separately tracks its own cooldown-remaining in
  real milliseconds, decremented every existing 300ms tick
  (`battleScreen.js`'s `tick()`), regardless of ATB state. A long cooldown
  can still be counting down while several ATB-gated turns pass.
- Once ATB is ready, the player picks Attack (always available, no
  cooldown) or any ability whose cooldown has reached 0 **and** whose
  unlock level is `<= player.level`.
- Using anything — Attack or an ability — resets the player's ATB to 0,
  exactly like today's `playerAttack()`. Using an ability additionally
  resets that ability's own cooldown to its full duration.

### Rotation bonus (Super Scream synergy)

- Super Scream sets a buff-active flag and a real-time countdown (12s
  starting value) in the same per-battle ephemeral state as cooldowns.
- While the buff is active, any damaging ability (not Attack) gets an
  additional flat bonus (25% starting value) on top of its own multiplier.
- The buff's remaining time is visible in the UI the whole time it's up —
  the entire point is that a player *can* see the window and choose to hold
  Slash/Sweep for it, not that the game hides the optimal play.

### Timing minigame

- Triggered on every ability use (never on Attack). A meter animates over a
  short fixed window (~1s starting value); a highlighted "sweet spot" zone
  covers part of that window (e.g. the last 20%, rewarding a "wait for it"
  read rather than a reflex-mash).
- The player acts (click/keypress) at some point; `resolveTimingHit` is a
  pure function of *when* they acted relative to the sweet spot — testable
  without any DOM.
- Hit: damage gets a further bonus (30% starting value) on top of the
  ability's multiplier and any rotation bonus. Miss, or no input before the
  meter times out: the ability still resolves at its already-computed value
  — a miss is simply "no bonus," never a wasted turn or reduced damage
  below the ability's baseline.

### Damage composition

New `resolveAbilityUse(player, monster, ability, buffActive, timingHit, rng)`
in `abilities.js`, deliberately shaped like the existing
`resolvePlayerAttack(player, monster, rng)` in `combat.js` so
`battleScreen.js` can treat an ability result the same way it already
treats an attack result (`{ damage, isCrit, monsterHp, monsterAtb,
playerAtb }`):

1. Roll crit and base damage via the *existing* `rollCrit`/`calculateDamage`
   (reused, not reimplemented — same crit chance/variance as a plain
   attack).
2. Multiply by the ability's own `damageMultiplier`.
3. If `buffActive`, multiply by `ROTATION_BONUS_MULTIPLIER` (1.25 starting
   value).
4. If `timingHit`, multiply by `TIMING_BONUS_MULTIPLIER` (1.30 starting
   value).
5. Apply the existing `applyCritMultiplier` and
   `applySpeedDamageBonus` — abilities benefit from crit and speed
   investment exactly like a plain attack does, no separate scaling track.

Each multiplier in steps 2-5 stacks multiplicatively in that order (matches
how crit already stacks with everything else via `applyCritMultiplier`) —
there's no separate additive-bonus math to reconcile. A Chop (1.8×) landed
during the Super Scream window with a timing hit is `1.8 × 1.25 × 1.30 ≈
2.93×` a plain attack's damage, before crit/speed bonus.

## Data model

**No changes to `state` or save data at all.** Ability unlocks are a pure
function of `player.level` (`getUnlockedAbilities(level)`), not stored.
Cooldowns-remaining and the Super Scream buff are per-battle ephemeral state
living alongside `playerCombatant`/`monsterCombatant` in `battleScreen.js`
— initialized fresh in `mount()`, discarded on `unmount()`, exactly like the
ATB gauges already are. This sidesteps any save-migration question entirely.

## Wiring changes

- **New:** `js/systems/abilities.js` — pure. `ABILITIES` (ordered
  definitions), `getUnlockedAbilities(level)`, `tickCooldowns(cooldowns,
  dt)`, `resolveAbilityUse(...)`, `resolveTimingHit(...)`, and the buff-state
  helpers.
- **Modify:** `js/screens/battleScreen.js` — per-battle ability-cooldown and
  buff state; `tick()` grows to decrement both every 300ms; `updateMenu()`
  grows to render ability buttons (locked/unlocked by level, greyed with a
  countdown while on cooldown); new `playerUseAbility(abilityId)` mirroring
  `playerAttack()`; new timing-meter overlay component and its
  click/keypress handler.
- **Modify:** `css/styles.css` — ability button cooldown-overlay styling,
  buff indicator, timing-meter bar/sweet-spot/handle.
- **No changes** to `main.js` or `state.js` — nothing here needs to survive
  outside a single battle.

## Testing

- `abilities.js` (new `tests/abilities.test.js`, mirrors `combat.test.js`'s
  style — real logic, injected `rng` where randomness is involved):
  - `getUnlockedAbilities` returns the correct subset at levels 1, 2, 4, 6,
    8, 10, and above (locks in the fixed schedule).
  - `tickCooldowns` decrements every entry by `dt`, floors at 0, never goes
    negative.
  - `resolveAbilityUse` composes multiplier + rotation bonus + timing bonus
    + existing crit/speed-bonus correctly, with explicit cases for
    buff-off/timing-miss (baseline), buff-on only, timing-hit only, and both
    together.
  - `resolveTimingHit` boundary cases: exactly at the sweet-spot's start and
    end edges, clearly inside, clearly outside.
- Existing `npm test` suite continues passing unchanged — this build adds
  files, it doesn't touch `combat.js`'s existing exports.
- Manual verification (UI/feel, not automatable):
  - Level a character to 2, 4, 6, 8, and 10 and confirm each ability button
    appears at the right level, not before.
  - Use an ability, confirm its button greys out and visibly counts down
    while others (and Attack) stay usable.
  - Trigger Super Scream, confirm the buff indicator/countdown appears and
    that other abilities used during the window show visibly higher damage
    than the same ability used outside it.
  - Confirm the timing meter appears on ability use (not on Attack), and
    that a deliberately early/late/no input still resolves the ability at
    its base value rather than failing the turn.
