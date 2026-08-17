# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/), with a
lightweight versioning scheme suited to a solo personal project (no
public API, no formal release process — commits land straight on
`master`):

- **Versions are `MAJOR.MINOR.PATCH`.** Stay in `0.x` during early
  development.
- **MINOR** bumps for a completed feature/build (new content, new
  systems) — one bump per finished design-doc/plan under
  `docs/superpowers/plans/`.
- **PATCH** bumps for bug fixes, balance tweaks, and small polish that
  aren't their own feature.
- **1.0.0** is reserved for when the game feels like a complete,
  coherent experience — explicitly including the story (see
  `docs/superpowers/BACKLOG.md`, author-written, not AI-generated), not
  just an accumulation of systems.
- Entries land under `## [Unreleased]` while in progress and move into
  a dated version section once the work is done and committed — there's
  no separate release step to wait for.

## [Unreleased]

## [0.4.0] - 2026-08-17

Clears the entire Feature Requests backlog category in one pass — see
`docs/superpowers/BACKLOG.md` for what's left (Combat Pass, Balance
gaps, Multi-zone, one Open Question).

### Added
- Potions can be drunk from the inventory screen outside of combat, not
  just mid-battle.
- Every non-dragon monster now has a 10% chance to drop a potion.
- Shop: sell-back at half price for any owned catalog item, with
  bulk-buy shortcuts (1x/5x/10x/100x), each disabled unless the full
  quantity is affordable.
- Quest board: a "Turn In All" button.
- Character creation: pick your hero's emoji from a curated list
  (`player.emoji`, backfilled for existing saves).
- Hover tooltips on every map tile, explaining what it is/does.
- Item tooltips everywhere an item renders (shop, inventory, smith,
  quest rewards) via a shared `describeItem()` — closes the "buying
  blind" gap as a side effect instead of a bespoke shop-only fix. Shop
  rows also mark "✓ Equipped" when applicable.
- A new "📖 Loot" HUD screen listing every item, what you own, and
  where it's obtainable (monster drops, shop, mini-dungeon treasure).
- A town well tile for free, unlimited healing outside of combat —
  deliberately not an auto-heal-on-return, to keep the potion economy
  meaningful.
- Battle screen now shows faint environmental decoration (rocks/pickaxe
  in the dungeon, trees in the wilderness) instead of a bare panel.
- Two more mini-dungeon layouts (3 → 5 variants), cutting how often
  cave discoveries repeat the same layout.

### Fixed
- The enemy's attack was blockable indefinitely: once the player's own
  ATB gauge became ready, the enemy could never attack until the player
  spent their turn — a player could sit on a full gauge forever and
  never get hit. The enemy now attacks purely on its own timer.

## [0.3.0] - 2026-08-17

### Added
- First kill and every level-up now trigger a celebration effect (emoji
  burst + flavor banner), via a new screen-independent
  `js/screens/celebrationEffect.js`. First kill is a one-shot flag,
  correctly backfilled for existing characters so it doesn't misfire on
  a save that's already made progress.

## [0.2.2] - 2026-08-17

### Changed
- Buttons across the whole game now have real styling (background,
  border, rounded corners, hover/active/disabled states) instead of bare
  default browser buttons, and overlay panels / shop / smith / quest /
  start screens use much more of the viewport (`min(90vw, 720px)`
  instead of a fixed 480px) so they no longer look tiny on a large
  monitor. Inner scroll areas (message log, inventory) now cap at 55vh
  instead of a fixed 320px for the same reason.

## [0.2.1] - 2026-08-17

### Fixed
- Boss rematch prompt: "Not yet" previously meant "decline the tier
  escalation, but fight anyway" — once a player was already at max
  tier there was nothing to decline, so the same button silently
  started a fight. Buttons are now honest: Fight always fights, Not
  yet always walks away with no fight, New Game+ unchanged.

## [0.2.0] - 2026-08-17

### Added
- Equipment upgrades are now capped at `MAX_UPGRADE_LEVEL = 3` — gear
  could previously be upgraded indefinitely, removing any incentive to
  switch to a new drop.
- The boss rematch prompt now shows which dragon difficulty tiers have
  actually been cleared (stars), now that tier progress only advances on
  a real win.

## [0.1.1] - 2026-08-17

### Fixed
- Boss rematch: `state.bossTier` previously advanced the moment an
  escalation prompt was accepted, before the fight was even fought — a
  loss never rolled it back, so you could lose a tier and still
  "progress" past it. Now only advances on an actual win.
- Inventory panel could grow past the viewport with a long item list,
  pushing the Close button out of reach with no way to scroll to it.

## [0.1.0] - 2026-08-17

Retrospective baseline covering everything built before changelog
tracking started. Not a granular per-commit history — see
`docs/superpowers/plans/` and `docs/superpowers/specs/` for the full
design docs behind each of these.

### Added
- Core loop: emoji-based single-hero RPG — grid overworld, emoji-triggered
  battles, town shop/smith, one dungeon with a boss.
- World expansion: single overworld map replaced by a 3x3 grid of linked
  screens around Town, difficulty rising with distance from Town.
- Battle screen v2: hit feedback (flash/shake/floating damage numbers),
  visible ATB gauges, full scrollable combat log, win/loss pause.
- Terrain density pass: each wilderness screen quadrupled in size with
  distinct layouts, plus first-visit flavor-text banners.
- Boss rematch: opt-in escalating dragon difficulty tiers (capped),
  bigger XP reward per tier.
- Loot caches: ambient chance of finding a small gold/item stash on
  wilderness tiles, each tile marked once found.
- Mini-dungeons: rare discoverable nested sub-maps with their own
  encounters and exit back to the overworld.
- Silly monster names: goofy display names for trash monsters (boss
  keeps its serious name).
- Save slots & New Game+: named multi-slot saves plus a repeatable,
  capped NG+ mode (keep character power, reset world, tougher/better
  rewards).
- Inventory & equipment screen: view unequipped gear, manually choose
  what to equip, compare stats before swapping; auto-equip removed.
- Metroidvania tool-gating: mining pick and axe, dropped by dungeon-tier
  monsters, permanently unlock hand-picked shortcuts/loot pockets in the
  existing wilderness.
- Player growth curve rework: tapered post-level-10 stat gains, steeper
  XP curve, and partial (not full) heal on level-up past that point, to
  stop late-game trivialization.
- Quest board: repeatable quests for specific monster types, rewarding
  guaranteed upgrade materials instead of gold/XP.
- Savage early game: near-town monsters made genuinely threatening,
  armor stops being optional, the near-town → far-corner → dungeon →
  dragon escalation holds throughout.
- Comeback mechanic, status log & hero revival: escalating free potions
  on a losing streak (capped, resets on a win), a scrollable in-memory
  status log fed by every flavor banner, and a green revival-pulse
  animation on defeat.
