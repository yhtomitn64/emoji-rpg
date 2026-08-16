# Savage Early Game — Design

## Purpose

The just-shipped Player Growth Curve Rework deliberately left levels 1-9 untouched, deferring the other half of the "game is too easy" concern: the monster roster itself is soft from the very first fight. This build makes the whole game — near-town, far-corner, dungeon, and the dragon — feel meaningfully dangerous, evoking the classic Dragon Warrior loop the user described: grind, gear up, push the frontier out a little, retreat when it gets too hard, repeat. Buying at least minimal armor stops being optional; near-town monsters become a real threat requiring real potion use; and the escalation from near-town → far-corner → dungeon → dragon holds all the way through instead of inverting.

## Scope

**In scope:**
- Retuned HP and attack (minor defense adjustments where noted) for all 9 non-boss-tier monsters: boar, bat, snake, goblin, direWolf, spider, orc, wraith, and the dragon's base stats.
- Proportionally increased XP/gold rewards for all 9, so a harder fight pays off more, not the same as before for triple the risk.

**Out of scope (deliberately):**
- `calculateDamage`'s formula itself — unchanged, only the stat inputs to it move.
- Starting gold (20g) and the potion economy (2 starting potions, 10g each, 15hp heal) — validated via simulation as already producing the intended tension with no changes needed.
- The player growth curve (already shipped separately) and the boss-tier/NG+ multiplier systems (untouched — they multiply on top of whatever the dragon's base stats are, so a bigger base just gives them a proportionally bigger foundation, no redesign needed).
- Any change to monster speed, emoji, names, or drop tables.

## Mechanics

### Monster stats

Every number below was validated by simulating real fights (reusing the actual `calculateDamage`/`applyXp`/`getEquipmentBonuses` code, not a re-implementation) against a player build appropriate to when they'd realistically first meet that tier — not just multiplied blindly off the old numbers, several early attempts at simple multipliers produced literally unwinnable fights (0% win rate) that only surfaced once actually simulated.

| Monster | HP (was) | Attack (was) | Defense (was) | Tested build | Win rate | HP left on win | Potions used |
|---|---|---|---|---|---|---|---|
| boar | 77 (17) | 10 (4) | 1 (unchanged) | L1 + cloth tunic | 62% | 20% | 2.0 of 2 |
| bat | 55 (11) | 9 (3) | 0 (unchanged) | L1 + cloth tunic | 83% | 35% | 1.9 of 2 |
| snake | 60 (14) | 10 (5) | 1 (unchanged) | L1 + cloth tunic | 74% | 22% | 2.0 of 2 |
| goblin | 67 (21) | 10 (6) | 2 (unchanged) | L1 + cloth tunic | 56% | 18% | 2.0 of 2 |
| direWolf | 100 (30) | 14 (8) | 3 (unchanged) | L4, 2-piece armor | 100% | 54% | 1.6 of 3 |
| spider | 85 (25) | 12 (7) | 2 (unchanged) | L4, 2-piece armor | 100% | 62% | 0 of 3 |
| orc | 180 (40) | 32 (26) | 8 (unchanged) | L9 full iron | 100% | 48% | 2.1 of 6 |
| wraith | 170 (38) | 32 (26) | 4 (unchanged) | L9 full iron | 100% | 50% | 3.0 of 6 |
| dragon | 150 (110) | 34 (unchanged) | 12 (unchanged) | L9 full iron | 87% | 20% | 6.0 of 6 |
| dragon | (same) | (same) | (same) | L11 full iron | 100% | 46% | 3.8 of 6 |

A bare starter-sword character with zero armor loses to even a boar 0% of the time, and loses within ~6 hits — a fast, clear signal to buy armor first rather than a long punishing grind toward an inevitable loss.

Note the dragon barely needed an attack increase (34, unchanged from today) — the "too easy" problem there was mostly about fight *duration* giving too little exposure to risk, not raw per-hit danger. Extending its HP alone (110→150) was enough to turn a stomp into a real fight at first approach, while still being winnable-with-effort at a higher level. **The user's own instinct going in was that the dragon might still need to be harder than this** — noted explicitly as a candidate follow-up tuning pass after this ships and gets played, not resolved further in this build.

### Reward scaling

Reward multipliers taper as the stat increases get more extreme, so a fight that got proportionally *much* harder (near-town) pays proportionally more than one that only got modestly harder (dragon) — and so the overall XP curve's pacing through levels 1-9 (already carefully tuned in the just-shipped growth-curve rework) doesn't get blown out by suddenly-huge per-kill XP:

| Monster | XP (was) | Gold range (was) |
|---|---|---|
| boar | 16 (8) | 4-8 (2-5) |
| bat | 11 (6) | 2-7 (1-4) |
| snake | 16 (9) | 4-9 (2-6) |
| goblin | 22 (12) | 5-13 (3-8) |
| direWolf | 32 (20) | 8-15 (5-10) |
| spider | 29 (18) | 7-14 (4-9) |
| orc | 60 (40) | 18-28 (12-20) |
| wraith | 63 (42) | 18-30 (12-22) |
| dragon | 200 (150) | 65-100 (50-80) |

These are a starting point, not locked numbers — see Testing below for how they get validated before shipping.

## Data model

No save-schema changes — only static data in `js/data/monsters.js` changes (hp/attack/defense/xp/goldRange fields on existing monster entries). No migration/backfill needed.

## Testing

- `tests/data.test.js` already has a general `MONSTERS` shape test (`'every monster has required fields and a valid drop table'`) that validates `hp > 0`, `goldRange`, and that every `dropTable` entry references a real item — this already re-runs cleanly against the new numbers since only the numeric fields change, not the shape. It should gain one more assertion: every quest-eligible monster (from `js/systems/quests.js`'s `QUEST_REQUIREMENTS`) still has at least one `type: 'material'` entry in its `dropTable` — `dropTable` itself isn't touched by this build, but it's the kind of cross-cutting assumption (Quest Board's reward derivation, NG+'s drop-chance scaling) worth locking in given how much else now reads `MONSTERS` data.
- `scripts/simulate-balance.js`'s existing `MATCHUPS` (currently `['orc', 'wraith', 'dragon']`) and `BUILDS` array should be extended to also cover the near-town and far-corner tiers against level-appropriate builds (mirroring the ad-hoc validation builds used during this brainstorm — L1 with a single cheap armor piece, L4 with two pieces), so this project's standing balance tool covers the whole roster going forward, not just the dungeon/boss tier it was originally written for.
- Before shipping, run the extended simulator and confirm the numbers in the Mechanics tables above still land in the intended "genuinely at-risk, not a wall" zone (roughly 50-90% win rate, meaningful potion usage, not 0% or 100%-with-full-HP) — if real implementation nudges any monster's exact numbers, that's expected iteration, not a plan violation.
- No test directly asserts overall XP-to-level *pacing* (e.g. "it should take N fights to reach level 5") — that's a subjective feel question best validated by actually playing, not a simulator assertion.

## Non-goals confirmed with user

- No changes to `calculateDamage`, starting gold, or the potion economy.
- No changes to monster speed, names, emoji, or drop tables.
- Dragon may need further toughening in a future pass — explicitly not resolved now.
