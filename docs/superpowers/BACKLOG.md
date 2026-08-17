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

### Shop sells items with no stat info ("buying blind")
Shop rows currently render as just `${emoji} ${name} — ${price}g` with
no stats — no way to tell what Lucky Charm does, or whether Iron Helm
beats Cloth Cap, before buying. The Inventory screen already has
stat-comparison logic for owned-but-unequipped items; this would reuse
that against shop listings too.

### No way to heal outside of combat except losing a fight
`state.player.hp` is only restored to max in `handleBattleEnd`'s
`'lost'` branch (js/main.js:468) — winning doesn't heal, and there's no
in-town rest option. Wants something like an inn, a town "well" tile, or
auto-restore on returning to town.

### Hover tooltips for map tiles
Explain what each tile type does (water, tree, store, smith, cave, door,
field, mountain, dungeon) on hover. Not implemented anywhere currently.

### Hero emoji customization
Let the player pick their own hero emoji. Explicitly framed as a future
pass, not urgent.

## Combat pass ideas
Several related mid-combat ideas, raised together as things to think
through in a dedicated future combat pass rather than one-off adds:

- **Potions currently cost a full turn like an attack.**
  `playerUseItem()` (js/screens/battleScreen.js:189) resets
  `playerCombatant.atb = 0`, same as `playerAttack()`. Wants potions
  taken off the shared turn-cooldown so you can drink one anytime
  without losing your turn.
- **Attack-mash fatigue.** Repeatedly mashing the attack button should
  incur an "out of breath" penalty, discouraging pure spam-clicking.
- **Swing-timer knockback on hit.** Landing a hit knocks the enemy's ATB
  gauge back slightly; getting hit knocks the player's back slightly —
  small and non-stacking so neither side gets fully locked out.
- **Timer-speed items.** Droppable gear that speeds up your own gauge or
  slows the enemy's, capped so speed can't stack infinitely — a build
  choice between "faster me," "slower them," or other effects.
- **Bonus damage at high swing-timer speed.** If timer-speed investment
  scales high enough, grant a small damage bonus too, so speed stays
  worth investing in past a soft cap. Raised more tentatively than the
  others ("more for our combat pass to think through").
- **Abilities gained on level-up.** Move away from a single "attack"
  button toward gaining new abilities as you level, closer to active
  combat than the current "dragon warrior style." No ability system
  exists anywhere in `js/` today — this is the biggest of the group,
  foundational for some of the others (e.g. multi-enemy targeting below).
- **Status log could snapshot effective stats/gear per entry.** A
  refinement of the now-shipped status log — right now an entry like
  "fought a boar, lost" can't help diagnose whether combat numbers are
  behaving as designed without knowing effective attack/defense/HP and
  equipped gear at that moment.

### Backburner / uncertain value
- **Roaming rare monster + mob leveling.** A rare monster that randomly
  spawns in already-visited areas, drops a unique weapon; paired with an
  idea that heavily-farmed mobs could slowly level up too. Timothy
  explicitly called this backburner and questioned its own value
  ("without hard content to keep grinding for, seems silly").
- **Multi-enemy battle targeting.** Abilities that hit multiple enemies
  with target selection. Depends on a much bigger feature that doesn't
  exist yet — battles are strictly one `monsterId` per encounter today,
  no multi-monster support at all. Called out as backburner.

## Balance / design gaps

### Equipment upgrades have no level cap
`upgradeItem` (js/systems/inventory.js:57-72) and `getItemEffectiveStats`
(js/systems/inventory.js:74-82) never cap `upgradeLevel` — each upgrade
just keeps costing more (`upgradeCost` = `UPGRADE_BASE_COST *
(currentLevel + 1)`, linear, not accelerating) and keeps adding a flat
+25%/level to the item's stats, forever. Timothy's concern: without a
cap, there's no reason to ever switch to a new drop — you can just keep
paying to upgrade your current item to match or beat it, so new loot
loses its point. Fix direction: add a `MAX_UPGRADE_LEVEL` constant (a
"few levels" per Timothy) in `js/systems/inventory.js`, have
`upgradeItem` reject/no-op past the cap, and cover it with a unit test
(upgrade to cap succeeds, one more attempt past the cap is rejected,
stats stop increasing past the cap). Confirmed via code read — this
isn't a maybe, the cap genuinely doesn't exist today.

### NG+ doesn't reset `lossStreak`
`resetWorldForNgPlus` (js/systems/ngPlus.js:45-59) resets `bossTier`,
`caches`, `gateRewards`, etc., but not `lossStreak`. Entering NG+ on a
5-loss streak grants the full 5-potion comeback bonus on the first NG+
death. Technically spec-compliant for the comeback-mechanic plan (only a
win resets the streak, by design) but the plan never explicitly decided
whether NG+ should also reset it — a design call, not a bug. (Surfaced
by the final whole-branch review of the comeback-mechanic plan,
2026-08-17.)

### Hero-revival glow may cancel the death-blow hit-flash/shake
On the killing blow, `.battle-hit-flash`/`.battle-hit-shake` and the new
`.battle-revive-glow` (css/styles.css:210-230) are briefly applied to
the same elements at the same specificity, and the later-declared
`.battle-revive-glow` wins — so the red flash/shake on the exact hit
that ends the fight may get visually overridden by the green revival
pulse. Purely cosmetic (arguably "green replaces red on death" reads
fine), but nobody explicitly decided this — worth a 30-second look
during a playtest to confirm it's not jarring. If it needs separating,
move the glow to a distinct CSS property or a wrapper element instead of
sharing `animation`/`filter` with the hit effect. (Surfaced by the final
whole-branch review of the comeback-mechanic plan, 2026-08-17.)

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

**Update (2026-08-17):** Timothy suspected this might already be
partially handled, and checking the code confirms a natural mitigation
already exists — it just isn't a deliberate "detect a weak enemy and
speed things up" feature. The ATB tick interval itself is a fixed 300ms
(js/screens/battleScreen.js:274) that never changes, but each
combatant's gauge fill rate scales with their `speed` stat
(`tickGauge`, js/systems/combat.js:9), and `speed` grows +1 almost every
player level (js/systems/leveling.js's `statGainsForLevel`) while a
regular monster's `speed` is fixed per species (js/data/monsters.js) and
even boss-tier scaling explicitly leaves `speed` untouched
(js/systems/bossTiers.js:22, `speed: baseMonster.speed`). So a
higher-level player already gets proportionally more turns per unit
time against a low-level enemy than they did at that enemy's original
level — the existing system organically produces *some* version of the
requested effect. Whether that's enough, or a dedicated fix (like a
"quick battle" auto-resolve) is still wanted for genuinely trivial
backtracked fights, is still Timothy's call — leaving this open, just
better-informed.
