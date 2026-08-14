# Discoverable Loot Caches — Design

## Purpose

First of two builds covering the World Content backlog's "Random discoverable mini-content on tiles" item. This build covers the "bonus loot" half only — an ambient chance while exploring of finding a small stash of gold (and sometimes an item) on the tile you're standing on, which then permanently marks that tile so you remember you already found it. The "mini-dungeon" half of the original backlog note is a substantially bigger feature (nested explorable sub-maps, their own encounters, exit logic) and is deliberately deferred to a second build immediately following this one.

## Scope

**In scope:**
- An ambient per-step chance of discovering a loot cache on any tile with `tile.encounter === true` (the same flag grass tiles already use for the existing monster-encounter roll), on the 9 wilderness screens and the dungeon.
- A per-screen cap on how many caches can exist, so a screen can't accumulate markers everywhere from enough walking.
- Loot content: a gold amount, plus a chance of one item (potion or a material).
- A non-blocking banner announcing the find (reusing the existing flavor-banner component from the terrain-density build).
- A permanent marker (📦) on any tile where a cache was found, persisted in save state.
- Town is explicitly excluded — mirrors its existing `encounterChance: 0` / `monsterTable: []` "safe zone" status.

**Out of scope (deferred):**
- Mini-dungeons (actual nested explorable areas) — a separate design/build immediately following this one.
- Per-map tuning of gold range or item pool — v1 uses one flat global reward table across every eligible screen. If dungeon-tier caches feel underwhelming next to dungeon-tier combat loot in practice, that's a one-line follow-up (see Testing).
- Any UI to browse/count how many caches you've found — the marker itself is the only feedback.

## Mechanics

**Trigger:** In `mapScreen.js`'s `tryMove()`, after the player moves onto a walkable tile (same point where the existing encounter roll happens), if `tile.encounter` is true:
1. If that screen is already at its cache cap, or the map's `cacheChance` roll misses, fall through to the existing encounter roll unchanged.
2. Otherwise, the cache roll wins outright for this step: record the cache at this tile, roll its loot, and **skip the encounter roll for this step** (finding treasure and getting ambushed in the same footstep is bad pacing, so these two ambient rolls are mutually exclusive per step — cache is checked first).

**Per-map `cacheChance`:** a new field on each map's data object, next to the existing `encounterChance`:
- Town: `0` (excluded)
- All 9 wilderness screens: `0.03`
- Dungeon: `0.04`

**Cap:** a single global constant, `CACHE_CAP_PER_SCREEN = 3` (not per-map — this is about visual density, not difficulty tuning, so one shared value is enough).

**Reward:** rolled via a new `rollCacheLoot(rng = Math.random)` function, following the same shape as `loot.js`'s `rollDrop`:
- Gold: `5 + Math.floor(rng() * 11)` → 5-15 inclusive.
- Item: 30% chance (`CACHE_ITEM_CHANCE = 0.3`) of one item picked uniformly at random from a fixed pool (`CACHE_ITEM_POOL`): `potion`, `leatherScrap`, `batWing`, `snakeFang`, `ironScrap`, `wolfPelt`, `spiderSilk`, `orcTusk`, `wraithEssence`. (Chosen deliberately over pulling from combat drop tables — caches should read as a separate "treasure find," not a weaker copy of fighting, and the potion chance is a small incidental mitigation for the game's current lack of any out-of-battle healing.)

**Feedback:** a banner via the existing `showFlavorBanner(text)` (from `js/screens/flavorBanner.js`), formatted as `You found a stash: {gold} gold!` or `You found a stash: {gold} gold, 1 {Item Name}!` when an item also dropped. Non-blocking — movement isn't interrupted, matching the terrain-density flavor banner's behavior (explicitly not routed through `mountOverlay`).

**Marker:** once a cache is recorded at a tile, that tile permanently renders 📦 instead of its normal tile emoji (e.g., grass's 🟩), for the rest of the game, across save/load. One-time only — no further reward or interaction from walking onto an already-found cache tile.

## Data model

New `js/systems/caches.js`, mirroring the existing `exploration.js` (`markVisited`/`isVisited`) and `screenSeen.js` pattern — small, pure, immutable-update functions with no DOM dependency:

```js
export const CACHE_CAP_PER_SCREEN = 3;
export const CACHE_ITEM_CHANCE = 0.3;
export const CACHE_ITEM_POOL = ['potion', 'leatherScrap', 'batWing', 'snakeFang', 'ironScrap', 'wolfPelt', 'spiderSilk', 'orcTusk', 'wraithEssence'];

export function hasCache(caches, screenId, x, y) { /* ... */ }
export function countCaches(caches, screenId) { /* ... */ }
export function recordCache(caches, screenId, x, y) { /* returns new caches object, immutable */ }
export function rollCacheLoot(rng = Math.random) { /* returns { gold, item } */ }
```

New state field `state.caches`, same shape as `state.visited` (`{ [screenId]: { "x,y": true } }`), added to `createNewGame()` in `state.js` and to the backward-compatibility init block in `main.js` (`if (!state.caches) state.caches = {}`) so existing saves don't break, the same way `visited` and `seenScreens` are already backfilled there.

## Wiring changes

- **Map data files** (`js/maps/townMap.js`, `js/maps/dungeonMap.js`, all 9 files under `js/maps/wilderness/`): add `cacheChance` field alongside the existing `encounterChance`.
- **`js/screens/mapScreen.js`**:
  - `tryMove()`: insert the cache-roll-then-encounter-roll logic described above, replacing the current unconditional encounter roll.
  - `render()`: when drawing a tile, check `hasCache(state.caches, mapConfig.id, x, y)` first — if true, render 📦 instead of `tile.emoji`.
  - New callback `callbacks.onCacheFound(loot)` fired when a cache is found (mirrors the existing `onEncounter(monsterId)` callback shape).
- **`js/main.js`**: new `handleCacheFound(loot)` handler wired into `goToMap()`'s callbacks object, applying `addGold`/`addItem` (reusing the existing `inventory.js` helpers exactly as `handleBattleEnd` already does), calling `showFlavorBanner()` with the formatted message, then `saveState(state)` and `renderHud()`.

## Testing

- New `tests/caches.test.js`: `recordCache`/`hasCache` round-trip and immutability (mirrors `tests/exploration.test.js`'s existing test shapes), `countCaches` correctness, `rollCacheLoot` with injected deterministic `rng` covering both the item-hit and item-miss branches and the gold range boundaries (`rng() = 0` → 5 gold, `rng()` just under 1 → 15 gold).
- Extend `tests/maps.test.js`: every map (including town) has a numeric `cacheChance` field; town's is exactly `0`.
- Extend `tests/state.test.js`: `createNewGame()` includes an empty `state.caches` object.
- Manual verification: walk around a wilderness screen long enough to find a cache (chance is low — may need to force `Math.random` temporarily or just play for a while), confirm the banner text and gold/item actually land in state, confirm the tile now shows 📦 after leaving and re-entering the screen (save/load persistence), and confirm no more than 3 caches ever appear on one screen even after extensive walking.

## Non-goals confirmed with user

- No mini-dungeons in this build — separate follow-up design.
- No per-map reward tuning in v1 — flat global reward table.
- No repeat/farmable caches — one-time discovery only, marker is purely informational afterward.
