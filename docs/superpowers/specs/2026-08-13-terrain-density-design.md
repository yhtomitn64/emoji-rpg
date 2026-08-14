# Terrain & Density Pass — Design

**Date:** 2026-08-13
**Status:** Approved for planning

## Summary

First installment of the "World Content" backlog item, driven by direct playtest feedback that the map feels sparse and every wilderness screen looks identical. This pass quadruples each wilderness screen's tile count (double width, double height) and gives each of the 9 screens a genuinely distinct terrain layout instead of today's copy-pasted decoration, plus a short fading flavor-text banner the first time a screen is entered. It does not touch difficulty, monster tables, or introduce any new blocking tile types — those are separate, already-queued backlog items (tool-gated traversal, silly monster names, combat balance).

## Goals

- Each wilderness screen feels noticeably bigger to walk across and visually distinct from its neighbors
- The world never loses connectivity — every open border stays fully walkable and the path to the dungeon is always reachable, verified automatically, not just by eyeballing the new layouts
- Entering a screen for the first time gives a small moment of atmosphere without interrupting movement or requiring a dismiss action

## Non-goals (for this pass)

- No new blocking tile types (mountains, stones, tool-gated obstacles) — that's the separate "tool-gated traversal" project already on the backlog
- No changes to monster tables, encounter chance values, or any difficulty tuning — this pass is geometry and atmosphere only. Bigger screens mean more steps (and so incidentally more encounter rolls) per crossing at the current per-step rate; that pacing effect is left as-is for this pass and revisited later under the "combat feel & balance" backlog item if it feels off after playing, rather than solved here alongside the geometry change.
- No changes to Town or Dungeon map size — only the 9 wilderness screens grow
- No monster renaming (separate "silly monster names" backlog item)

## Screen size

Each of the 9 wilderness screens (`center`, `north`, `south`, `east`, `west`, `northeast`, `northwest`, `southeast`, `southwest`) grows from 15×11 to 30×22 tiles — exactly 4x the tile count. The 3x3 world-grid shape and every screen's `neighbors` links stay exactly as they are; only each screen's own interior grid gets bigger. The existing edge-transition math (`computeEdgeLandingPosition` in `js/systems/world.js`) already reads each map's actual dimensions at runtime rather than assuming a fixed size, so it needs no change for this pass.

## Terrain variety

Each screen gets its own distinct arrangement of the existing tile types (grass, tree, water) — different water body shapes and placement, different tree density and clustering, different amounts of open space — rather than the identical water-patch-plus-tree-pair every screen currently has. `center`, `southeast` (dungeon entrance), and `northeast`/`northwest`/`southeast`/`southwest`'s existing special-tile placements (town entrance, dungeon entrance) are preserved at sensible spots within the larger grid.

Every border edge that has a neighbor must stay fully walkable along its whole length (same rule as the original world-expansion pass), and this keeps being verified automatically by the project's existing map-connectivity tests, extended to check the new dimensions — a real regression here (a screen quietly cutting off access to a neighbor, or to the dungeon) would fail the test suite, not just be missed by eye.

## First-visit flavor text

Each wilderness screen gets one short line of flavor text. The first time the player enters that screen (tracked per-screen in save state, similarly to how visited tiles are already tracked), the line fades in as a small banner — no click to dismiss, doesn't block movement or input — and fades back out on its own after a few seconds. Re-entering a screen later shows nothing; the moment is once-per-screen, not once-per-visit.

## Testing approach

Same split as prior passes: the "screen seen" state tracking (a new small pure module, mirroring `js/systems/exploration.js`'s `markVisited`/`isVisited` pattern) gets unit tests under Node. The map-connectivity tests (`tests/maps.test.js`) get extended to the new 30×22 dimensions and continue to be the automated guarantee that terrain variety never breaks reachability. The actual terrain layouts and the flavor-text banner's visual timing are DOM/content work, verified by playing the game, per the project's established approach.
