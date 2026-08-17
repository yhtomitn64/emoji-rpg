# Comeback Mechanic, Status Log & Hero Revival — Design

## Purpose

Playtesting the Savage Early Game retune surfaced a real problem: a player can go broke and out of potions on a losing streak with no reliable way to recover — loot caches are one-time-per-tile and probabilistic, so waiting for cache gold isn't guaranteed to work. This build adds a small pity mechanic (escalating free potions on repeated deaths), a way to actually see it happen (the existing flavor banner fades after ~3.5s with no history — this build adds a general-purpose scrollable log so nothing gets missed), and a visual "welcome back" cue on the hero to make the death→recovery moment feel less like nothing happened.

## Scope

**In scope:**
- `state.lossStreak` counter and an escalating comeback-potion grant on death.
- A general-purpose message history log (`js/systems/messageLog.js`), fed automatically by every existing `showFlavorBanner` call (cache finds, gate rewards, quest turn-ins, first-visit text, and the new comeback message) — not scoped to comeback messages only.
- A new "📜 Log" HUD button and overlay screen showing that history, scrollable, newest-first.
- A green revival glow/pulse on the hero's battle sprite when the player is defeated, mirroring the existing red hit-flash/shake effect.

**Out of scope (deliberately):**
- Any change to what happens on death besides the new potion grant — full heal, send to town, no gold/item loss, unchanged.
- Persisting the message log to save state / localStorage — in-memory only (see Data model).
- Gating the comeback grant on current gold/potion count — it fires on every death, unconditionally, regardless of whether the player is actually "stuck."
- The cache marker emoji (📦→💰) — already fixed directly as a one-line change, not part of this build.
- Hero avatar customization — raised in the same conversation, backlogged separately for a future pass.
- Any change to `js/systems/leveling.js` or monster stats — this build is entirely about recovery-after-death, not difficulty tuning.

## Mechanics

### Comeback potions

- `state.lossStreak`: integer, starts at 0.
- On battle outcome `'lost'` (in `main.js`'s `handleBattleEnd`, alongside the existing full-heal-and-send-to-town logic):
  - `lossStreak` increments by 1.
  - `potionsGranted = min(lossStreak, COMEBACK_POTION_CAP)`, where `COMEBACK_POTION_CAP = 5` — a safety cap so a truly brutal run doesn't produce an ever-growing windfall.
  - `potionsGranted` potions are added via the existing `addItem(state, 'potion', potionsGranted)`.
- On outcome `'won'`: `lossStreak` resets to 0.
- On outcome `'fled'`: `lossStreak` is left unchanged (no win occurred, but no death either).
- Applies on every death unconditionally — not gated on current gold or potion count. This matches the escalating design as described; it's also simpler than special-casing "only when the player is actually stuck," and an escalating grant naturally does nothing extra for a player who's doing fine (they're winning, so the streak keeps resetting to 0-then-1).

New pure module `js/systems/comeback.js` (mirrors `toolGates.js`/`caches.js`'s pure, DOM-free shape):
- `COMEBACK_POTION_CAP = 5`
- `incrementLossStreak(lossStreak)` → `lossStreak + 1`
- `potionsForStreak(lossStreak)` → `Math.min(lossStreak, COMEBACK_POTION_CAP)`
- `getComebackMessage(potionsGranted)` → returns the banner copy (see below)

`handleBattleEnd`'s `'lost'` branch composes these: increments and stores `state.lossStreak`, computes `potionsGranted`, applies `addItem`, and calls `showFlavorBanner(getComebackMessage(potionsGranted))`.

### Comeback explanation text

Fires via the existing `showFlavorBanner` — same call that now also populates the new log automatically (see below), so the player can always scroll back and re-read it even after it fades. Copy, escalating with `potionsGranted`:

- 1 potion: `"Something takes pity on you — +1 potion to keep you going."`
- N potions, N ≥ 2: `` `Another rough one... +${N} potions this time.` ``

### Hero revival animation

- Triggered inside `js/screens/battleScreen.js`'s `endBattle('lost')` branch, during the existing 1200ms (`VICTORY_PAUSE_MS`) pause before `onBattleEnd` fires — the same window the battle screen already sits on before unmounting.
- New `playReviveEffect(zoneEl, emojiEl)` function, same shape as the existing `playHitEffect`: adds a new CSS class to the hero's zone/emoji elements (`elements.heroZone`, `elements.heroEmoji`). No explicit removal needed — the whole battle overlay unmounts ~1.2s later when `onBattleEnd` fires, taking the DOM (and the class) with it.
- New CSS: a soft green glow/pulse, distinct from the existing red hit-flash filter —
  ```css
  .battle-revive-glow {
    animation: battle-revive-pulse 1.1s ease-in-out;
  }
  @keyframes battle-revive-pulse {
    0% { filter: none; }
    40% { filter: drop-shadow(0 0 10px #4ade80) brightness(1.25); }
    100% { filter: none; }
  }
  ```
- Fires on every death (the visual "you went to 0 HP, then got back up" moment), independent of the comeback mechanic's own logic — `battleScreen.js` doesn't need to know about `lossStreak` or potion counts at all; that composition happens afterward in `main.js`'s `handleBattleEnd`, once the battle overlay has already unmounted.

### Status message log

New pure module `js/systems/messageLog.js`:
- `MESSAGE_LOG_CAP = 50`
- `appendMessage(log, text)` → returns a new array with `text` appended, oldest entries dropped once length exceeds `MESSAGE_LOG_CAP` (chronological order, oldest first).

The mutable log array itself lives in `js/screens/flavorBanner.js`, since that module is already the sole place `showFlavorBanner` is called from — it stays the single integration point that touches both the DOM banner and the log array, while `messageLog.js` stays a pure, easily-unit-tested array transform.
- `showFlavorBanner(text)`: unchanged behavior (shows the fading banner), plus now also calls `appendMessage` internally to grow the log.
- New export `getMessageLog()` → returns the current log array (read-only from the caller's perspective; screens render from a fresh copy).

### Status log UI

- New "📜 Log" button added to `renderHud()` in `main.js`, next to the existing Stats/Inventory buttons — same `disabled` behavior during battle (`setHudButtonsEnabled` grows to cover it).
- New `js/screens/messageLogScreen.js`, mirrors `statsPanel.js`'s contract exactly: `mount(root, { state, callbacks: { onClose } })` / `unmount()`, opened via the existing `mountOverlay`/`unmountOverlay` pattern (see `openStats`/`openInventory` in `main.js` for the shape to copy).
- Renders `getMessageLog()` newest-first, one row per entry, in a scrollable container; a Close button matching the Stats/Inventory overlay's existing style.

## Data model

- `state.lossStreak`: new integer field, default 0, added to `createNewGame()` in `js/state.js`. Backfilled on load in `main.js`'s `startGame`, following the exact existing pattern used for `gateRewards`/`bossTier`/etc.: `if (!state.lossStreak) { state.lossStreak = 0; }`.
- The message log is **not** part of `state` and is **not** persisted — it's a UI/session convenience, not game state. It lives as a plain in-memory array inside `flavorBanner.js`, reset on every page reload. This avoids growing every save file forever and sidesteps any save-migration concerns for a field that's purely cosmetic/informational.

## Wiring changes

- **New:** `js/systems/comeback.js` — pure, `incrementLossStreak`/`potionsForStreak`/`getComebackMessage`/`COMEBACK_POTION_CAP`.
- **New:** `js/systems/messageLog.js` — pure, `appendMessage`/`MESSAGE_LOG_CAP`.
- **New:** `js/screens/messageLogScreen.js` — overlay screen, mirrors `statsPanel.js`.
- **Modify:** `js/screens/flavorBanner.js` — owns the mutable log array; `showFlavorBanner` grows to also call `appendMessage`; new `getMessageLog()` export.
- **Modify:** `js/screens/battleScreen.js` — new `playReviveEffect`, called from the `outcome === 'lost'` branch of `endBattle`.
- **Modify:** `js/main.js` — `handleBattleEnd`'s `'lost'` branch grows to call the comeback-mechanic functions and `showFlavorBanner`; `renderHud`/`setHudButtonsEnabled` grow to cover the new Log button; new `openMessageLog` function mirroring `openStats`/`openInventory`; `startGame` grows a `lossStreak` backfill line.
- **Modify:** `js/state.js` — `createNewGame()` gains `lossStreak: 0`.
- **Modify:** `css/styles.css` — new `.battle-revive-glow` class and `@keyframes battle-revive-pulse`.

## Testing

- `comeback.js`: unit tests for `incrementLossStreak` (increments correctly), `potionsForStreak` (1:1 below the cap, clamped at `COMEBACK_POTION_CAP` above it), `getComebackMessage` (singular vs. plural copy, correct N interpolated).
- `messageLog.js`: unit tests for `appendMessage` — normal append, cap enforcement at the 51st entry (oldest dropped, newest kept), ordering preserved.
- Existing `npm test` suite must continue passing unchanged, including save/load and backfill-related coverage if any exists for state shape changes.
- Manual verification (no automated test can cover DOM/CSS animation or live play feel):
  - Lose 3 battles in a row without an intervening win → potions granted are 1, then 2, then 3; banner text matches each count.
  - Win a battle → next death after that grants 1 potion again (streak reset confirmed).
  - Flee a battle → does not reset or increment the streak (verify next death's grant continues the prior count).
  - Open the Log button mid-session → previously-fired banner messages (cache finds, comeback messages, etc.) are all present, newest-first, scrollable.
  - Watch the battle screen on a loss → hero sprite shows the green revival pulse during the pause before returning to town.
