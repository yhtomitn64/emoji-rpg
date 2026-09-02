# Emoji RPG

A browser-based RPG using emoji for all art. Explore a 5x5 grid of connected
wilderness screens centered on Town — monsters get tougher the further you
travel from it — fight them in turn-based ATB battles, level up, loot gear and
gold, shop and upgrade gear in town, and clear the dungeon's boss.

## Run it

```bash
node tools/dev-server.mjs 8000
```

Then open http://localhost:8000 in a browser. This is a small
zero-dependency static file server (like `python3 -m http.server`,
which still works if you just want to browse) plus one addition: it
accepts playthrough telemetry from the game and appends it to a local,
gitignored `analytics/events.jsonl` — see
`docs/superpowers/specs/2026-09-01-playthrough-telemetry-design.md`.

## Run tests

```bash
npm test
```

Requires Node.js 18+ (uses the built-in `node:test` runner — no dependencies to install).

## Controls

Arrow keys or WASD to move. Walking off the edge of a screen crosses into the next one — the world is a 5x5 grid of screens centered on Town, and monsters get tougher the further you travel from it. Click the 📊 Stats button in the top bar to check your stats and equipment. In battle, click the action buttons (Attack / Item / Flee) once your ATB gauge is full.

Tiles you have already stood on stay visibly tinted, so you can see where you've explored — nothing is ever hidden, it's just a trail. Battles open as a floating panel over the map rather than replacing it, so the world stays visible (dimmed) behind the fight.

## Dev tools

`tools/terrain-painter/` is a browser-based, dev-only tool for hand-painting
organic terrain across all 25 wilderness screens on one continuous canvas
(plus the dungeon and mini-dungeon interiors), so terrain reads as connected
across screen boundaries instead of being authored per-screen in isolation.
Run it the same way as the game itself (`python3 -m http.server 8000` from
the repo root), then open
http://localhost:8000/tools/terrain-painter/index.html. It's never deployed
— see `tools/terrain-painter/README.md` for the full feature list, keyboard
shortcuts, and exactly how painted changes get saved into the real game
files.
