# Emoji RPG — POC Design

**Date:** 2026-08-11
**Status:** Approved for planning

## Summary

A browser-based, single-hero RPG using emoji as all art/assets. Player navigates
a grid-based overworld, enters emoji-triggered battles on a separate battle
screen, visits a small town to shop and upgrade gear, and can dive into one
dungeon culminating in a boss fight. Progress (stats, gear, gold, position)
auto-saves to `localStorage`. Goal is a complete, playable core loop — not a
finished game — that's easy to expand with more content later.

## Goals

- Full loop feels real: explore → encounter → fight → loot → shop/smith → repeat
- Grinding exists but isn't tedious — fast early levels, meaningful but not
  punishing difficulty ramp into the dungeon boss
- No build tooling — runs as static files, opens in a browser
- Low iteration cost — small, well-bounded JS modules, no framework

## Non-goals (for this POC)

- Multi-character party (solo hero only)
- Multiple towns/dungeons/regions (one of each)
- Stat-point allocation on level-up (fully automatic growth)
- Multi-monster battles (1v1 only)
- Any death penalty (see below)

## Architecture

Single-page app, vanilla JS with ES modules, no bundler/build step. Rendering
is DOM + CSS Grid — every map tile is a `<div>` containing an emoji glyph,
styled by a tile-type lookup table. No canvas.

**Core state:** one `gameState` object holding player stats, inventory,
equipment, current map + position, and progress flags (e.g. "dungeon boss
defeated"). `gameState` is the single source of truth; screens render from it
and mutate it through explicit functions (no hidden state elsewhere).

**Screen manager:** a small state machine swaps which "screen" is mounted into
the main container:

- `Overworld` — grid movement, random encounters, entrances to Town/Dungeon
- `Town` — grid movement, no encounters, entrances to Shop/Smith
- `Dungeon` — grid movement, higher encounter rate, boss room at the end
- `Battle` — ATB combat UI, entered from Overworld/Dungeon, returns to
  whichever map/position triggered it
- `Shop` — buy gear with gold, entered/exited from Town
- `Smith` — upgrade equipped gear with gold + materials, entered/exited from
  Town

Movement input (arrow keys/WASD) is only live on the three map screens.
Stepping onto a "wild" tile rolls a per-step encounter chance against that
map's monster table; matching a monster or boss tile transitions to `Battle`.

## World

- **Overworld:** one ~20×15 tile grid. Tile types: grass (walkable, encounter
  chance), tree/water (blocked), town entrance, dungeon entrance.
- **Town:** one small grid (~8×6). Buildings for Shop and Smith, exit back to
  overworld. No encounters.
- **Dungeon:** one multi-room grid, entered from the overworld. Higher
  per-step encounter chance than the overworld, its own (tougher) monster
  table, and a fixed boss tile at the end that triggers a non-random boss
  battle guarding the dungeon's best loot. Leaving or beating the boss returns
  the player to the overworld.

Maps are defined as plain 2D arrays of tile codes, kept as simple data so new
maps can be added without touching rendering/movement code.

## Character & progression

Stats: HP, Attack, Defense, Speed, Level, XP.

Equipment slots (5): Weapon, Head, Body, Legs, Accessory. Each equipped item
contributes flat stat bonuses on top of base stats.

Leveling is fully automatic: XP from kills accumulates, crossing a threshold
increases Level and bumps all base stats along a preset curve. No player
allocation. Target curve: roughly 10-15 levels, tuned so early overworld
grinding is quick and the dungeon boss is a real test of level + gear.

## Combat (ATB)

Each combatant (player, monster) has an ATB gauge that fills based on Speed;
whichever gauge fills first acts next. On the player's turn, a menu offers:

- **Attack** — Attack-vs-Defense damage formula with light randomness
- **Item** — use a consumable (e.g. Potion) in battle
- **Flee** — chance-based; always succeeds against normal monsters, harder or
  impossible against bosses

Monster turns run simple AI — normal monsters basically always attack; tougher
monsters/bosses may have a rare stronger move. Battles are 1 player vs 1
monster (no multi-monster fights in this POC).

On win: roll XP, gold, and (per monster's drop table) a chance at gear or an
upgrade material.

**On defeat:** no penalty. The player respawns in Town at full HP, keeping all
gold, items, gear, and XP (flavor: a fairy revives and carries them back).
This keeps grinding and dungeon attempts low-stakes.

## Items & economy

- **Gold:** dropped by monsters, spent in the Shop and at the Smith.
- **Drops:** per-monster-type chance table yields gold plus either a gear
  piece or an upgrade material.
- **Shop:** fixed catalog, one or two gear options per slot, purchased with
  gold and equipped directly.
- **Smith:** takes gold + the matching upgrade material to enhance a
  currently equipped item (e.g. +1 → +2), boosting its stats. This is the
  distinct purpose for materials vs. shop-bought gear.
- **Consumables:** at least a basic Potion (restores HP), usable in and out of
  battle.

## Persistence

Entire `gameState` (position, current map, stats, inventory, equipment, gold,
progress flags) serializes to `localStorage` after meaningful actions (move,
battle end, purchase, upgrade) and reloads on page load. No backend.

## Content scope (POC)

- **Overworld monsters (~4-5):** e.g. 🐗 Boar, 🦇 Bat, 🐍 Snake, 👺 Goblin —
  each with its own HP/Attack/Defense/Speed/XP/gold/drop table
- **Dungeon monsters (1-2 extra types)** tougher than overworld set
- **Boss (1):** e.g. 🐉 Dragon, guards the dungeon's best loot, non-random
  fixed encounter
- **Gear:** small set per slot (starter + shop-bought + 1-2 dungeon/boss-drop
  rare pieces), each upgradeable via the Smith
- **Consumables:** Potion at minimum

## Testing approach

Since this is a browser game with no backend, verification is manual
playtesting of the full loop (walk → encounter → fight → win/lose → loot →
town → shop/smith → dungeon → boss) plus targeted unit tests for pure logic
that's easy to get wrong: damage formula, XP/level curve, drop table rolls,
ATB gauge fill/turn order, save/load round-trip. UI/rendering is verified by
running the app and playing it, not automated.
