# Buff potions — design

**Status:** approved for planning
**Session:** 2026-08-31 brainstorming, following up on the "excess gold
sink" backlog item (`docs/superpowers/BACKLOG.md`, "Quests / economy")

## Problem

Player gold outpaces spending well before end-game: shop gear tops out
~45g, the full smith-upgrade path is ~120g total per item, and gold
drops keep climbing with monster tier/NG+. Direction chosen: add a new
gold sink rather than reduce income (see BACKLOG.md's "Direction
decided" note). Landed on **buff potions** specifically because, unlike
purchasable higher-tier gear, they're temporary — no risk of
outclassing earned/reforged gear, which was an explicit concern raised
and set aside this session (see BACKLOG.md's "NG+-scaled purchasable
store gear" entry).

This also satisfies the trigger condition already recorded in
BACKLOG.md's "Item selection menu for the Item button" entry
(2026-08-31): "revisit once/if a second consumable item type is added."

## Roster

10 new consumable items (`type: 'consumable'`) in `js/data/items.js`,
alongside the existing `potion` (heal) entry. Effect fields mirror the
`STAT_KEYS` shape gear already produces via `getEquipmentBonuses()`
(`js/systems/inventory.js:9`), so a timed buff is structurally the same
kind of bonus object equipment already contributes — just temporary.

| id | Name | Effect | Kind | Duration | Price |
|---|---|---|---|---|---|
| `strengthDraught` | Strength Draught | +attack | timed | 12s | 35g |
| `ironSkinTonic` | Iron Skin Tonic | +defense | timed | 12s | 35g |
| `swiftElixir` | Swift Elixir | +speed | timed | 12s | 30g |
| `vampiricTonic` | Vampiric Tonic | +lifestealPercent | timed | 12s | 35g |
| `momentumElixir` | Momentum Elixir | +extraSwingChance | timed | 12s | 40g |
| `emberVial` | Ember Vial | +elementalProcChance/Damage | timed | 12s | 40g |
| `thornbarkDraught` | Thornbark Draught | +thornsPercent | timed | 12s | 30g |
| `focusTonic` | Focus Tonic | +critChancePercent | timed | 12s | 35g |
| `berserkerTonic` | Berserker Tonic | guaranteed crit on next hit | one-shot | instant | 60g |
| `secondWind` | Second Wind | survive lethal damage at 1 HP (once) | one-shot | instant, consumed on trigger | 120g |

Exact bonus magnitudes (e.g. how much +attack) are a balance-pass detail
for implementation, not this design — should land in the same rough
power range as a single equipped accessory's bonus (per `js/data/items.js`
existing accessories), since that's what the player is temporarily
approximating.

## Loadout system

New persisted state: `state.loadout` — a 4-element array of
`itemId | null`, alongside `state.equipment` in the save shape.

UI lives in the existing Inventory screen's Potions tab
(`js/screens/inventoryScreen.js:20`, `TABS` config) — no new screen.
Each potion row (including the existing heal `potion` item, which folds
into the loadout like any other consumable) gets four small numbered
toggle buttons `①②③④`. Clicking one assigns that potion to that slot,
bumping out whatever was there before. A row shows which slot(s) (if
any) it currently occupies.

## In-battle quick-select

The existing `i` key / Item button (`js/screens/battleScreen.js:615`,
currently hardcoded to `resolvePotionUse(playerCombatant, ITEMS.potion.heal, ...)`
at line 1417) changes behavior: instead of instantly drinking the heal
potion, it opens a quick-select overlay showing the 4 loadout slots.
Input: `1`-`4` keys, arrow keys + Enter, or click. `Escape` cancels
with no potion consumed and no time lost.

This is the feature already anticipated in BACKLOG.md's "Item selection
menu for the Item button" entry, including the "ring of stuff" /
radial-picker mental image Timothy described there and again this
session.

### Slow motion while the menu is open

Full pause (reusing `pauseBattle()`/`resumeBattle()` verbatim,
`js/screens/battleScreen.js:1602`) was considered and rejected — it
removes all urgency from the choice. Instead: **~25% time scale** while
the menu is open.

Implementation approach: add a `timeScale` parameter to
`pauseBattle()`/`resumeBattle()` (default `0`, i.e. today's full-stop
behavior; `0.25` for the quick-select case) rather than building a
parallel system:
- The 300ms tick interval, monster windup/animation durations, and the
  active timing-meter all run at the scaled rate instead of stopping.
- On close (selection made or cancelled), reverse the scaling using the
  same "shift the wall-clock start forward by elapsed-at-scale" pattern
  `resumeBattle()` already applies to windups via `shiftWindupStart`
  (`js/systems/parry.js`) — generalized to account for the scale factor
  instead of assuming a full stop.

## Applying buffs

### Timed buffs — stacking

Drinking a second timed buff while one is already active **stacks**
rather than replacing it (explicit decision this session). This
generalizes the existing single-slot `buffState` pattern
(`js/systems/abilities.js:87-98`, today used only for the Super Scream
ability buff) into a small array of active buff entries, each with its
own remaining duration, ticked every 300ms same as today.

A new combined-bonus step merges all currently-active buff entries'
stat contributions (same `STAT_KEYS` shape as gear) into a single
object, added on top of `playerEffectBonuses` (computed once per battle
today at `js/screens/battleScreen.js:1693`). Every combat-resolution
call site that currently reads `playerEffectBonuses.<stat>` directly
(damage/lifesteal/crit/extra-swing/elemental-proc/thorns —
`js/screens/battleScreen.js:146,150,1157,1218,1330,1365,1417,1462`)
switches to reading the combined value instead. Super Scream's existing
buff stays on its own separate path (it's an ability-outcome buff, not a
stat bonus) — unaffected by this change.

### One-shots

- **Berserker Tonic** sets a `guaranteedCritNextHit` flag on drink. The
  next player attack (any of the `critChanceBonus` call sites above)
  checks the flag first — if set, treat as a 100% crit roll and clear
  the flag after that one resolution, regardless of what the flag would
  otherwise compute.
- **Second Wind** sets a `secondWindAvailable` flag on drink (one per
  battle — its slot shows as disabled/unselectable in the quick-select
  menu once the flag is already set, so a second copy can't be wasted).
  Checked once, right after `playerCombatant.hp` is updated
  from a monster attack (`js/screens/battleScreen.js:1463`) and before
  the defeat check (`js/screens/battleScreen.js:1513`): if HP would be
  `<= 0` and the flag is set, set HP to `1` instead and clear the flag.

Both flags reset at battle start alongside `buffState`
(`js/screens/battleScreen.js:1696`).

## Potion drops

Small addition to `rollDrop()` (`js/systems/loot.js:45`): an
independent flat ~8% chance per kill (comparable in shape to
`EQUIPMENT_DROP_CHANCE`, `js/systems/loot.js:9`, though not sharing its
"one bonus item per kill" slot — potions are additive, not competing
with equipment/unique-effect rolls) picks a random potion from the
10-item roster, weighted toward the cheaper timed buffs and rarer for
the two one-shots.

## Out of scope (deferred this session)

- Purchasable higher-tier / NG+-scaled store gear — needs its own
  design pass for how it avoids outclassing earned gear. See
  BACKLOG.md.
- An NG+ pass across all gear drops (not just a purchasable tier) — big
  idea, own future session. See BACKLOG.md.
- Making crafting materials more useful (extra stats on maxed gear,
  stat rerolls) — separate problem, explicitly set aside by Timothy
  this session. See BACKLOG.md.

## Testing

- Unit coverage for the combined-bonus merge (multiple stacked timed
  buffs + gear bonuses summing correctly, expiry removing a buff's
  contribution).
- Unit coverage for both one-shot flags (guaranteed crit consumed
  exactly once; Second Wind triggers exactly once at lethal HP, doesn't
  trigger below-zero-but-flag-absent, doesn't stack a second charge
  while one is already available).
- Loadout persistence round-trips through save/load like `state.equipment`
  does today.
- Existing battle/combat/inventory test suites (`tests/`) should keep
  passing unchanged except where they assert on the old direct-drink `i`
  key behavior, which becomes the quick-select-open behavior instead.
