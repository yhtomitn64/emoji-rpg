# Backlog

Ideas, bugs, and follow-ups raised mid-session that aren't part of the
current plan. Not prioritized — just captured so nothing gets lost.

## Bugs

### Boss rematch: difficulty tier advances on accept, not on win
`state.bossTier` is incremented in `js/main.js:359`
(`handleBossBattle`'s `onAccept` callback) the moment the player accepts
the escalation prompt — before the fight happens. If that fight is then
lost, the tier bump is never rolled back, so the next rematch offer
starts from the higher tier as if it had been cleared. Net effect: you
can lose a tier and still "progress" past it.

Fix should move the increment into `handleBattleEnd`'s `'won'` branch
(js/main.js, near `state.flags.dungeonBossDefeated = true;` at line
~460), gated on `monster.isBoss`, mirroring how `activeBossTierXp` is
already tracked as in-flight state across a boss fight. Needs a unit
test asserting `state.bossTier` does NOT advance on a boss loss, only on
a win, using `js/systems/bossTiers.js`'s existing pure functions
(`shouldPromptForRematch`, `getBossTierStats`) as the test surface —
`MAX_BOSS_TIER = 2` (3 total tiers/difficulties).

### Inventory panel can overflow off-screen with no way to scroll/close
`.inventory-panel` (js/screens/inventoryScreen.js:74) uses the shared
`.overlay-panel` class, which has no `max-height`/`overflow-y` (css/
styles.css:162). `#overlay` itself is `position: fixed` with no scroll
handling either. A long inventory list pushes the Close button below
the viewport with no scrollbar to reach it. Same root cause class as
the message-log scroll gap fixed in the comeback-mechanic plan (see
`.message-log-list`, css/styles.css:171) — reuse that pattern
(`max-height` + `overflow-y: auto` on the item-list container, not the
whole panel, so the Close button stays pinned/reachable).

## Feature requests

### Visual indicator for which dragon difficulty tiers have been beaten
When approaching the boss fight, show which tiers (0 through
`MAX_BOSS_TIER`) have already been cleared — stars, trophies, or similar
— likely on `bossPromptScreen` alongside the existing tier-escalation
text. Depends on the difficulty-skip bug above being fixed first, since
"beaten" needs to mean "actually won," not "tier counter advanced."

### Use a potion outside of combat
Currently potions can only be used mid-battle. Add a way to consume one
from the inventory/town screens.

### Enemy attacks immediately when its ATB bar fills (currently player
can always flee)
If the enemy's turn bar fills before the player's, the enemy should act
immediately rather than waiting for the player's next input — as-is, the
player can always choose to flee once the enemy is "ready," which
defeats the tension of being caught off guard. Needs a look at the ATB
tick/turn-resolution loop in `js/screens/battleScreen.js`.

### Shop: sell-back for misclicks
Buying an item by accident currently can't be undone. Add a sell-back
option (likely at a discount) for the item just purchased, or generally.

### Shop/inventory: distinguish "equipped" from "owned but unequipped"
The shop and inventory screens don't currently make it visually obvious
whether an owned item is the one currently equipped versus just sitting
in inventory.

## Open question (not yet decided)

### Faster battle timer against weaker enemies?
Idea: scale the ATB fill speed (or attack cadence) up when the player is
significantly more powerful than the enemy, so battles against
low-threat/backtracked monsters resolve faster instead of feeling
arduous. Raised with an explicit caveat from Timothy: "but maybe that is
just too much power creep" — needs a decision, not just an implementation,
before this goes on a plan. Consider whether it's really a *speed*
problem (grind-through-old-content fatigue) rather than a power-scaling
problem, which might argue for a different fix (e.g. a "quick battle"
auto-resolve for trivial fights instead of a permanent speed multiplier).
