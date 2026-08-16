# Player Growth Curve Rework — Design

## Purpose

Playtesting at level 10 found the game trivialized: a level-9 character in nothing but basic shop gear (no smith upgrades) beats the dragon 100% of the time with 41% HP left, per `scripts/simulate-balance.js`. The mechanical cause is unbounded linear player growth (+2 attack/+1 defense/+4 maxHp *every* level, forever) against a fixed monster roster — nothing except the dragon (via its own separately-shipped boss-tier/NG+ systems) ever gets harder. This build fixes the growth curve itself, the root cause, rather than adding new content on top of a curve that would keep outrunning it.

## Scope

**In scope:**
- Tapering per-level stat gains starting at level 10.
- Steepening the XP curve starting at level 10.
- Switching level-up HP recovery from full heal to partial heal, starting at level 10.
- All three keyed off the same single breakpoint (level 10) — the exact level the original playtesting complaint was raised at.

**Out of scope (deliberately):**
- Levels 1-9: completely unchanged (same stat gains, same XP curve, same full heal) — this range is already tuned, matches the simulator's existing validated builds, and nobody has raised a concern about it.
- Any change to `calculateDamage`, monster stats, or the smith/shop economy.
- Making regular (non-dragon) monsters scale with the player — that's the deliberately separate, sequenced-next "Content Scaling" project.
- The other backburnered combat ideas (golf-swing ATB timing, active-ability rotation, multi-enemy battles) — unrelated to this specific curve-rework project.

## Mechanics

### Stat gain tapering

`applyXp`'s per-level growth becomes level-dependent instead of a flat constant:

| Level reached | maxHp | attack | defense | speed |
|---|---|---|---|---|
| 2-9 (unchanged) | +4 | +2 | +1 | +1 |
| 10+ | +2 | +1 | +1 | +1 on even levels only, +0 on odd |

This halves the two stats most directly responsible for trivializing fights (attack, maxHp) once past the observed breakpoint, while defense stays flat (defense's impact is already bounded by `calculateDamage`'s `max(1, attack - defense)` floor, so halving it further would make it nearly worthless) and speed — which only affects turn order, not power creep — merely slows its cadence rather than its total growth.

### XP curve steepening

`xpForLevel(level)` stays exactly `Math.round(10 * level ** 1.5)` for levels below 10. From level 10 on, a compounding ramp is layered on top rather than swapping to a different exponent outright — a hard exponent swap right at the boundary would create a sudden 2.5x XP cliff at exactly level 10, which reads as a wall rather than a gradual slowdown:

```
xpForLevel(level) = base(level)                                  , level < 10
                   = round(base(level) * (1 + (level - 9) * 0.08)), level >= 10
```

where `base(level) = round(10 * level ** 1.5)` (the existing, unchanged formula). At level 10 this is only a ~8% increase over today's requirement (barely noticeable); by level 20 it compounds to roughly 88% more XP than today's curve would require. `0.08` is a starting value, not a locked constant — see Testing below for how it gets validated before this ships.

### Partial heal on level-up

Today, any level-up fully heals (`hp = maxHp`). From level 10 on, a level-up instead restores only a fraction of missing HP:

```
newHp = round(oldHp + (newMaxHp - oldHp) * 0.5)
```

using the player's HP *before* this level-up and the *new* (post-level-up) max. Levels 2-9 keep the existing full-heal behavior unchanged. This directly matches the reasoning already in the backlog: full heal makes sense while levels come at today's pace; partial heal makes sense once they're meaningfully rarer — which the XP steepening above makes true, but only past level 10.

**Multi-level jumps:** `applyXp`'s existing `while` loop can cross several levels in one XP award (e.g. a big quest turn-in). The heal decision is made once, after the loop, same as today's single `hp = leveledUp ? maxHp : player.hp` computation — based on the *final* level reached: if it's still under 10, full heal (matches today exactly); if it's 10 or higher, partial heal using the original pre-award HP and the final new maxHp, even if the climb started below 10.

## Data model

No save-schema changes — the player object's shape is untouched, only the formulas that populate it. No migration/backfill needed.

## Testing

- `tests/leveling.test.js`: extend with — `xpForLevel` unchanged for levels 2-9 (exact values matching today's formula); `xpForLevel` visibly steeper at level 10+ (exact values against the ramp formula above); `applyXp` reaching level 9 still gets today's gains and a full heal (locks in the "1-9 unchanged" guarantee); `applyXp` reaching level 10 gets the halved gains and a partial (not full) heal; a multi-level jump that starts below 10 and ends at or above 10 gets partial heal based on final maxHp, not full heal; speed only increments on even levels once in the 10+ tier.
- Before this ships, run `node scripts/simulate-balance.js` with the reworked `leveling.js` in place (the script already drives the real `applyXp`/`xpForLevel` via `playerAtLevel`, so no script changes are needed to pick up this rework) and confirm the existing named builds' win rates move in the intended direction — earlier builds (`prepared L9`) should be unaffected since level 9 is unchanged; later ones (`veteran L11`) should show a visible reduction from today's 100% win / 52% HP-left dragon result, without swinging so far the other way that leveling past 10 stops feeling rewarding at all. If the `0.08` XP ramp or the level-10 stat halving over- or under-shoots, adjust those two constants and re-run — this is the same iterate-against-the-simulator process this project already used to tune monster stats, just applied to the player side this time.

## Non-goals confirmed with user

- No changes below level 10.
- No damage-formula changes.
- No monster-side scaling (separate future project).
- Exact XP ramp/stat-halving constants are starting points, tuned against the real simulator during implementation, not hand-locked in this doc.
