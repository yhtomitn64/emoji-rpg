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
