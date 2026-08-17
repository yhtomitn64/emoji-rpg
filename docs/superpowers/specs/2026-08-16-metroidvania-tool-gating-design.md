# Metroidvania Tool-Gating — Design

## Purpose

Give the player a backtracking-with-new-tools loop: two tools (a mining pick and an axe), each dropped by a specific dungeon-tier monster, permanently unlock a small number of hand-picked shortcuts and loot pockets carved out of terrain that's currently just impassable decoration on the existing 9 wilderness screens. No new maps or zones — the world is already fully built and fully reachable (enforced by the existing test suite), so this reuses existing decorative trees/water rather than authoring brand-new content.

## Scope

**In scope:**
- Two new tool items (`miningPick`, `axe`), dropped by `orc` and `wraith` respectively, alongside their existing material drops.
- Two new gated tile types (`mountain`, `thicket`), each re-purposing a small number of existing decorative tree/water clusters on the 9 wilderness screens — not new terrain, not touching the world-edge tree border.
- A handful of hand-placed gates (roughly 2 mountain, 2 thicket) across the 9 screens, each either a pure shortcut or a shortcut with a small one-time loot pocket behind it. Exact screens/coordinates are chosen and verified during implementation, not frozen here.
- A small "Tools" section added to the existing Inventory screen.

**Out of scope (deliberately):**
- Any new map screens, zones, or terrain features beyond re-purposed existing decoration.
- World-edge trees — these remain the permanent, ungateable world boundary, untouched by this build.
- Any change to `js/systems/world.js`'s `isWalkableAt` — it's used only for load-time position validation and the map-validation test suite's reachability check, neither of which is on the live movement path (confirmed by reading the code: `mapScreen.js`'s `tryMove` has its own separate walkability check and never calls `isWalkableAt`). Leaving it untouched means the entire existing reachability/border-walkable test suite continues passing with zero changes, since it only ever sees the tile's unconditional `walkable` field.
- Per-gate "opened" state tracking — a gate's walkability is derived live from whether the player currently holds the required tool, not persisted. Only the *reward* behind a loot-pocket gate needs one-time-collection tracking.

## Mechanics

### Tools

- `miningPick` and `axe`: new items, `type: 'tool'` (a new category distinct from weapon/armor/material/consumable — not equippable in any of the 5 gear slots, never consumed, `price: 0` since they're drop-only, never shop-purchasable).
- `orc`'s drop table gains `{ itemId: 'miningPick', chance: 0.25 }`; `wraith`'s gains `{ itemId: 'axe', chance: 0.25 }` — each alongside its existing material drop entry, same shape and same order-of-magnitude chance as every other equipment drop already in this game.

### Gated tiles

- `mountain`: `{ emoji: '⛰️', walkable: false, encounter: false, requiresTool: 'miningPick' }`
- `thicket`: `{ emoji: '🌳', walkable: false, encounter: false, requiresTool: 'axe' }`

A gated tile's base `walkable` field stays `false` — the same unconditional value every other impassable tile already has, and the value the map-validation test suite already checks. `requiresTool` is a new, purely additive field that only the live movement path (see Wiring) interprets.

A gate is one of two flavors, chosen per placement:
- **Shortcut**: reconnects two points on a screen that currently require a long detour around an existing tree/water block. No reward, no persistent state — walkable exactly when the player holds the tool, every time, forever.
- **Loot pocket**: seals off a small dead-end pocket of grass. The first time the player crosses that specific gate tile with the tool, they also receive a one-time reward: flat 15-25 gold plus a guaranteed potion. Tracked the same way loot caches already are (`{screenId: {"x,y": true}}`, one boolean per collected gate) — the tile itself remains walkable forever afterward, only the reward is one-time.

Bumping into a locked gate (tile exists, isn't base-walkable, has `requiresTool`, player doesn't have it) shows a flavor-banner message naming the required tool (e.g., "You need a Mining Pick to get through here.") — shown every time, no one-time-seen tracking, reusing the existing `showFlavorBanner` mechanism.

### Placement

Roughly 2 mountain gates and 2 thicket gates total across the 9 wilderness screens, hand-picked during implementation from each screen's existing decorative tree/water clusters — following this project's established pattern (hand-authored, verified against the real map data and reachability tests, not blanket-applied). Each gate converts 1-3 adjacent existing `#`/`~` characters into the new gate character in that screen's `ROWS`, so the change is neutral for every currently-walkable tile's reachability (converting one impassable tile type into a different impassable-by-default tile type doesn't affect anything that's already walkable today).

### Inventory screen

The Inventory screen's existing four sections (Equipment, Gear, Materials, Potions) categorize by `item.slot`/`item.type`, and a `type: 'tool'` item doesn't fit any of them — it would silently not display anywhere. A fifth, read-only "Tools" section is added, same pattern as Materials/Potions, listing any tools the player has picked up.

## Data model

- `state.gateRewards`: new object, same shape as `state.caches` (`{ screenId: { "x,y": true } }`), tracking which loot-pocket gates have already been collected. Added to `createNewGame()`, backfilled on load the same way every other new field has been.
- New `js/systems/toolGates.js`: pure, DOM-free, mirrors `caches.js`'s shape.
  - `hasRequiredTool(tile, inventory)` → boolean — true if `tile.requiresTool` is unset, or the inventory has that item with quantity > 0.
  - `isGateRewardCollected(gateRewards, screenId, x, y)` / `markGateRewardCollected(gateRewards, screenId, x, y)` — mirror `hasCache`/`recordCache` exactly.
  - `rollGateReward(rng = Math.random)` → `{ gold, item: 'potion' }`, `gold = 15 + Math.floor(rng() * 11)` (15-25 inclusive, same shape as `caches.js`'s existing `rollCacheLoot`).

## Wiring changes

- **`js/data/items.js`**: add `miningPick`/`axe` item definitions.
- **`js/data/monsters.js`**: add the two new drop-table entries to `orc`/`wraith`.
- **`js/tiles.js`**: add `mountain`/`thicket` tile definitions.
- **`js/maps/wilderness/*.js`** (2-4 of the 9 files): re-purpose small existing tree/water clusters into gate placements, per the Placement section above.
- **`js/state.js`**: `createNewGame()` adds `gateRewards: {}`.
- **`js/screens/mapScreen.js`**: `tryMove`'s existing walkability check (`if (!tile || !tile.walkable) return;`) becomes tool-aware — a tile is passable if it's unconditionally walkable OR `hasRequiredTool(tile, state.inventory)` is true. On a blocked gate specifically (not just any impassable tile), a new callback fires so `main.js` can show the flavor message. On a successfully crossed loot-pocket gate not yet collected, a new callback fires with the rolled reward, mirroring exactly how `onCacheFound` already works today. This gate-reward check is a new, separate check alongside `resolveStepDiscovery` (`js/systems/discovery.js`), not routed through it — `resolveStepDiscovery` only evaluates tiles with `encounter: true` (grass, cave floor), and gated tiles have `encounter: false`, so `discovery.js` itself needs no changes.
- **`js/main.js`**: two new small handlers, `handleLockedGate(toolName)` (calls `showFlavorBanner`) and `handleGateReward(loot)` (mirrors `handleCacheFound`'s gold/item-grant/banner/persist/renderHud shape exactly), wired into `goToMap`'s callbacks object; `startGame`'s backfill block gains a `gateRewards` check.
- **`js/screens/inventoryScreen.js`**: new read-only Tools section.

## Testing

- `tests/toolGates.test.js`: `hasRequiredTool` true/false cases (has tool, missing tool, tile has no `requiresTool` at all); `isGateRewardCollected`/`markGateRewardCollected` round-trip; `rollGateReward`'s gold range and guaranteed potion.
- Extend `tests/state.test.js`: fresh state has `gateRewards: {}`.
- Extend `tests/maps.test.js`: the existing full-suite reachability/border-walkable/well-formedness checks should require no changes at all, since gated tiles keep `walkable: false` — this is itself worth a one-line assertion confirming each modified screen still passes `assertFullyReachable` unchanged, as a regression guard specifically for this build's terrain edits.
- No automated test for `mapScreen.js`'s wiring or the Inventory screen's new section — matches this project's convention for every other DOM/screen change (no test harness exists for this file class); covered by manual verification (or the hand-trace + script-replay substitute when a browser isn't available): confirm walking into a locked gate without the tool shows the flavor message and doesn't move you; confirm picking up the tool (or spawning a test state that already has it) makes the same tile passable; confirm a loot-pocket gate grants its reward exactly once and stays walkable afterward.

## Non-goals confirmed with user

- No brand-new map screens/zones.
- World-edge trees remain permanently impassable, untouched.
- No per-gate "opened" state — walkability is always derived live from current inventory.
- `isWalkableAt`/the reachability test suite are untouched.
