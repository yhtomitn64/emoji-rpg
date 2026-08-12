# World Expansion & UI Redesign — Design

**Date:** 2026-08-12
**Status:** Approved for planning

## Summary

Follow-up to the emoji RPG POC (`2026-08-11-emoji-rpg-poc-design.md`), driven by direct playtesting feedback. The single small overworld map is replaced by a 3x3 grid of connected screens centered on Town, with monster difficulty rising by distance from Town — "near town" screens stay easy, "far" corner screens (and the relocated dungeon beyond them) are meaningfully harder, so reaching the boss takes real preparation and travel. Three UI gaps found in playtesting are also addressed: there's no way to see your own stats, the battle screen fully replaces the world (disorienting), and there's no sense of where you've already explored.

## Goals

- Distance from Town becomes a real difficulty axis — the player feels the world get more dangerous as they venture out, and that danger is visible/legible (not just a stat table)
- Reaching the dungeon boss requires crossing progressively harder territory, not a short easy walk
- Player can check their own stats and equipment at any time
- Battle no longer disorients by fully replacing the screen — the world stays visible underneath
- Exploration leaves a visible trace (visited tiles) without hiding anything (no fog-of-war)

## Non-goals (for this pass)

- No fog-of-war / hidden-until-explored tiles — everything stays visible, only a visited/unvisited visual distinction is added
- No changes to the core turn/ATB combat mechanics, leveling curve, or shop/smith mechanics beyond what's needed for the new difficulty tiers
- No continuous-scroll camera — screen transitions stay discrete (walk off an edge, snap to the next screen), matching the existing tile-grid renderer
- No death-penalty changes — losing anywhere in the world still respawns the player in Town at full HP with everything intact, unchanged from the POC
- No procedural/random world or dungeon generation — screens and the dungeon stay hand-authored, same as the POC. Randomized dungeon generation was considered and explicitly deferred: it adds real complexity (guaranteeing a valid path to the boss, guaranteeing the difficulty gradient still holds on a generated layout) for a benefit (replayability) that matters most on repeat playthroughs, not this pass. Worth revisiting later, especially for the dungeon specifically.

## World structure

The single `overworldMap` is replaced by 9 linked wilderness screens arranged in a 3x3 grid, plus the existing separate Town and Dungeon maps (unchanged in kind — small, hand-authored grids entered via a special tile):

- **Center screen** — where Town's entrance tile lives; the immediate area around Town. No wild encounters (matches the current safety of walking around Town).
- **4 cardinal screens** (north/south/east/west of center) — "near town" tier.
- **4 corner screens** (northeast/northwest/southeast/southwest of center) — "far" tier. The Dungeon's entrance tile lives on one corner screen.

Each screen is its own tile-grid data module, same shape as today's map modules (`legend`, `rows`, `encounterChance`, `monsterTable`), plus a new `neighbors` field naming the adjacent screen in each compass direction (or `null` at the world's outer edge). Walking off a screen's edge transitions the player to the named neighbor, entering at the mirrored edge position (walk off the east edge at row Y, arrive on the neighbor's west edge at row Y). `mapScreen` (the generic renderer) detects an out-of-bounds move and, if the current screen has a neighbor in that direction, reports it via a callback rather than deciding anything itself — consistent with its existing "renders and reports, doesn't decide" role. If there's no neighbor (outer edge of the 3x3 grid), movement is simply blocked, same as today's map-edge behavior.

Town and Dungeon remain separate, self-contained maps entered via a tile — only the wilderness layer multiplies from 1 screen to 9.

## Difficulty tiers

- **Center screen:** no wild encounters — a safe zone around Town, same feel as today walking near the town entrance.
- **Cardinal screens (near town):** today's overworld roster (Boar, Bat, Snake, Goblin) at a similar encounter rate — this is the "easy" tier a new character starts in.
- **Corner screens (far):** a tougher roster (today's dungeon-tier Dire Wolf/Spider, likely joined by 1-2 new tougher monster types for variety), a higher encounter rate, and better average gold/item drops — pushing outward is riskier but more rewarding, giving a concrete reason to explore rather than grind in place.
- **Dungeon:** entered from the corner screen that holds its entrance; stays the final gauntlet before the boss. Because the journey to reach it now takes the player through progressively harder wilderness (and more levels/gear along the way) than the POC's short walk did, the dungeon and boss balance will be re-verified against that new expected end-state rather than assumed to still hold from the POC's tuning.

Exact monster stat numbers, per-tier rosters, and screen tile layouts are implementation details worked out during planning/building, not fixed here.

## Visited-tile tracking

Each screen tracks which walkable tiles the player has stood on, persisted in save state per screen (e.g. a set of visited coordinates keyed by screen id). Visited tiles render with a subtly dimmed/tinted background; everything else about them (walkability, encounters) is unchanged. Nothing is ever hidden — this is a visual trail, not fog-of-war.

## Stats menu

A small icon/button is added to the HUD, always visible alongside the existing Level/HP/Gold line. Clicking it opens a stats panel (visually consistent with the new battle overlay below) showing: Level, XP progress toward next level, HP/max HP, Attack, Defense, Speed, Gold, and the 5 equipped items (name, emoji, current upgrade level). Closing the panel returns to whatever screen was active underneath.

## Battle overlay

The battle screen stops replacing `#app` entirely. The map screen underneath stays mounted and visible (dimmed), and the battle UI (monster/player HP, log, action menu) renders as a floating, semi-transparent panel centered over it. The player can still see where they are in the world during a fight; movement input stays disabled until the battle ends, same as today. This is also a structural fix for a POC-era cosmetic bug where the battle screen's trailing render briefly overwrote the next-mounted screen — with the map never torn down, that class of bug can't recur.

The monster's emoji also renders noticeably larger within the battle panel than its map-tile size (the player playtesting the POC found the monster hard to make out at map-tile scale during battle) — a simple font-size increase scoped to the battle panel's monster display, no other rendering changes implied.

## Testing approach

Same split as the POC: pure logic — screen-transition target-position math (given an edge crossing and a neighbor, where does the player land), visited-tile-set updates, stats-panel data assembly — gets unit tests under Node, no DOM required. The new DOM/rendering pieces (screen grid rendering, the overlay CSS, the stats panel UI, visited-tile styling) are verified by running the game and playing it, per the POC's established approach.
