# Mini-Dungeons — Design

## Purpose

Second and final build covering the World Content backlog's "Random discoverable mini-content on tiles" item. Discoverable loot caches (shipped 2026-08-14, see `docs/superpowers/specs/2026-08-14-loot-caches-design.md`) covered the lightweight half — an ambient chance of a small reward on the current tile. This build covers the heavier half explicitly deferred out of that design: a genuinely separate, small, explorable nested area (its own tile grid, its own monster encounters, an exit back to the overworld), reached via a rare ambient discovery while exploring the wilderness.

## Scope

**In scope:**
- An ambient, very rare (`0.5%` per step) chance of discovering a mini-dungeon entrance on any wild wilderness tile, capped at 1 discovered entrance per wilderness screen (9 screens total — town and the main dungeon are excluded).
- 3 hand-authored interior cave maps (~14×10), one randomly and permanently assigned per discovered entrance the moment it's found.
- Underground-themed tiles distinct from the wilderness's grass/tree/water palette.
- orc/wraith encounters inside (same monsters as the main dungeon, no new monster data).
- One guaranteed treasure tile per interior variant: bigger, more certain reward than a loot cache (25–50 gold plus one guaranteed item from a small "real gear" pool), payable once per discovered entrance.
- Re-enterable for more monster fights indefinitely after the first visit; the treasure itself is one-time only.
- Discovering an entrance and entering it are the same event — this game's existing convention is that stepping onto any action tile (shop, smith, dungeon entrance, etc.) triggers it immediately, with no separate confirm step, and mini-dungeons follow that same convention rather than introducing a new one.

**Out of scope (deliberately, matching this project's repeated precedent of hand-authored over procedural):**
- Procedurally generated interiors — 3 fixed variants only.
- New monster types — reuses orc/wraith exactly as-is.
- Any UI listing which screens have a discovered mini-dungeon, beyond the entrance's own permanent marker.
- Difficulty scaling or multiple mini-dungeons per screen (cap is a hard 1).

## Mechanics

**Discovery and entry are unified.** In `mapScreen.js`'s `tryMove()`, after a static `tile.action` check (unchanged — shop/smith/town/dungeon/exit/boss tiles still take priority, though no map data ever combines those with `tile.encounter: true` today), a new check runs before the existing cache and encounter rolls:

1. **Does this exact tile already have a discovered mini-dungeon entrance?** If yes, enter it immediately (same as any other action tile).
2. **Otherwise, if this is a wild tile on an eligible wilderness screen that hasn't reached its cap of 1 discovered entrance yet**, roll `mapConfig.miniDungeonChance` (`0.5%`). A hit: assign one of the 3 interior variants at random, permanently record the entrance at this tile, and enter it immediately — matching how a loot cache is both found and collected in the same step, and how existing action tiles trigger without a separate confirmation.
3. Only if neither of the above fires do the existing cache roll and then the encounter roll get their turn, exactly as today. Mini-dungeon, cache, and encounter are three mutually exclusive outcomes of a single step, checked in that priority order (rarest first).

**Entering a mini-dungeon** swaps the whole screen (`mountScreen`, the same mechanism town/dungeon/shop/smith already use) rather than opening an overlay — this is real nested exploration with its own movement, not a transient popup like the battle screen or the cache/flavor banners. Before swapping, the game remembers where to return to (the wilderness screen and exact tile the player stepped from) as `state.activeMiniDungeon`, cleared on exit.

**Inside the mini-dungeon:** movement, encounters (orc/wraith, `encounterChance: 0.2` — slightly gentler than the main dungeon's `0.25`, given the smaller space), and the HUD all behave exactly as they do in the main dungeon or any wilderness screen — no new UI. The interior's start tile doubles as its exit tile (`action: 'exitMiniDungeon'`), the same pattern the main dungeon already uses for its own entrance/exit tile — stepping onto it (which includes walking back to where you started) returns you to the exact overworld screen and tile you entered from. One additional tile type, the treasure tile (`action: 'collectTreasure'`), sits somewhere else in the layout; walking onto it for the first time on this entrance grants the guaranteed reward and marks it permanently taken (further visits do nothing). Orc/wraith encounters keep happening on every subsequent visit — only the treasure is one-time.

**Tile palette (interior only, new tile types):**
- Cave floor (walkable, `encounter: true`): ⬛
- Cave wall (impassable): 🪨
- Underground pool (impassable, decorative): 💧
- Entrance/exit (walkable, `action: 'exitMiniDungeon'`): 🪜
- Treasure (walkable, `action: 'collectTreasure'`): 💰

**Overworld marker:** once an entrance is discovered, that wilderness tile permanently renders ⛏️ instead of its normal tile emoji (same render-time overlay technique the loot-cache marker already uses — the underlying map data is never modified, only what gets drawn).

## Data model

New `js/systems/miniDungeons.js`, mirroring `js/systems/caches.js`'s shape exactly (pure, immutable-update functions, no DOM dependency):

```js
export const MINI_DUNGEON_CAP_PER_SCREEN = 1;
export const MINI_DUNGEON_VARIANT_IDS = ['miniDungeonA', 'miniDungeonB', 'miniDungeonC'];
export const MINI_DUNGEON_TREASURE_ITEM_POOL = ['ironSword', 'ironHelm', 'ironArmor', 'ironGreaves', 'powerRing', 'luckyCharm'];

export function hasMiniDungeonEntrance(miniDungeons, screenId, x, y) { /* ... */ }
export function countMiniDungeonEntrances(miniDungeons, screenId) { /* ... */ }
export function recordMiniDungeonEntrance(miniDungeons, screenId, x, y, variantId) { /* returns new miniDungeons object, immutable */ }
export function getMiniDungeonEntrance(miniDungeons, screenId, x, y) { /* returns { variantId, treasureTaken } or undefined */ }
export function shouldRevealMiniDungeon(miniDungeons, screenId, x, y, chance, rng = Math.random) { /* mirrors shouldRevealCache exactly */ }
export function pickMiniDungeonVariant(rng = Math.random) { /* returns one of MINI_DUNGEON_VARIANT_IDS */ }
export function markTreasureTaken(miniDungeons, screenId, x, y) { /* returns new miniDungeons object, immutable */ }
export function rollMiniDungeonTreasure(rng = Math.random) { /* returns { gold, item }, gold 25-50, item always set (100% chance, unlike cache loot) */ }
```

New state fields:
- `state.miniDungeons`: `{ [screenId]: { "x,y": { variantId, treasureTaken } } }` — same shape family as `state.caches`, one entry per discovered entrance, keyed by the *wilderness* screen and tile it was found on (not by which interior variant it uses — two entrances can share a variant).
- `state.activeMiniDungeon`: `{ screenId, x, y } | null` — set when entering, read on exit to know where to return, cleared after. Persisted (not a transient in-memory variable) so a page reload while inside a mini-dungeon still knows how to get back out.

Both get backward-compatibility backfills in `main.js`'s existing init block, the same way `visited`/`seenScreens`/`caches` already do.

**Map registry:** the 3 interior variants are added to `main.js`'s `MAPS` registry like any other map, under the ids in `MINI_DUNGEON_VARIANT_IDS`. `mapScreen.js` and its `render()`/`tryMove()` need no changes to handle them beyond the new entrance-detection logic above — a mini-dungeon interior is, mechanically, just another map.

## Wiring changes

- **3 new map files** under `js/maps/miniDungeons/` (e.g. `variantA.js`, `variantB.js`, `variantC.js`), each exporting an object with `id`, `legend`, `rows` (~14×10), `startPosition` (the entrance/exit tile), `encounterChance: 0.2`, `monsterTable: ['orc', 'wraith']` — no `neighbors` field, since mini-dungeons are dead-ends, not connected to the edge-transition graph.
- **`js/tiles.js`**: 5 new tile types (caveFloor, caveWall, cavePool, miniDungeonEntrance, miniDungeonTreasure) per the palette above.
- **Wilderness map files** (all 9 under `js/maps/wilderness/`): add `miniDungeonChance: 0.005`.
- **`js/screens/mapScreen.js`**: `tryMove()` gets the new entrance-check-then-roll logic (priority above cache/encounter); `render()` gets the ⛏️ marker overlay, alongside the existing 📦 one.
- **`js/main.js`**: register the 3 new maps in `MAPS`; new `handleEnterMiniDungeon` (sets `state.activeMiniDungeon`, calls `goToMap` with the variant id) and `handleExitMiniDungeon` (reads `state.activeMiniDungeon` to restore the origin screen/position, clears it) wired into `handleTileAction`; new `handleTreasureFound` (mirrors `handleCacheFound`, applies gold/item, shows a banner, marks treasure taken) wired as a new `onTreasureFound` callback from `mapScreen.js`.

## Testing

- `tests/miniDungeons.test.js`: unit tests for every function in `js/systems/miniDungeons.js`, following the same deterministic-injected-rng pattern as `tests/caches.test.js` — entrance recording/lookup immutability, the cap, `shouldRevealMiniDungeon`'s four regression-shaped cases (mirroring `shouldRevealCache`'s), variant selection distribution, treasure roll gold range and guaranteed item.
- Extend `tests/maps.test.js` (or a new `tests/miniDungeonMaps.test.js`, whichever keeps the existing file from growing unwieldy — decide during planning) with the same structural checks wilderness screens already get: well-formed legend/rows, full walkability reachability via flood-fill from `startPosition`, and confirmation each variant has exactly one treasure tile and its start position is the exit tile.
- Extend `tests/state.test.js`: fresh state has empty `miniDungeons` and `null` `activeMiniDungeon`.
- Extend the wilderness maps test: every wilderness screen has a numeric `miniDungeonChance` of exactly `0.005`; town and dungeon are unaffected (no field expected/added).
- Manual verification: same browser-based approach as loot caches (temporarily forcing a high chance to trigger discovery, confirming entry/exit/treasure/re-entry behave as designed, then reverting the temporary edit before committing).

## Non-goals confirmed with user

- No procedural interior generation — 3 fixed hand-authored variants.
- No new monster types — orc/wraith only.
- No mini-dungeons on town or the main dungeon map.
- No difficulty scaling and no more than 1 discovered entrance per wilderness screen.
- Treasure is one-time; monster encounters inside are not.
