# NG+ Gear Progression & Gold Sink — Design

**Status:** Approved by Timothy, ready for implementation planning.

## Problem

Two backlog items (`docs/superpowers/BACKLOG.md`) converge on the same
underlying gap:

1. **Gold sink.** Shop gear tops out around 45g and the full 3-level
   smith upgrade path costs at most ~120g per item. Timothy is sitting
   on 3k+ gold with nothing left to spend it on.
2. **NG+ gear ceiling.** Gear power caps hard: effective stats are
   `base × tierMultiplier × (1 + 0.25 × upgradeLevel)`, and both axes
   are maxed (`QUALITY_TIER_MULTIPLIERS.superior = 1.20`,
   `MAX_UPGRADE_LEVEL = 3` → 1.75×), for a ceiling of **2.1× base,
   full stop**. Meanwhile `getNgPlusCombatOverrides` keeps scaling
   monster HP (×2 per cycle) and attack/defense (×1.25 per cycle)
   every NG+ cycle regardless. A maxed-out player gets *relatively
   weaker* each cycle — the opposite of what NG+ should feel like.
   Timothy, hitting this directly: "I can't upgrade any more and
   that's no fun. So I can't really tear apart enemies as fast as I
   want."

Timothy's own steer (2026-08-30): solve both with one system — new
NG+-gated gear headroom that's expensive enough to also drain the gold
surplus — plus "spice things up" with a few genuinely new items rather
than only re-tiering what exists.

## Solution overview

Four pieces, all gated to `state.ngPlusCycle >= 1` (i.e., nothing here
is reachable before a player has started their first NG+ cycle):

1. A new **Mythic** quality tier, above today's Plain/Fine/Superior.
2. Two acquisition paths for it: **drop luck** (extends the existing
   toughness-weighted roll) and **smith reforge** (gold + a new
   material, spends the gold surplus directly).
3. Two new **NG+-exclusive unique-effect items**: Retribution Charm
   and Windfury Ring.
4. Two new **ring slots** (`ring1`, `ring2`), alongside the existing
   `weapon`/`head`/`body`/`legs`/`accessory` slots — available from a
   new save on, not NG+-gated themselves, but the items that fill them
   mostly are.

## 1. Mythic quality tier

Extends the existing tier system in `js/systems/itemQuality.js` rather
than adding a new stat axis — everything downstream (per-tier upgrade
tracking via `upgradeKey(itemId, tier)`, tooltips, equipment bonus
math) already generalizes over `tier` as a string, so a fourth tier
value is a small, low-risk addition:

- `QUALITY_TIER_MULTIPLIERS.mythic = 1.35` (vs. Superior's 1.20).
  **Starting hypothesis, not a final balance number** — verify with
  `scripts/simulate-balance.js` the same way every other stat-curve
  change in this repo's history has been checked, before and after
  this ships.
- `tierLabel('mythic')` returns `'Mythic '`.
- A fully maxed Mythic item (tier 1.35 × upgrade-level-3's 1.75×) tops
  out at **2.3625× base**, vs. Superior's current 2.1× ceiling — a
  real but modest bump per slot, meant to be tuned via playtesting,
  not assumed correct on paper.

### Acquisition path A — drop luck (regular kills + named drops)

`rollQualityTier` (`itemQuality.js`) and `rollDrop` (`js/systems/
loot.js`) gain an `ngPlusCycle` parameter. When `ngPlusCycle >= 1`, a
toughness-weighted mythic-chance roll (e.g. `lerp(0.005, 0.02,
toughness)`) runs before today's Fine/Superior roll. This is the same
code path today's Fine/Superior rolls already use for *both* generic
equipment drops and named drops like Goblin Club (`rollDrop`'s
`monster.dropTable` branch already re-rolls quality for any
`ITEMS[item].slot` item) — so named drops get Mythic eligibility for
free, no separate mechanism needed.

`state.ngPlusCycle` is already in scope at all three `rollDrop(...)`
call sites in `js/main.js` — this is a one-line threading change at
each.

### Acquisition path A2 — boss/dragon drops (separate mechanism)

Bosses are deliberately excluded from `rollQualityTier` entirely today
(`isToughnessEligible` returns `false` for `monster.isBoss`), so
dragon drops (`dragonScaleMail`, `dragonFang`) never carry a tier. Add
a small, separate roll scoped to `monster.isBoss && ngPlusCycle >= 1`
in `rollDrop`: on a dragon kill, roll a chance (proposed: flat 25%,
tunable) to tag the named drop's `tier` as `'mythic'` directly, no
toughness weighting needed (a boss fight has no meaningful toughness
comparison to the regular roster). This directly answers the
already-open backlog question "Should the dragon drop better items in
NG+?"

### Acquisition path B — smith reforge

A new per-slot action in `js/screens/smithScreen.js`: when a slot's
equipped item is currently Superior tier and `ngPlusCycle >= 1`, show
a "Reforge to Mythic" option alongside the existing Upgrade button.

- Cost: **400g + 3× Mythic Essence** (new material item, proposed
  starting numbers — tunable). Five slots × 400g ≈ 2000g to fully
  reforge a kit, a real dent in a 3k+ surplus.
- **Mythic Essence** (`js/data/items.js`): `type: 'material'`, no
  `upgradeSlot` (collected generically, not per-slot, since reforge
  isn't the same flow as `materialOptionsForSlot`'s per-slot upgrade
  picker). Drops via the same toughness-weighted mechanism as path A,
  gated the same way (`ngPlusCycle >= 1`), at a moderate rate (e.g.
  `lerp(0.02, 0.06, toughness)`) since it's meant to be a findable
  farming goal, not a rare-rare drop — this is what actually answers
  "NG+ loot feels stale," giving NG+ kills something new to look for
  independent of whether Mythic drop-luck itself procs.
- Reforge only applies to an *equipped* Superior item (not Fine/Plain)
  — you must already have found a Superior copy before reforging is
  available. `upgradeKey(itemId, 'mythic')` then tracks its smith
  upgrade level independently from the Superior version, per the
  existing per-tier keying convention.

## 2. New NG+-exclusive unique items

Same mechanism as today's `UNIQUE_EFFECT_ITEM_IDS` pool
(`js/systems/loot.js`) — drop-only, never sold — but only rolled once
`ngPlusCycle >= 1`. Both use the shared `STAT_KEYS` list in
`js/systems/inventory.js`.

- **Retribution Charm** (`accessory` slot) — new stat
  `thornsPercent`. Reflects a percentage of incoming damage back at
  the attacker. One new combat touch point: wherever a monster's
  attack currently lands damage on the player (`js/systems/
  combat.js`), also deal `thornsPercent × damage` back to the
  attacking monster. Proposed starting value: 20%, tunable.
- **Windfury Ring** (`ring` slot — see below) — combines
  `extraSwingChance` + `critChancePercent` on one item. Zero new
  combat logic: both stats already work today (Swift Strike Charm,
  Keen Eye), just never stacked on the same piece before.

Both join `UNIQUE_EFFECT_ITEM_IDS`, gated by cycle at the roll site in
`rollDrop` rather than by a separate item list — the pool itself stays
one list, the roll just filters by `ngPlusCycle` before picking.

## 3. Ring slots

Two new slots, `ring1` and `ring2`, added alongside the existing five
(`weapon`, `head`, `body`, `legs`, `accessory` — **kept as `accessory`,
not renamed**, per Timothy's correction). Available from a new save
on, not NG+-gated as slots — what's NG+-gated is which items exist to
fill them.

- `state.js`'s `equipment`/`equipmentTiers` initial objects gain
  `ring1: null, ring2: null`. Existing saves get a migration (same
  pattern as `migrateNgPlusToolCarryover`) that adds these two empty
  keys — nothing to carry over into them, since no item occupies a
  ring slot today.
- The duplicated `SLOTS` array in three files (`inventoryScreen.js`,
  `smithScreen.js`, `statsPanel.js`) gains `'ring1', 'ring2'`.
- Items declare `slot: 'ring'` (a slot *type*, not a physical key).
  `inventoryScreen.js`'s equip handler (currently `equipItem(state,
  itemId, ITEMS[itemId].slot, tier)`, a direct 1:1 mapping) needs a
  resolution step for `slot === 'ring'`: equip into `ring1` if empty,
  else `ring2` if empty, else prompt which ring to replace (a small
  new UI affordance — the two-choice case only, no general multi-slot
  picker needed elsewhere).
- **Ember Ring reclassified from `accessory` to `ring`.** It's already
  drop-only (a unique-effect item, never sold) and literally named
  "Ring" — the natural first ring-slot item, so `ring1`/`ring2` aren't
  launching completely empty. This is a one-line `slot` change in
  `js/data/items.js`; no migration needed since it was never
  shop-purchasable to begin with.
- **Rings are drop-only, never shop-purchasable** — this is why
  Power Ring (currently shop-purchasable at 40g, `slot: 'accessory'`)
  is *not* reclassified to `ring` despite its name; it stays exactly
  where it is today.

### Ring drop gate — "strong mobs only"

Timothy's ask: ring drops shouldn't be tied to player level, but
should require fighting stronger monsters — not just a lower weighted
chance like today's other unique-effect rolls, but a hard floor below
which no ring can drop at all. Implementation: a toughness threshold
(proposed `monsterToughness(monster) >= 0.6`, tunable — roughly the
tougher half of the eligible roster by XP) gates *any* ring-slot item
out of the roll entirely for monsters below it. Applies uniformly to
both Ember Ring and the new Windfury Ring — the gate lives at the roll
site in `rollDrop`, not per-item.

## Files touched

- `js/systems/itemQuality.js` — `QUALITY_TIER_MULTIPLIERS.mythic`,
  `tierLabel`, `rollQualityTier` gains `ngPlusCycle` param.
- `js/systems/loot.js` — `rollDrop` gains `ngPlusCycle` param; boss
  mythic-tag roll; ring toughness-floor gate; NG+-gated unique-effect
  pool filtering.
- `js/data/items.js` — Mythic Essence, Retribution Charm, Windfury
  Ring entries; Ember Ring's `slot` changes to `'ring'`.
- `js/systems/inventory.js` — `thornsPercent` added to `STAT_KEYS`.
- `js/systems/combat.js` — thorns reflect damage applied wherever
  monster attack damage currently lands on the player.
- `js/screens/smithScreen.js` — reforge action/button per slot.
- `js/screens/inventoryScreen.js` — ring-slot equip resolution
  (empty-slot-first, prompt-on-both-full).
- `js/screens/statsPanel.js` — `SLOTS` array update (display only).
- `js/state.js` — `ring1`/`ring2` added to initial `equipment`/
  `equipmentTiers`; migration for saves predating this.
- `js/main.js` — thread `state.ngPlusCycle` into the three `rollDrop`
  call sites.

## Testing

- Unit tests for `rollQualityTier`/`rollDrop` mythic-chance and
  ring-toughness-gate logic at `ngPlusCycle` 0, 1, and 2 (mirrors
  existing `itemQuality`/`loot` test coverage patterns).
- Unit test for the boss-drop mythic-tag roll.
- Unit test for `thornsPercent` reflect math in `combat.js`.
- DOM/structure test for the new smith reforge button (mirrors
  existing `smithScreen` test coverage) and the ring-slot equip
  resolution (both-empty, one-empty, both-full-prompt cases).
- Save-migration test for the `ring1`/`ring2` key addition.
- Run `scripts/simulate-balance.js` with a maxed-Mythic-gear NG+-cycle-2
  baseline before finalizing the 1.35 multiplier and 400g/3-essence
  reforge cost — both are explicitly starting hypotheses in this doc,
  not final numbers.

## Open / explicitly tunable numbers

Every numeric value in this doc (mythic multiplier 1.35, boss-mythic
chance 25%, reforge cost 400g/3 essence, essence drop rate 2-6%,
thorns 20%, ring toughness floor 0.6) is a starting point for
implementation and playtesting, not a locked balance decision — flagged
explicitly so the implementation plan doesn't treat them as final.
