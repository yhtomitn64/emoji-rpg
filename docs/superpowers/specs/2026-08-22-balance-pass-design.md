# Player-Power Balance Pass — Design

## Purpose

Timothy, 2026-08-22, after the ability-rotation redesign and the Attack-spam exploit fix: "game seems too easy now with all the abilities so we will need to address this and make stuff harder or abilities weaker... I don't even need gear. So even after that exploit is fixed we need to make gear matter, potion use matter, and using abilities matter until you can easily overpower enemies. Need to slow down leveling up a bit too."

`scripts/simulate-balance.js` — this project's established source of truth for "is this actually fair" rather than gut-feel tuning — currently cannot see the problem: it only simulates plain Attack, with no ability use, no combo bonuses, and none of the streak/knockback decay just shipped for the exploit fix. Every past balance finding in this project's history was validated against that simulator; this one currently can't be, which is itself part of why abilities shipped able to trivialize combat without it showing up in any report. This build closes that blind spot first, then tunes against real numbers instead of guessing.

## Scope

**In scope:**
- Extending `scripts/simulate-balance.js` to model the player's real ability rotation (Stab/Chop, Slash/Sweep combo lanes, Super Scream buff window, post-exploit-fix Attack streak behavior) instead of plain-Attack-only.
- Re-baselining every existing simulator matchup (near-town, far-corner, dungeon-tier, all 3 boss tiers) against the extended simulator to see the real current state.
- Tuning ability damage multipliers and/or cooldowns and/or combo bonus size, sized against that data to hit the target below.
- Steepening `xpForLevel` (currently `10 * level^1.5`, with an existing level-10+ ramp from the prior growth-curve rework) to slow leveling pace.
- Re-checking the no-gear vs. full-gear win-rate delta after ability tuning, and only touching item stats (`js/data/items.js`) directly if that gap is still too small.
- Re-checking potion usage rates after ability tuning, and only touching the potion mechanic itself (heal amount, the already-backlogged crit-heal idea) if fights still aren't costing enough HP to need them.

**Out of scope (deliberately, per Timothy's explicit call):**
- Any monster-side stat changes (HP/attack/defense/speed) — the standing decision from the "player outpaces near-town content" backlog thread (zone 1 should keep getting *easier* over time, not scale to track the player) still holds. This pass reduces player power, it does not raise monster power.
- The Attack-spam exploit itself — already fixed and deployed separately before this pass started.
- Any new content, zones, or systems.
- Multi-mob encounter balance specifically (already its own shipped system) beyond whatever falls out naturally from the ability/leveling changes above.

## Phase A — see the real numbers

### Simulator extension

`simulateBattle()`'s per-tick player action is currently unconditional plain Attack the instant the gauge is ready. This becomes a policy, mirroring how the existing potion policy ("drink below 40% HP") is already a hand-rolled AI stand-in layered on top of the real shared combat functions:

1. Track per-simulated-player cooldowns (`abilityCooldowns`), combo state (`comboState`), buff state (`buffState`), and Attack streak — same shape as `battleScreen.js`'s own module-level state, reset per battle.
2. Each tick, in priority order: if Super Scream is off cooldown and the buff isn't already active, use it (it's free and strictly beneficial — matches how a reasonable player would use it). Otherwise, if a primed combo payoff (Chop/Sweep) is available, use it (biggest available action). Otherwise, if any other unlocked ability is off cooldown and the gauge is ready, use the highest-unlocked one. Otherwise, Attack.
3. A timing-hit assumption stands in for a human's actual meter timing, since the simulator has no real input timing to model — call it `TIMING_HIT_RATE`, applied as a coin-flip on abilities that still have the meter (Stab/Slash only, post-combo-rework). Starting value 0.7 (a reasonably-attentive player hits the sweet spot most of the time, not always) — not locked; if Phase B's results feel too sensitive to this one assumption, it's worth a sanity check at 0.5 and 0.9 too before finalizing other constants around it.
4. `resolvePlayerAttack`/`resolveAbilityUse` are still called exactly as shipped — same principle as the existing potion/monster-turn logic: the *policy* (when to act) is simulated, the *math* (what happens when you do) is not reimplemented.

This is new simulator logic, not new game logic — `js/systems/abilities.js` and `js/screens/battleScreen.js` are unchanged in this phase.

### Diagnostic report

Run the extended simulator across the existing `BUILDS` list (unchanged) against all `MATCHUPS`, plus the 3 boss tiers. Read the output for: current win rate, HP left on win, potions used, and specifically the win-rate delta between a build with no armor and the same build with its era-appropriate gear — this last number is the concrete measure of "gear doesn't matter right now."

## Phase B — tune against that data

Not decided here — deliberately. Like the prior growth-curve rework's XP ramp constant, exact multiplier/cooldown/curve changes are starting points tuned iteratively against the real simulator output during implementation, not hand-picked in this doc. What *is* fixed:

- **Target**: roughly 80-90% win rate for a reasonably-geared, level-appropriate build (the existing named `BUILDS` entries, e.g. `reasonable L7 (iron sword + full cloth)`) in wilderness fights (near-town and far-corner), with potions consumed in roughly 30-60% of those trials — enough to be a real factor, not so much it reads as barely-surviving — checked at every existing tier including dungeon-tier and all 3 boss tiers, not just wilderness.
- **Levers available, in likely order of impact**: ability damage multipliers (`js/systems/abilities.js`'s `damageMultiplier` per ability), ability cooldowns, the combo bonus multipliers (`COMBO_PAYOFF_BONUS_MULTIPLIER`/`COMBO_RETURN_BONUS_MULTIPLIER`), the XP curve (`js/systems/leveling.js`'s `xpForLevel`), and — only if the gear-delta/potion-usage checks above still come up short after the ability/leveling changes — item stats (`js/data/items.js`) or the potion heal amount (`ITEMS.potion.heal`).
- **Process**: adjust one lever, re-run the simulator, compare against target, repeat — the same iterate-against-the-simulator loop the growth-curve rework used, just with more levers in play at once since they interact (weaker abilities *also* slow effective leveling by extending fight length, for instance).

## Data model

No save-schema changes anywhere in this pass — every lever is a formula/constant/multiplier, not new state shape. No migration needed.

## Testing

- Phase A: the extended simulator itself has no pass/fail assertions (it's a stochastic report, same as today — this is why it lives in `scripts/`, not `tests/`, per the file's own existing header comment). Its correctness is checked by confirming its ability-usage policy actually reflects the real unlock/cooldown/combo rules (e.g. a level-3 simulated player never uses Chop, a primed Chop fires before the swing timer if the policy is working) via spot-checks of its own logged trial data, not new automated tests.
- Phase B: existing `tests/leveling.test.js`, `tests/abilities.test.js`, `tests/combat.test.js` get updated/extended to lock in whatever specific constants Phase B lands on (mirroring how the growth-curve rework's test additions worked) — new tests are not written speculatively before the numbers are chosen.
- Before shipping: re-run `npm run test` (full suite, must stay green) and the simulator one final time to confirm the target win-rate/potion-usage/gear-delta numbers are actually met across every tier, not just wilderness.
- After shipping: a live in-browser playtest pass (not just the simulator) to confirm the change *feels* right, not just that the numbers hit target — the simulator's AI policy is a stand-in for a human, not a human.

## Non-goals confirmed with user

- No monster-stat changes — player-power-only, per explicit call.
- Dungeon-tier and boss content are in scope for the *check*, not exempted like a prior pass exempted them.
- Target is real attrition with rare losses (~80-90% win rate), not a harsh swing to frequent losses.
- Exact multiplier/cooldown/XP-curve constants are intentionally undecided here — they're Phase B outputs, tuned against real simulator data, not guessed in advance.
