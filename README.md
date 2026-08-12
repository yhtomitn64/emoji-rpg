# Emoji RPG

A browser-based RPG using emoji for all art. Walk the overworld, fight monsters
in turn-based ATB battles, level up, loot gear and gold, shop and upgrade gear
in town, and clear the dungeon's boss.

## Run it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Run tests

```bash
npm test
```

Requires Node.js 18+ (uses the built-in `node:test` runner — no dependencies to install).

## Controls

Arrow keys or WASD to move. In battle, click the action buttons (Attack / Item / Flee) once your ATB gauge is full.
