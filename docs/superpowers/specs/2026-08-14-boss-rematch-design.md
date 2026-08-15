# Boss Rematch & Escalating Difficulty — Design

## Purpose

The dragon boss was made infinitely re-fightable (2026-08-14, stopgap) at a single fixed difficulty. This build adds the escalation system that stopgap was explicitly deferring: an opt-in, narratively-framed way to fight a harder dragon on rematch, capped after two escalation steps, with proportionally bigger XP as the reward. This is "harder content" reusing everything that already exists (the dragon fight, its drop table, its re-trigger), rather than new zone content.

## Scope

**In scope:**
- A new `state.bossTier` (0/1/2, persists forever, no reset mechanism).
- A blocking pre-fight prompt, shown only when a rematch is possible and a higher tier is still available, offering to escalate or stay at the current tier.
- Tier-scaled combat stats (HP, attack, defense) and XP for the dragon fight itself.
- 5 rotating flavor lines shown in the prompt.

**Out of scope (deliberately, per this session's decisions):**
- Any UI for choosing a specific tier (no dropdown/menu of tiers) — only a binary "escalate one step" vs "stay" choice, exactly once per available step.
- Gold and item drop scaling — unaffected by tier, matching the existing drop table at every tier.
- Flavor text in the battle log itself (the existing "A wild Dragon appears!" line is untouched) — flavor lives only in the pre-fight prompt.
- Any changes to non-boss monsters, other maps, or the mini-dungeon/cache systems.
- A "walk away without fighting" option — every visit to the boss tile ends in a fight, matching how every other action tile in this game already behaves.

## Mechanics

**Trigger conditions for the prompt.** Stepping onto the boss tile:
- If the dragon has never been defeated (`state.flags.dungeonBossDefeated` is `false`): fight starts immediately at tier 0, exactly as today — no prompt (there's nothing to "return" from yet).
- If `state.bossTier` is already at the max (2): fight starts immediately at tier 2 — no prompt (no further choice exists).
- Otherwise (defeated at least once, and a higher tier is still available): a new blocking overlay opens first — one of 5 flavor lines, picked at random each time, plus two buttons: **Fight!** (escalates `state.bossTier` by one, persists it, then fights at the new tier) and **Not yet** (fights at the current `state.bossTier`, unchanged).

**Tier stats.** A pure function computes the dragon's effective stats for a given tier from its base `MONSTERS.dragon` values:
- HP and XP double per tier (compounding): 110→220→440 HP, 150→300→600 XP.
- Attack and defense rise ~25% per tier (compounding): attack 34→43→53, defense 12→15→19.
- Speed is unchanged at every tier (11) — escalation is about toughness and reward, not turn-order pacing.
- Gold range and drop table (`dragonScaleMail`/`dragonFang` chances) are unaffected by tier at every level.

Tier 0's computed stats are identical to the dragon's current base stats, so a player who never engages with the rematch system sees no behavior change at all.

**Combat wiring.** `handleEncounter(monsterId, monsterOverrides)` gains an optional second parameter — a partial stat object (`hp`/`attack`/`defense`/`speed`) merged on top of the base monster lookup inside the battle screen's combatant builder, so the battle UI itself needs no boss-specific logic. The boss-tile action handler computes the current tier's full stat block once, passes the combat-relevant fields as `monsterOverrides` into the fight, and keeps the tier's XP value available (via a small piece of module-scoped state in `main.js`, the same pattern already used for the existing `battleActive` flag) so the post-battle XP award uses the tier's XP instead of the base monster's XP. Every other caller of `handleEncounter` (regular wandering monster encounters) is unaffected — they simply don't pass the second argument.

## Data model

- `state.bossTier`: number, `0` initially, `0`/`1`/`2` thereafter. Added to `createNewGame()` and backfilled for existing saves the same way `state.caches`/`state.miniDungeons` already are.
- New `js/systems/bossTiers.js`: pure, DOM-free, mirrors the existing `caches.js`/`miniDungeons.js` module shape.
  - `MAX_BOSS_TIER = 2`
  - `BOSS_TIER_FLAVOR_LINES` — the 5 approved lines
  - `getBossTierStats(baseMonster, tier)` → `{ hp, attack, defense, speed, xp }`
  - `pickBossReturnFlavor(rng = Math.random)` → one of the 5 lines
- New `js/screens/bossPromptScreen.js`: a small overlay screen (mirrors `statsPanel.js`'s template-string + button-click pattern — no battle-style menu/keyboard-shortcut system needed, just two buttons), mounted via the existing `mountOverlay`/`unmountOverlay` mechanism.

## Wiring changes

- **`js/state.js`**: add `bossTier: 0` to `createNewGame()`.
- **`js/main.js`**: backfill `state.bossTier` in the existing load-time compatibility block; replace `handleTileAction`'s direct `handleEncounter(dungeonMap.bossMonsterId)` call for the `'bossBattle'` action with a new `handleBossBattle()` that implements the trigger-condition logic above (deciding whether to show the prompt, and calling a new `startBossFight(tier)` helper either way); `startBossFight` computes `getBossTierStats`, stores the XP portion in a module-scoped variable, and calls `handleEncounter(monsterId, { hp, attack, defense, speed })`; `handleBattleEnd`'s win branch uses the stored tier XP (falling back to the base monster's XP for any non-boss fight, where the tier variable is `null`).
- **`js/screens/battleScreen.js`**: `mount()` accepts and stores an optional `monsterOverrides` prop; `buildMonsterCombatant()` merges it onto the base `MONSTERS[monsterId]` lookup before building the combatant.

## Testing

- `tests/bossTiers.test.js`: `getBossTierStats` at tiers 0/1/2 against the exact numbers in the table above; `pickBossReturnFlavor` returns one of the 5 known lines with an injected deterministic rng.
- Extend `tests/state.test.js`: fresh state has `bossTier: 0`.
- No automated test for the `main.js`/`battleScreen.js` wiring (no DOM harness in this project, matching every prior DOM-adjacent task in this codebase) — covered by manual verification: fight the dragon once (no prompt, tier 0 stats), return and confirm the prompt appears with a flavor line, decline and confirm you fight tier 0 again, return and accept, confirm tier 1 stats (220 HP shown on the bar) and 300 XP awarded on win, repeat to confirm tier 2 (440 HP, 600 XP) and that reaching tier 2 stops the prompt from appearing on subsequent visits.

## Non-goals confirmed with user

- No tier-selection dropdown/menu — binary escalate-or-not only.
- No gold/item scaling by tier.
- No flavor text added to the battle log itself.
- No way to skip fighting the boss tile once you've stepped onto it.
