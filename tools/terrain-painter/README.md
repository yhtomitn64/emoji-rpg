# Terrain Painter

A browser-based, dev-only tool for hand-painting the game's maps. Loads all
25 wilderness screens onto one continuous canvas, laid out exactly like the
real 5x5 world, so terrain painted across a screen boundary reads as
connected instead of being authored per-screen in isolation. It can also
switch to painting the dragon dungeon or any mini-dungeon variant as a
standalone map.

It is never deployed — `.github/workflows/deploy.yml` stages an explicit
allowlist of files/dirs into the live build, and `tools/` isn't on it. It
only exists locally.

## Run it

```bash
python3 -m http.server 8000
```
from the repo root, then open http://localhost:8000/tools/terrain-painter/index.html.

## How saving actually works (read this first)

**Painting on the canvas never touches the real game files by itself.**
Everything you paint lives in your browser's `localStorage` (key
`terrain-painter-autosave-v1`) until you explicitly export it and paste it
into the corresponding file under `js/maps/`. There is no "save" button —
only "export."

- **On page load**, the painter checks `localStorage` first. If it finds
  saved-but-unexported work there, it restores that (you'll see "Restored
  unsaved changes from your last session"). Only if `localStorage` is empty
  does it load straight from the real `js/maps/wilderness/*.js` files.
- **If you clear your browser's site data/cookies** (not just an
  images/scripts cache — specifically whatever wipes `localStorage`), any
  painting you haven't exported+pasted+saved into the actual files yet is
  gone. The painter will fall back to loading whatever is currently in the
  committed game files — you lose in-progress work, not already-exported
  work.
- **"Reset from files"** does this on purpose, on demand: discards the
  current map's unexported changes and reloads it straight from disk.

**The official way to persist a change, end to end (Chrome/Edge):**
1. Paint on the canvas (autosaves to `localStorage` after every stroke, or
   every marker placement).
2. Click **"Choose Repo Folder"** once per browser session and pick the
   repo's root folder (the one containing `js/`, `tools/`, etc.) — this
   grants the page write access to it via the File System Access API. The
   browser will ask you to confirm.
3. Click **"Export All Changed to Files"**. This writes every wilderness
   screen whose LEGEND/ROWS actually changed straight into
   `js/maps/wilderness/<screenId>.js`, plus the dungeon entrance position
   into `js/state.js` and all three tool dungeon entrance positions into
   `js/data/toolDungeons.js` — whichever of those changed, in one click, no
   copy/paste. It only ever patches the specific LEGEND/ROWS block or
   position fields it's responsible for; it never rewrites a whole file, so
   comments/imports/anything else in that file are untouched. Unchanged
   files are left alone (and reported as "already up to date") rather than
   rewritten with equivalent-but-differently-formatted content.
4. Run `npm test`, commit.

This doesn't cover the currently-selected dungeon/mini-dungeon interior map
(if you're painting one) — those are still single files, one at a time:
pick the screen/map you changed from the "Export screen" dropdown (for
wilderness) or just use the current map, click **"Copy LEGEND/ROWS"**, and
paste it over the existing `const LEGEND = {...}; const ROWS = [...]`
declaration in that map's file under `js/maps/`.

**Firefox/Safari** (no File System Access API support): "Choose Repo
Folder" and "Export All..." are disabled — fall back to the per-screen
"Copy LEGEND/ROWS" + paste workflow above for every map, wilderness
included.

## Features

- **Palette** — buttons show an icon per terrain kind, with a text label on
  hover. The palette swaps automatically depending on which map is
  selected (wilderness vs. dungeon vs. mini-dungeon each have their own set
  of paintable kinds).
- **Brush size** — slider, 1–15 cells.
- **Brush shape** — Square or Circle.
- **Undo** — steps back through your last 30 strokes/marker placements on
  the *current* map (each map you switch to keeps its own undo stack).
- **Reset from files** — discards unexported changes on the current map and
  reloads it from the real file on disk (asks for confirmation first).
- **Map dropdown** — switch between the wilderness (5x5 continuous canvas)
  and any single dungeon/mini-dungeon variant.
- **Place Dungeon Entrance** (wilderness only) — click the button, then
  click a tile to mark the one fixed spot every new save's main dungeon
  entrance sits at. **Copy position** copies the exact value to paste into
  `DEFAULT_DUNGEON_ENTRANCE_POSITION` in `js/state.js`.
- **Place Tool Dungeon Entrance** (wilderness only) — same idea, for
  whichever tool dungeon (axe/pick/canoe) is selected in the dropdown next
  to it. **Copy position** pastes into that tool's entry
  (`screenId`/`x`/`y`) in `js/data/toolDungeons.js`.
- **Check Map** (wilderness only) — flood-fills outward from the town
  entrance and tints the canvas: no tint = freely walkable, yellow = only
  reachable with a tool (axe/pick/boat), red = not reachable even with
  every tool. Also reports plainly whether the main dungeon entrance itself
  is reachable *without* a tool (it has to be — axe/pick/boat only ever
  drop from inside a dungeon, so the entrance can't require one to get to).
  Dungeon-interior maps don't have their own reachability check yet — only
  the wilderness does.
- **Sealed world edge** — the outermost border of the full 5x5 world (any
  screen edge with no neighboring screen) always renders as the permanent
  mountain wall and can't be painted over, matching what the real game
  enforces automatically (`js/screens/mapScreen.js`'s `isSealedWorldEdge`)
  regardless of what's underneath. You never have to hand-maintain a
  border.
- **Choose Repo Folder / Export All Changed to Files** (wilderness only,
  Chrome/Edge) — one-click bulk save straight to disk. See the saving
  workflow above.
- **Export / Copy LEGEND/ROWS** — see the saving workflow above.

## Keyboard shortcuts

- **Ctrl+Z / Cmd+Z** — undo, same as the Undo button.

That's currently the only keyboard shortcut. Arrow keys / WASD do nothing
in the painter (they're the in-game movement keys, not painter controls).

## Known gaps (not built yet)

- **Scroll doesn't lock while painting.** If your click-drag stroke nears
  the edge of the browser window, the page can scroll out from under you
  mid-stroke. Backlogged, not fixed.
- Bulk export covers the wilderness screens + dungeon/tool-dungeon entrance
  positions only — not the currently-open dungeon/mini-dungeon interior map,
  which still needs its own "Copy LEGEND/ROWS" + paste.
- No reachability check for dungeon-interior maps (wilderness only).
- The repo folder permission isn't remembered across page reloads — you
  re-pick it each session.
