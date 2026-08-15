# Save Slots & New Game+ — Design

## Purpose

The game currently has exactly one save, tied to a single fixed `localStorage` key, loaded automatically at startup with no way to have more than one playthrough at a time. This build adds a character-select start screen backed by named, multi-slot saves, and — reusing that slot infrastructure — a repeatable, capped New Game+ mode: an opt-in harder replay that keeps your character's power but resets the world, in exchange for tougher monsters and better rewards.

## Scope

**In scope:**
- A start screen (character select) shown before any game state loads, listing named save slots with Continue/Delete, and a New Game flow to create additional slots.
- Multi-slot storage: one registry key plus one save key per slot.
- One-time migration of the existing single legacy save into a named slot.
- A capped, repeatable New Game+ cycle (NG+1, NG+2 max): world resets, player power carries over, monsters and rewards scale up per cycle.
- Wiring New Game+ combat/reward scaling through the existing encounter and battle-end flow, composing with (not stacking oddly on top of) the already-shipped boss-tier rematch system.

**Out of scope (deliberately, per this session's decisions):**
- Slot renaming after creation (delete + recreate covers it).
- Any content that exists specifically "past" the current final boss (the dragon) — NG+ makes existing content harder, it doesn't add new endgame content. That remains a separate future backlog item this system is built to support later.
- Uncapped/infinite NG+ scaling — hard-capped at NG+2.
- Changing what carries over between the boss's own escalating tier system and NG+ beyond resetting `bossTier` to 0 on each NG+ transition (already decided: the two systems don't compound across a reset).

## Mechanics

### Save slots

- The registry (`emoji-rpg-slots` key) holds `[{id, name, createdAt, lastPlayed, level, ngPlusCycle}]` — enough to render the character-select list without loading every slot's full save.
- Each slot's full game state lives under its own key, `emoji-rpg-save-<id>`, in the same shape `state.js` already serializes today.
- Autosave-on-every-move (the existing behavior) only ever touches the *active* slot's key plus a lightweight registry-entry update (`lastPlayed`/`level`/`ngPlusCycle`) — never rewrites other slots' save data.
- **Migration:** on first load after this ships, if the old fixed-key save (`emoji-rpg-save`) exists and the registry is empty, a slot named "Save" is created from it, the registry is written, and the legacy key is deleted. This runs once, before the start screen mounts.

### Start screen

- New `js/screens/startScreen.js`, mounted via the existing `mountScreen` mechanism, shown before any game state is loaded (no auto-continue).
- Each slot row shows: name, level, an "NG+N" badge when `ngPlusCycle > 0`, and a relative last-played indicator. Two actions per row:
  - **Continue** — loads that slot's save and starts the game.
  - **Delete** — a click-to-confirm toggle inline (button becomes "Confirm delete?" / "Cancel" on first click) — no native `confirm()` dialog.
- A persistent **+ New Game** row expands into a text input + Create button on click (no native `prompt()`). Creating a slot calls `createSlot(name)`, then starts the game with the fresh state.

### New Game+

- `state.ngPlusCycle`: `0` initially (added to `createNewGame()`), caps at `2`.
- `canStartNgPlus(state)` → `state.flags.dungeonBossDefeated && state.ngPlusCycle < MAX_NG_PLUS_CYCLE`.
- **Trigger:** the existing boss-rematch prompt (shipped 2026-08-15, `bossPromptScreen.js`) gains a third option, shown only when `canStartNgPlus(state)` is true: **Start New Game+**. Clicking it swaps the same panel into a confirmation state — "This resets your map progress. Your level, gear, and gold carry over. Continue?" — before calling `resetWorldForNgPlus`. This is destructive to world progress, so it always requires the explicit second confirmation click; there's no accidental one-click path into it.
  - **Important interaction with the existing prompt-gating logic:** today, `handleBossBattle` only opens the prompt at all when `shouldPromptForRematch(state)` is true (i.e., `bossTier` hasn't maxed out yet) — once `bossTier` reaches 2, fights skip straight to `startBossFight` with no prompt. That would silently hide the NG+ option too, once tier-escalation is exhausted but NG+ is still available. The gating condition changes to `shouldPromptForRematch(state) || canStartNgPlus(state)`, and the prompt itself conditionally renders the tier-escalation button and the NG+ button independently based on their own eligibility checks — either, both, or (falling through to `startBossFight` with no prompt) neither can be true.
- **What resets** (`resetWorldForNgPlus(state)`): `flags.dungeonBossDefeated → false`, `visited → {}`, `seenScreens → {}`, `caches → {}`, `miniDungeons → {}`, `activeMiniDungeon → null`, `bossTier → 0`, `map → 'center'`, `position → null` (resolved to `center`'s `startPosition` the same way a fresh game resolves it). `ngPlusCycle` increments by 1, capped at `MAX_NG_PLUS_CYCLE`.
- **What carries over:** `player` (level/xp/stats/hp/gold), `equipment`, `upgrades`, `inventory` — untouched.

### NG+ combat & reward scaling

Applied per current `state.ngPlusCycle`, same compounding-per-cycle shape as the existing boss-tier system for consistency:

| | Per-cycle multiplier | NG+1 | NG+2 |
|---|---|---|---|
| Monster HP | ×2 | ×2 | ×4 |
| Monster attack/defense | ×1.25 | ×1.25 | ×1.5625 |
| Monster speed | unchanged | — | — |
| Gold / XP reward | ×1.5 | ×1.5 | ×2.25 |
| Drop-table chance per entry | ×1.5, capped at 0.9 | — | — |

- Combat scaling composes with boss-tier scaling multiplicatively, applied in order: base monster stats → boss-tier multiplier (dragon fights only) → NG+ multiplier. Since `bossTier` resets to 0 on every NG+ transition, a fresh NG+1 dragon fight starts at tier 0 with just the NG+1 multiplier, not a stacked worst-case.
- `handleEncounter(monsterId, monsterOverrides)` in `main.js` becomes the single place NG+ scaling is applied: it computes the NG+-scaled combat stats from `MONSTERS[monsterId]` merged with any passed-in `monsterOverrides` (i.e., boss-tier stats), so every existing call site — wandering encounters and boss fights alike — gets NG+ scaling automatically with no caller changes.
- `handleBattleEnd`'s win branch scales the resolved XP and the rolled drop's gold by the current cycle's reward multiplier, and scales the monster's drop-table chances (each entry capped at 0.9) before rolling, before awarding.

## Data model

- `state.ngPlusCycle`: number, `0` initially, `0`/`1`/`2` thereafter. Added to `createNewGame()`, backfilled on load the same way `bossTier`/`caches`/etc. already are.
- New `js/systems/ngPlus.js`: pure, DOM-free, mirrors `bossTiers.js`'s shape.
  - `MAX_NG_PLUS_CYCLE = 2`
  - `NG_PLUS_HP_MULTIPLIER = 2`, `NG_PLUS_COMBAT_MULTIPLIER = 1.25` (attack/defense), `NG_PLUS_REWARD_MULTIPLIER = 1.5` (gold/xp), `NG_PLUS_DROP_CHANCE_MULTIPLIER = 1.5`, `NG_PLUS_DROP_CHANCE_CAP = 0.9`
  - `canStartNgPlus(state)`
  - `getNgPlusCombatOverrides(baseMonster, cycle)` → `{hp, attack, defense, speed}`, cycle-scaled
  - `getNgPlusRewardMultiplier(cycle)` → `{gold, xp}`
  - `scaleDropTable(dropTable, cycle)` → new drop-table array with scaled, capped chances
  - `resetWorldForNgPlus(state)` → new state fields object per "What resets" above
- New `js/systems/saveSlots.js`: pure, DOM-free.
  - `listSlots(storage)` / `createSlot(name, storage)` / `deleteSlot(id, storage)` / `touchSlot(id, summary, storage)`
  - `migrateLegacySave(storage)` — one-time import of the old fixed-key save into a named slot
- New `js/screens/startScreen.js`: mirrors the existing screen-module shape (`mount(root, props)` / `unmount()`), template-string + button-click pattern like `statsPanel.js`/`bossPromptScreen.js`.

## Wiring changes

- **`js/state.js`**: `saveState`/`loadState` gain a required `slotId` param, building `emoji-rpg-save-${slotId}` instead of the fixed `STORAGE_KEY`. `createNewGame()` adds `ngPlusCycle: 0`.
- **`js/main.js`**: module-level `state` changes from `const` to `let`, initialized `null`; a new module-level `activeSlotId` (also `let`, initialized `null`) is threaded into every existing `saveState(state)` call site as `saveState(state, activeSlotId)`. The current top-of-module bootstrapping (load/backfill/position checks, initial `goToMap`, `renderHud`) moves into a new `startGame(loadedState, slotId)` function. At true module load, `main.js` runs `migrateLegacySave`, then mounts `startScreen` with callbacks `onContinue(slotId)` (loads that slot's save, calls `startGame`) and `onNewGame(name)` (calls `createSlot`, calls `startGame` with the fresh state). `handleBossBattle`'s prompt-gating condition changes to `shouldPromptForRematch(state) || canStartNgPlus(state)` per "Trigger" above, and its `onAccept`/`onDecline` callbacks gain a third `onStartNgPlus` callback that calls `resetWorldForNgPlus` and re-renders. `handleEncounter` and `handleBattleEnd` get the scaling wiring described above.
- **`js/screens/bossPromptScreen.js`**: gains a third button (conditional on a new `showNgPlusOption` prop) and an internal confirmation sub-state, per "Trigger" above.
- **`js/screens/statsPanel.js`**: shows an "New Game+N" badge line when `state.ngPlusCycle > 0`.

## Testing

- `tests/saveSlots.test.js`: `createSlot`/`listSlots`/`deleteSlot`/`touchSlot` against a fake storage (same fake-storage pattern already used in `tests/state.test.js`); `migrateLegacySave` imports an existing legacy save into a slot and removes the old key, and is a no-op when no legacy save exists or a registry already exists.
- `tests/ngPlus.test.js`: `getNgPlusCombatOverrides`/`getNgPlusRewardMultiplier`/`scaleDropTable` at cycles 0/1/2 against the exact numbers in the table above (mirrors `tests/bossTiers.test.js`'s pattern); `resetWorldForNgPlus` preserves `player`/`equipment`/`upgrades`/`inventory`/gold and resets every listed world field, incrementing and capping `ngPlusCycle`; `canStartNgPlus` gating at each boundary.
- Extend `tests/state.test.js`: fresh state has `ngPlusCycle: 0`.
- No automated test for `startScreen.js`/`main.js` wiring or `bossPromptScreen.js`'s new confirmation UI (no DOM harness in this project, matching every prior DOM-adjacent task) — covered by manual verification: create two slots, confirm progress in one doesn't affect the other; delete a slot and confirm only its key is removed; load with a pre-existing legacy save present and confirm it migrates into a named slot exactly once; beat the dragon, confirm the NG+ option appears in the prompt, decline once (still tier-rematch flow only), then accept NG+ and confirm world state resets while gear/level/gold persist, `ngPlusCycle` shows as 1 in stats, and monster/reward numbers in the first post-reset fight match the NG+1 multipliers; repeat to NG+2 and confirm the option disappears once capped.

## Non-goals confirmed with user

- No slot renaming.
- No new content past the dragon — NG+ scales existing content, doesn't add endgame content.
- No uncapped NG+ scaling — hard cap at NG+2.
- No stacking of boss-tier and NG+ scaling across a reset — `bossTier` resets to 0 every NG+ transition.
