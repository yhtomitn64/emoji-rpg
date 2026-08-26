# Item Quality Tiers & Unique Effects — Design

## Purpose

Raised 2026-08-26 as part of a bigger conversation about giving harder
monsters a real reason to be worth fighting (`docs/superpowers/
BACKLOG.md`'s "Painter tool: paint which monsters can appear where" and
"Roaming visible enemies + dragon difficulty scaling" threads). That
conversation split into four separable projects — this is **#1 of 4**
(gear/progression philosophy), deliberately sequenced first since it
decides what "better loot in harder areas" even means before the other
three (spatial difficulty design, the monster-placement painter tool,
and monster-variety expansion) get designed.

Timothy's own framing: he doesn't want an inventory-slot cap, but also
doesn't want stat inflation — "if we stick to specific items then in
order to prevent stat inflation then we will have to have upgrades be
pretty small which is fine." He also wants found loot to feel more
exciting than the shop ("store items can be boring... drops can be more
fun and maybe have more effects").

Today's itemization is a small, fully curated catalog (`js/data/
items.js`, ~19 gear items) with a flat per-item smith-upgrade path
(+25%/level, capped at 3 levels, `js/systems/inventory.js`) and zero
randomization anywhere. Most monster drop tables (`js/data/monsters.js`)
yield crafting materials, not equipment — only `goblin` drops a named
weapon (`goblinClub`) today; genuine unique gear
(`dragonScaleMail`/`dragonFang`/`fossilFang`) only comes from the boss
and the elite encounter, each with their own separate, untouched
mechanism.

## Scope

**In scope:**
- A Plain/Fine/Superior quality tier, implemented as a stat-multiplier
  overlay on existing curated base items (mirrors the pattern
  `js/systems/monsterVariants.js` already uses for named monster
  variants) — no growth in `items.js`'s catalog size.
- A new, generic equipment-drop chance so *any* regular monster kill has
  a shot at dropping gear, not just the couple of species that already
  have a named equipment entry in their drop table.
- Drop quality (which tier, or a wholly unique item) weighted by the
  killed monster's own stats — specifically `xp`, which already tracks
  intended toughness consistently across the roster — not by where the
  monster happens to be standing. This deliberately doesn't require the
  still-undesigned spatial-difficulty project (#2) to ship first.
- Three new hand-authored "Unique-effect" items (Vampiric Fang, Swift
  Strike Charm, Ember Ring) as the rarest quality bucket, each carrying
  one new named combat effect (lifesteal, extra-swing chance, elemental
  proc) — same "each effect is its own small hand-built mechanic" cost
  model as today's crit/knockback/combo systems, not a generic effect
  scripting layer.
- Folding the one existing named equipment drop (`goblinClub`) into the
  same Plain/Fine/Superior roll, for free, via the same shared code path.
- Smith-upgrade compatibility: Unique-effect items upgrade through the
  existing generic, slot-keyed material system with zero new code: an
  effect's magnitude scales via the exact same +25%/level formula
  already used for attack/defense/etc.

**Out of scope (deliberately):**
- The spatial-difficulty gradient itself ("distance from town" as a
  concept) — project #2, not needed here since weighting keys off a
  monster's own stats, not its location.
- The monster-placement painter tool — project #3, unrelated to how
  loot works once dropped.
- New monster types/variety beyond the existing roster — project #4.
  This design works with whatever roster exists at any time (the
  toughness curve is computed dynamically from the live roster, see
  Mechanics), so it doesn't need to wait on new monsters, and doesn't
  preclude them.
- Crit-chance-increase and parry-window-trade-off effects, and the
  rhythm-style multi-hit-parry idea — all raised in the same
  conversation, explicitly deferred; captured in `docs/superpowers/
  BACKLOG.md`'s Combat pass ideas section.
- A second, guaranteed bonus item per kill. The new generic
  equipment-drop roll only gets a chance to fire when a monster's own
  `dropTable` roll *didn't* already produce an item this kill — a kill
  still yields at most one bonus item, same as today. (This is a
  deliberate scope call to avoid a bigger "multiple simultaneous drops
  per kill" data-flow change across `main.js`'s three `rollDrop` call
  sites, which isn't otherwise needed here.)
- Any change to smith-upgrade cost/level cap, or to how materials work.
- Any change to shop-purchased items — Plain tier, exactly as today; a
  `tier` never appears on anything bought from the shop.
- Inventory sorting/bulk-sell tooling — deliberately avoided by keeping
  tiers as a small number of discrete, stackable buckets (see Data
  model) instead of continuous per-instance rolls, so the inventory-
  bloat problem this could have caused never materializes.

## Mechanics

### Monster toughness: computed from the live roster, not hardcoded

```js
// js/systems/itemQuality.js (new file)
import { MONSTERS } from '../data/monsters.js';

function isToughnessEligible(monster) {
  return !monster.isBoss && !monster.isElite && !monster.forceFullBattle;
}

const ELIGIBLE_MONSTERS = Object.values(MONSTERS).filter(isToughnessEligible);
const XP_MIN = Math.min(...ELIGIBLE_MONSTERS.map((m) => m.xp));
const XP_MAX = Math.max(...ELIGIBLE_MONSTERS.map((m) => m.xp));

export function monsterToughness(monster) {
  if (XP_MAX === XP_MIN) return 0; // guards a future roster of exactly one eligible monster
  const clamped = Math.min(Math.max(monster.xp, XP_MIN), XP_MAX);
  return (clamped - XP_MIN) / (XP_MAX - XP_MIN);
}
```

Computed once from whatever `MONSTERS` contains at load time — adding
new monsters later (project #4) automatically re-spreads the curve with
no code change here. Checked against today's actual roster: eligible
`xp` spans 11 (bat) to 63 (wraith), so `direWolf` (32 xp, a far-corner
regular) lands at toughness ≈0.40, `wraith` (63 xp, dungeon-tier) at
1.0 — a real, meaningful spread without hand-tuning per species.

### The quality roll

Plain/Fine/Superior only — deciding whether something is a Unique-effect
item at all happens earlier, as its own separate check (see "The
generic equipment-drop roll" below). Keeping this function scoped to
just the three ordinary tiers means its odds are the same whether it's
called for the new generic roll or for an existing named drop like
`goblinClub`.

```js
// js/systems/itemQuality.js
function lerp(min, max, t) { return min + (max - min) * t; }

export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20 };

// Returns 'plain' | 'fine' | 'superior'.
export function rollQualityTier(toughness, rng = Math.random) {
  const superiorChance = lerp(0.02, 0.10, toughness);
  const fineChance = lerp(0.10, 0.25, toughness);
  const roll = rng();
  if (roll < superiorChance) return 'superior';
  if (roll < superiorChance + fineChance) return 'fine';
  return 'plain';
}

// 1% at the weakest eligible monster, 5% at the toughest - its own
// independent check, not a bucket inside rollQualityTier.
export function rollUniqueEffectChance(toughness, rng = Math.random) {
  return rng() < lerp(0.01, 0.05, toughness);
}
```

Starting numbers, same "ship something reasonable, tune from real
playtesting" approach as every other balance number in this project.
Nothing in this table is ever exactly 0% at either end, per Timothy's
explicit call ("weighted higher for harder monsters but still have a
chance from weaker monsters").

### The generic equipment-drop roll

**Revised 2026-08-26** — the first version of this design nested the
Unique-effect chance *inside* the equipment-drop gate (a chance of a
chance), which compounded down to an unnoticeable ~0.25% at the very
best case. Timothy's read once he saw the actual math: "0.25% seems
super low for the amount of battles in this game... I feel like there
should be like 5% of something unique happening and maybe 10% of
getting gear from a battle." Fixed by making Unique-effect its own
independent check, evaluated *before* (not nested inside) the ordinary-
gear gate — so both numbers below are the real, observed top-line
rates, not a product of two multiplied-together percentages:

```js
// js/systems/loot.js
export const EQUIPMENT_DROP_CHANCE = 0.10; // flat - toughness already
  // drives *quality* within this roll; scaling the gate too would
  // double-compound the reward for fighting tougher monsters.
export const EQUIPMENT_DROP_POOL = SHOP_CATALOG.filter((id) => ITEMS[id].slot);
export const UNIQUE_EFFECT_ITEM_IDS = ['vampiricFang', 'swiftStrikeCharm', 'emberRing'];
```

`rollDrop(monster, rng)` changes shape from returning `{ gold, item }` to
`{ gold, item, tier }` (`tier` is `undefined` for a plain item, a
Unique item, or no item at all):

1. Roll the existing `dropTable` exactly as today.
2. **If that produced an equipment-slot item** (checked via
   `ITEMS[item].slot` — true for `goblinClub`, false for materials/
   potions/tools): roll `rollQualityTier(monsterToughness(monster))`.
   A `'plain'` result leaves `tier` unset; `'fine'`/`'superior'` set it.
   (Named drops never roll Unique — see "Existing named drops" below.)
3. **Else, if the dropTable produced nothing** (skipped entirely for
   boss/elite/`forceFullBattle` monsters — they keep their own
   mechanisms untouched):
   - First, roll `rollUniqueEffectChance(monsterToughness(monster))`.
     On success, `item` becomes a uniform-random pick from
     `UNIQUE_EFFECT_ITEM_IDS`, `tier` stays unset.
   - **Only if that missed**, roll `rng() < EQUIPMENT_DROP_CHANCE`. On
     success, `item` becomes a uniform-random pick from
     `EQUIPMENT_DROP_POOL`, with `tier` set via `rollQualityTier`.

Net effect at the toughest regular monster (toughness 1.0): a real,
directly-observable 5% chance of a Unique-effect item, and — only on
the other 95% of kills — a further flat 10% chance of ordinary
Plain/Fine/Superior gear, for a combined ~14.5% chance of *something*
dropping beyond materials/gold. At the weakest eligible monster
(toughness 0): 1% Unique, else the same flat 10% ordinary-gear check
(quality skewed toward Plain at that end via `rollQualityTier`'s own
floor) — so even a boar kill has a real, if modest, shot at gear now.

### Existing named drops (`goblinClub`) can't roll Unique

Step 2 above only ever calls `rollQualityTier` (Plain/Fine/Superior),
never `rollUniqueEffectChance` — deliberate: a `goblinClub` drop
redirecting into an unrelated named item like "Vampiric Fang" would be
a non-sequitur — the named drop is supposed to *be* that item, just
possibly a better-than-plain copy of it. Only the new generic
equipment-drop path (step 3), which is already picking "some piece of
gear" rather than a specific named one, can produce a Unique.

### Quality tier's effect on stats

```js
// js/systems/inventory.js
export function getItemEffectiveStats(itemId, upgradeLevel = 0, tier) {
  const item = ITEMS[itemId];
  const stats = {
    attack: 0, defense: 0, maxHp: 0, speed: 0, enemySlowPercent: 0,
    lifestealPercent: 0, extraSwingChance: 0, elementalProcChance: 0, elementalProcDamage: 0,
  };
  const tierMultiplier = tier ? QUALITY_TIER_MULTIPLIERS[tier] : 1;
  for (const stat of Object.keys(stats)) {
    const base = (item.stats?.[stat] || 0) * tierMultiplier;
    stats[stat] = base + base * 0.25 * upgradeLevel;
  }
  return stats;
}
```

Tier multiplies the base stat *before* the existing +25%/level upgrade
scaling applies on top — so a Superior item's absolute gain-per-upgrade-
level is proportionally larger than a Plain item's (25% of a bigger
number), consistent multiplicative stacking. Given tier only adds
10–20% and upgrades cap at 3 levels, this compounding stays modest —
worth knowing, not worth guarding against.

The four new keys (`lifestealPercent`, `extraSwingChance`,
`elementalProcChance`, `elementalProcDamage`) are added to the same
fixed-key `stats` object every other stat already lives in — no new
generic "effects" system, just three more named numbers that combat
code reads directly, exactly like `enemySlowPercent` already does for
`frostCharm`. This also means effect magnitude scales with smith
upgrades automatically, for free.

`getEquipmentBonuses(state)` (same file) passes `state.equipmentTiers?.[slot]`
through as the new `tier` argument; `getItemStatDelta` gains the same
`tier` parameter so a tiered inventory entry previews its real bonus
before equipping.

### Combat hooks for the three v1 effects

Each is its own small, discrete piece of logic — deliberately not a
generic "on-hit effect" pipeline, matching how crit/knockback/combo
bonuses are each their own named mechanic today:

- **Lifesteal** (`lifestealPercent`) — after any player-dealt damage
  resolves (both `playerAttack()` and `playerUseAbility()` in
  `js/screens/battleScreen.js` already have a single point where damage
  is finalized and `state.player.hp` would be updated) heal the player
  for `damage * lifestealPercent / 100`, clamped to their effective max
  HP. One shared hook point, not duplicated per attack type.
- **Extra-swing chance** (`extraSwingChance`) — after a normal `Attack`
  (not abilities, kept deliberately narrow for v1) lands, roll the
  chance; on success, immediately resolve one more `Attack` at no
  cooldown/turn cost. Hard rule: the bonus swing does **not** re-roll
  its own extra-swing chance — capped at exactly one bonus swing per
  original attack, to rule out a runaway chain by construction rather
  than by a counter that could be gotten wrong. **Explicitly does not
  interact with the existing attack-spam-decay system**
  (`attackStreakMultiplier`/`attackCooldownMsForStreak` in
  `js/systems/combat.js`): the bonus swing neither increments the spam
  streak nor is itself subject to the decayed damage/growing cooldown
  that mechanic imposes on manually-repeated presses — it's an
  automatic proc triggered by one real press, not player spam, and
  should read to the player as a clean bonus, not something the
  spam-decay system silently claws back.
- **Elemental proc** (`elementalProcChance` + `elementalProcDamage`) —
  same shared post-damage hook as lifesteal; on a successful roll, add
  `elementalProcDamage` as a separate, clearly-labeled bonus-damage
  number/log line (e.g. "🔥 Bonus fire damage: 6") rather than folding
  it silently into the main hit's number.

### The three v1 Unique-effect items

```js
// js/data/items.js additions - price: 0, drop-only, no tier (uniques
// aren't tiered - they ARE the rare tier)
vampiricFang: { id: 'vampiricFang', name: 'Vampiric Fang', emoji: '🦴', slot: 'weapon', price: 0,
  stats: { attack: 7, lifestealPercent: 15 } },
swiftStrikeCharm: { id: 'swiftStrikeCharm', name: 'Swift Strike Charm', emoji: '🔮', slot: 'accessory', price: 0,
  stats: { extraSwingChance: 10 } },
emberRing: { id: 'emberRing', name: 'Ember Ring', emoji: '🔥', slot: 'accessory', price: 0,
  stats: { elementalProcChance: 20, elementalProcDamage: 6 } },
```

`vampiricFang` carries a real attack stat (comparable to `ironSword`'s
6) alongside its effect, so it's viable to equip on its own merits, not
just for the effect — matching how a "found upgrade" should feel.
`swiftStrikeCharm`/`emberRing` are effect-only, matching `frostCharm`'s
existing precedent for accessories. All three numbers are starting
points for playtesting, same as everything else here.

## Data model

- `state.inventory` entries: `{ itemId, quantity, tier }` — `tier` is a
  new optional field (`undefined` | `'fine'` | `'superior'`; a Unique
  item's entry never has a tier). Stacking (`addItem`/`removeItem` in
  `js/systems/inventory.js`) now matches on `itemId + tier` together, so
  a Plain and a Fine copy of the same base item occupy separate stacks.
  An existing save's entries have no `tier` key at all, which reads
  identically to `tier: undefined` — no migration needed.
- `state.equipment[slot]` — **unchanged**, stays a bare itemId string.
  Every existing reader (HUD, combat, shop/smith screens) keeps working
  with zero changes.
- `state.equipmentTiers[slot]` — new, parallel map (itemId's tier is
  irrelevant once slot-keyed, so this stores tier directly per slot),
  same relationship to `state.equipment` that `state.upgrades` already
  has. Missing/undefined entry means Plain, so old saves need no
  migration.
- `state.upgrades` — **unchanged**, still keyed by itemId alone.

## Wiring changes

- **New:** `js/systems/itemQuality.js` — `monsterToughness`,
  `rollQualityTier`, `rollUniqueEffectChance`, `QUALITY_TIER_MULTIPLIERS`.
- **Modify:** `js/systems/loot.js` — `rollDrop` gains the tier roll and
  the new generic equipment-drop path (steps 2/3 above), importing
  `rollQualityTier`/`rollUniqueEffectChance`/`monsterToughness` from
  `itemQuality.js`; new exports `EQUIPMENT_DROP_CHANCE`,
  `EQUIPMENT_DROP_POOL`, `UNIQUE_EFFECT_ITEM_IDS`.
- **Modify:** `js/data/items.js` — three new entries (`vampiricFang`,
  `swiftStrikeCharm`, `emberRing`); `SHOP_CATALOG` unchanged (none of
  these are shop-purchasable).
- **Modify:** `js/systems/inventory.js` — `addItem`/`removeItem` match
  on `itemId + tier`; `getItemEffectiveStats` gains the `tier` param and
  the four new stat keys; `getEquipmentBonuses` reads
  `state.equipmentTiers`; `getItemStatDelta` gains a `tier` param;
  `equipItem`/`unequipItem` carry `state.equipmentTiers[slot]` in step
  with `state.equipment[slot]`; `describeItem` (or a new tier-aware
  variant) prefixes "Fine "/"Superior " to a tiered item's display name.
- **Modify:** `js/main.js` — the three `rollDrop`/`grantDropItem` call
  sites pass `drop.tier` through to wherever the item actually gets
  added to inventory.
- **Modify:** `js/screens/battleScreen.js` — the three combat hooks
  (lifesteal, extra-swing, elemental proc) at the shared post-damage
  point(s) described above.
- **Modify:** `js/screens/inventoryScreen.js`, `js/screens/shopScreen.js`,
  wherever else an item's display name renders — use the tier-aware
  label so a Fine/Superior item reads distinctly from its Plain form.

## Testing

- `itemQuality.test.js` (new): `monsterToughness` returns 0 for the
  lowest-xp eligible monster and 1 for the highest, boss/elite/
  `forceFullBattle` monsters excluded from the min/max computation;
  `rollQualityTier` only ever returns `'plain'`/`'fine'`/`'superior'`
  (never anything else) and at toughness 0 and 1 each bucket's boundary
  matches the documented lerp values exactly (deterministic with a
  fixed rng function); `rollUniqueEffectChance` hits at exactly the
  documented 1%/5% boundaries at toughness 0/1.
- `loot.test.js` (existing, extend): `rollDrop` returns a `tier` only
  when an equipment-slot item actually dropped, and never for a Unique
  item; a material/potion/tool drop never carries a tier; the ordinary-
  gear check never fires when the earlier Unique-effect check already
  hit (the two are mutually exclusive per kill, confirmed via an rng
  stub that would satisfy both independently); the generic equipment-
  drop path (either branch) never fires when the dropTable already
  produced an item; boss/elite/`forceFullBattle` monsters never get
  either the Unique-effect or ordinary-gear roll regardless of rng.
- `inventory.test.js` (existing, extend): `addItem` keeps a Plain and a
  Fine copy of the same `itemId` as two separate entries;
  `getItemEffectiveStats` applies the tier multiplier before the
  upgrade-level scaling, matching the documented order of operations;
  `getEquipmentBonuses` reads `state.equipmentTiers` correctly for an
  equipped tiered item.
- No DOM/rendering test coverage for the combat-hook effects
  (lifesteal/extra-swing/elemental proc) or the inventory/shop display
  changes — same standing limitation as every other `battleScreen.js`
  change in this project (no jsdom setup); manual in-browser
  verification required: force a drop of each quality tier and each
  Unique item via a debug hook (same technique used earlier this
  session for the ability-unlock celebration), confirm effective stats
  match the documented formula, and fight a battle with each of the
  three new effects equipped to confirm lifesteal heals, extra-swing
  fires exactly once (never chains), and the elemental proc shows its
  own distinct log line.
