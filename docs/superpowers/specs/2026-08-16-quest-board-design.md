# Quest Board — Design

## Purpose

Give the player a directed, repeatable reason to hunt specific monster types, with a reward that's actually useful now that materials are slot-matched at the smith (shipped just before this): guaranteed access to a specific upgrade material instead of hoping for a drop. Deliberately no gold/XP reward — those already feel abundant at higher levels, and adding more of what's already plentiful wouldn't make the board worth visiting.

## Scope

**In scope:**
- A new `📋 Quest Board` tile in town, opening a full-screen board (mirrors the existing Shop/Smith screens).
- One repeatable bounty per non-boss monster (8 total: boar, bat, snake, goblin, direWolf, spider, orc, wraith) — kill a set number, turn in for one guaranteed copy of that monster's upgrade material.
- Kill tracking that persists across NG+ transitions (unlike world/map state, which resets).

**Out of scope (deliberately):**
- The dragon — it already has its own dedicated rematch/escalation system; a generic bounty would be redundant and tonally off for the story boss.
- Gold or XP rewards of any kind.
- Quest rotation/randomization — every monster's bounty is always available, all the time.
- The two ideas raised alongside this (a rare wandering "hunt" monster, monsters leveling up from repeated grinding) — both explicitly backburnered by the user pending the separate combat-balance work.

## Mechanics

- **Requirements, by monster tier** (matches the world's existing near-town/far-corner/dungeon difficulty banding): boar, bat, snake, goblin (near-town) require 3 kills each; direWolf, spider, orc, wraith (far-corner/dungeon) require 2 kills each.
- **Reward derivation**: rather than hardcoding a second monster→material table (which could drift from the real drop tables), the reward for each monster is derived directly from `MONSTERS[monsterId].dropTable` — specifically, the drop-table entry whose item has `type: 'material'`. This automatically stays correct if a monster's material drop ever changes, with no quest-side data to keep in sync. Concretely today: boar→leatherScrap, bat→batWing, snake→snakeFang, goblin→ironScrap (its weapon drop `goblinClub` is skipped since it isn't a material), direWolf→wolfPelt, spider→spiderSilk, orc→orcTusk, wraith→wraithEssence.
- **Progress tracking**: every win against a quest-eligible monster increments a per-monster counter, anywhere it happens (wilderness, dungeon, any NG+ cycle) — kills never expire and never regress. This is separate from combat rewards; it doesn't change drop rates, gold, or XP from the fight itself.
- **NG+ interaction**: quest progress is treated as player-side progress (like level and gear), not world state — it is **not** reset by `resetWorldForNgPlus`, unlike map/flags/caches.
- **Turn-in**: visiting the board shows all 8 monsters with a live "X/N killed" count; a **Turn In** button per row is enabled once the requirement is met. Turning in grants exactly 1x the reward material and immediately resets that monster's counter to 0, so the bounty is live again right away. No confirmation needed — turning in a completed quest has no downside to reconsider.

## Data model

- `state.questProgress`: object keyed by the 8 quest-eligible monster ids, each a kill counter starting at `0`. Added to `createNewGame()`, backfilled on load for existing saves the same way every other new field has been.
- New `js/systems/quests.js`: pure, DOM-free, mirrors the existing `bossTiers.js`/`ngPlus.js` module shape.
  - `QUEST_REQUIREMENTS` — `{ boar: 3, bat: 3, snake: 3, goblin: 3, direWolf: 2, spider: 2, orc: 2, wraith: 2 }`
  - `getQuestRewardItemId(monsterId)` → the material itemId, derived from `MONSTERS[monsterId].dropTable` as described above
  - `incrementQuestProgress(state, monsterId)` → new state with that monster's counter +1; a no-op (returns `state` unchanged) if `monsterId` isn't quest-eligible (i.e., the dragon, or any future non-quest monster)
  - `canTurnInQuest(state, monsterId)` → boolean, counter ≥ requirement
  - `turnInQuest(state, monsterId)` → new state: counter reset to 0, reward material added via the existing `addItem` from `js/systems/inventory.js`; throws if the quest isn't actually complete (defense-in-depth — the UI only ever renders an enabled button when it's true)
- New `js/tiles.js` entry: `questBoard: { emoji: '📋', walkable: true, encounter: false, action: 'enterQuestBoard' }`.
- `js/maps/townMap.js`: new `Q` legend entry mapping to `'questBoard'`, and one `Q` placed in the town layout (row 1, away from the existing `S`/`M`/`E` tiles and the player's start position).
- New `js/screens/questBoardScreen.js`: mirrors `smithScreen.js`'s per-row template-string pattern — one row per monster (emoji, name, "X/N killed", Turn In button disabled until met), plus a Leave button. Mounted via `mountScreen` (a full screen, not an overlay, matching Shop/Smith).

## Wiring changes

- **`js/state.js`**: `createNewGame()` adds `questProgress` initialized to all-zero for the 8 quest monsters.
- **`js/main.js`**: `startGame()`'s backfill block gains a `questProgress` check; `handleTileAction` gains `enterQuestBoard` → a new `goToQuestBoard()` (mirrors `goToShop`/`goToSmith`); `handleBattleEnd`'s `'won'` branch calls `incrementQuestProgress(state, monsterId)` after its existing reward logic (order doesn't matter — quest tracking is independent of gold/XP/drop scaling).
- **`js/tiles.js`**, **`js/maps/townMap.js`**: as described above.

## Testing

- `tests/quests.test.js`: `QUEST_REQUIREMENTS` has exactly the 8 expected keys with the expected values; `getQuestRewardItemId` returns the correct material for all 8 monsters (spot-checking the goblin case specifically, since it's the one with a non-material first drop-table entry); `incrementQuestProgress` increments the right counter and is a no-op for a non-quest monster id (e.g. `'dragon'`); `canTurnInQuest` at the exact boundary (one below requirement = false, exactly at = true); `turnInQuest` resets the counter, adds exactly one of the correct material, and throws if called before the requirement is met.
- Extend `tests/state.test.js`: fresh state has `questProgress` with all 8 monsters at `0`.
- No automated test for `questBoardScreen.js` or the `main.js` wiring — matches this project's convention for every other DOM screen and integration point.

## Non-goals confirmed with user

- No gold/XP reward, ever, for any quest.
- No quest for the dragon.
- No rotation — every quest is always available.
- Rare hunt-monster and grind-based monster leveling are explicitly out of scope, deferred to the backlog.
