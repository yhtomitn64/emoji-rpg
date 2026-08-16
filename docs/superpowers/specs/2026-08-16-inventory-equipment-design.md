# Inventory & Equipment Management — Design

## Purpose

There is currently no way to see unequipped gear, choose what to equip, or compare an item's stats before swapping — dropped gear silently auto-equips instead. There is also no way to check material counts away from the smith. This build adds a dedicated inventory screen, removes auto-equip in favor of manual choice, and fixes the smith's material-matching gap while touching the same item/equipment system.

## Scope

**In scope:**
- A new `🎒 Inventory` HUD screen: equipped-gear list with Unequip, unequipped-gear list with Equip + stat delta, and read-only Materials/Potions sections.
- Removing auto-equip-on-pickup entirely (both the regular monster-drop path and the mini-dungeon-treasure path) — every item pickup goes to inventory only.
- A `upgradeSlot` field on every material item, and smith-side validation/filtering so only slot-matched materials can upgrade a given equipped item.
- A small refactor of `getEquipmentBonuses`'s per-item stat math into a reusable `getItemEffectiveStats` helper, shared with the new stat-delta calculation.

**Out of scope (deliberately):**
- Any change to how materials/potions are used elsewhere (smith upgrades, battle Item action) beyond the slot-matching filter itself.
- Distinct item instances / per-instance upgrade tracking — upgrades remain keyed by `itemId` globally, matching existing behavior (unchanged, not introduced by this build).
- Any new item types, new materials, or new equipment slots.
- Any UI for the Inventory screen beyond the four sections described below (no sorting/filtering controls, no drag-and-drop).

## Data model

Each material in `js/data/items.js` gains an `upgradeSlot` field (one of `weapon`/`head`/`body`/`legs`/`accessory`):

| Material | `upgradeSlot` |
|---|---|
| ironScrap, snakeFang, orcTusk | `weapon` |
| spiderSilk | `head` |
| leatherScrap | `body` |
| wolfPelt | `legs` |
| batWing, wraithEssence | `accessory` |

No other item fields change. No save-state schema change — `upgradeSlot` lives on the static item definitions, not on save data, so no backfill/migration is needed.

## Mechanics

### Manual equipping (no more auto-equip)

- `js/main.js`'s `handleBattleEnd` (regular monster drops) and `handleTreasureFound` (mini-dungeon treasure) both currently call `equipItem` automatically when a drop's slot is empty (treasure) or unconditionally (monster drops). Both call sites are removed — the item is added to inventory via `addItem` only, exactly as materials/potions already are.
- Equipping and unequipping become entirely player-driven, from the new Inventory screen.

### Inventory screen

New `js/screens/inventoryScreen.js`, opened via a new `🎒 Inventory` HUD button (alongside the existing `📊 Stats` button, same enable/disable-during-battle behavior). Four sections:

1. **Equipment** — the 5 slots, each showing the equipped item (or "(empty)") with its upgrade level, and an `Unequip` button when non-empty. Unequipping empties the slot and returns the item to inventory — no replacement is forced or auto-selected.
2. **Gear (unequipped)** — every inventory entry whose item has a `slot` field (weapon/head/body/legs/accessory), each with an `Equip` button and a stat delta line (e.g. "attack +3, defense -1") comparing it against whatever currently occupies that slot, both at their real current upgrade levels. Equipping swaps immediately (the previously-equipped item, if any, returns to inventory) — no confirmation needed since it's instantly reversible.
3. **Materials** — read-only list of every inventory entry with `type: 'material'` and its quantity, so a stock check is possible without traveling to town.
4. **Potions** — read-only quantity of `potion` in inventory (unchanged: still only usable via the existing battle Item action, not from this screen).

### Smith slot-matching

- `upgradeItem(state, slot, materialId, cost)` in `js/systems/inventory.js` gains a validation check: throws if `ITEMS[materialId].upgradeSlot !== slot`.
- `js/screens/smithScreen.js`'s `materialOptions()` filters to materials whose `upgradeSlot` matches the slot being upgraded (in addition to its existing `type === 'material'` and `quantity > 0` filters) — mirrors its existing filtering pattern exactly.
- If no compatible material is available for a slot, that slot's dropdown is empty and its Upgrade button stays disabled, matching the existing "no materials at all" disabled state.

## Refactor: shared per-item stat math

`getEquipmentBonuses` currently inlines `base + base * 0.25 * upgradeLevel` per stat per equipped item, then rounds the aggregated total once. This is pulled into:

```js
getItemEffectiveStats(itemId, upgradeLevel) → { attack, defense, maxHp, speed }  // unrounded
```

`getEquipmentBonuses` sums each equipped item's `getItemEffectiveStats` output across all slots, then rounds the total once — byte-identical output to today, just factored out. A new `getItemStatDelta(state, itemId)` computes an unequipped item's `getItemEffectiveStats` (at its real current `upgrades` level) minus the currently-equipped item's `getItemEffectiveStats` (or zero if the slot is empty), rounding the difference once per stat. Both consumers round exactly once, at the end of their own aggregation — no intermediate per-item rounding, which would silently change `getEquipmentBonuses`'s existing output when multiple equipped items have fractional bonuses.

## Testing

- `tests/inventory.test.js` gets new tests for: `unequipItem` (moves the equipped item back to inventory, empties the slot, throws if the slot is already empty), `getItemEffectiveStats` (matches the existing formula at a few upgrade levels), `getItemStatDelta` (correct delta against an equipped item, correct delta against an empty slot, correctly reads the candidate item's own real upgrade level), and `upgradeItem`'s new slot-matching validation (throws on a mismatched material, succeeds on a matched one).
- A regression test confirms `getEquipmentBonuses`'s output is unchanged for a representative multi-item-equipped state, to guard the refactor against the per-item-vs-aggregate rounding trap described above.
- The existing `upgradeItem consumes gold and material...` test currently upgrades the `weapon` slot with `leatherScrap` (which will no longer validate, since `leatherScrap`'s `upgradeSlot` is `body`) — updated to use a weapon-matched material (`ironScrap`) instead.
- No test for `inventoryScreen.js` itself or the `main.js`/HUD wiring — matches this project's convention for every other DOM screen (no test harness exists for this file class).

## Non-goals confirmed with user

- Materials/potions sections are read-only display only — no actions added to them in this build.
- No distinct item-instance tracking — upgrade levels stay keyed by `itemId`, shared across all copies of that item, matching existing (unrelated to this build) behavior.
- Smith's slot-matching is the only smith change — cost formula, upgrade levels, and the rest of its UI are untouched.
