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
node tools/terrain-painter/server.js
```
from the repo root, then open http://localhost:8000/ (or
http://localhost:8000/tools/terrain-painter/index.html directly). This is a
small dev-only Node server (built-in `http`/`fs` only, no new dependency)
that serves the painter's static files *and* writes changes straight to
disk when you click "Export All Changed to Files" or "Save New Dungeon to
Server" — no folder-picker permission to grant, works in any browser (not
just Chrome/Edge). It's never deployed — `.github/workflows/deploy.yml`
stages an explicit allowlist of files/dirs into the live build, and
`tools/` isn't on it.

**Fallback**, for a browser you'd rather not run Node servers around, or
if you just want the old flow:
```bash
python3 -m http.server 8000
```
from the repo root, then open http://localhost:8000/tools/terrain-painter/index.html.
The painter feature-detects which server is running (a same-origin
`OPTIONS` probe against `/api/patch-wilderness`) and falls back
automatically to the File System Access API flow described below when the
Node server isn't present — Chrome/Edge only, and "Save New Dungeon to
Server" isn't available at all under this fallback (there's no existing
file for it to patch, only a brand-new one to create).

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

**The official way to persist a change, end to end (with the Node
server):**
1. Paint on the canvas (autosaves to `localStorage` after every stroke, or
   every marker placement).
2. Click **"Export All Changed to Files"**. With `node
   tools/terrain-painter/server.js` running, this writes every wilderness
   screen whose LEGEND/ROWS actually changed straight into
   `js/maps/wilderness/<screenId>.js`, plus every placed superboss marker
   into `js/data/superBosses.js` — whichever of those changed, in one
   click, no copy/paste. It only ever patches the specific LEGEND/ROWS
   block or entry fields it's responsible for; it never rewrites a whole
   file, so comments/imports/anything else in that file are untouched.
   Unchanged files are left alone (and reported as "already up to date")
   rather than rewritten with equivalent-but-differently-formatted
   content. (The dungeon entrance and tool dungeon entrance positions
   aren't wired to the server — those are already placed and stable; use
   the Chrome/Edge fallback below for the rare case either needs to move.)
3. If you're editing a brand-new dungeon (see "New Dungeon" below), click
   **"Save New Dungeon to Server"** instead/as well — this creates the map
   file under `js/maps/superBosses/` and registers its import + `MAPS`
   entry in `js/main.js`, something no amount of LEGEND/ROWS patching can
   do since there's no existing file to patch.
4. Run `npm test`, commit.

This doesn't cover the currently-selected dragon-dungeon/mini-dungeon
interior map (if you're painting one — a brand-new dungeon is covered by
step 3 above) — those are still single files, one at a time: pick the
map, click **"Copy LEGEND/ROWS"**, and paste it over the existing `const
LEGEND = {...}; const ROWS = [...]` declaration in that map's file under
`js/maps/`.

**Fallback flow (Chrome/Edge, no Node server running):** click **"Choose
Repo Folder"** once per browser session and pick the repo's root folder
(the one containing `js/`, `tools/`, etc.) — this grants the page write
access to it via the File System Access API, then "Export All Changed to
Files" writes the same wilderness-screen data plus the dungeon entrance
position (`js/state.js`) and all three tool dungeon entrance positions
(`js/data/toolDungeons.js`). "Save New Dungeon to Server" has no
equivalent in this fallback.

**Firefox/Safari with no Node server running** (no File System Access API
support either): "Choose Repo Folder" and "Export All..." are disabled —
fall back to the per-screen "Copy LEGEND/ROWS" + paste workflow above for
every map, wilderness included.

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
- **Place Super-Boss Marker** (wilderness only) — same idea again, for
  whichever superboss id is selected in the dropdown next to it (populated
  from `SUPER_BOSSES`' keys in `js/data/superBosses.js`). The **Has own
  dungeon** checkbox is saved onto the marker alongside its position —
  check it for a superboss fought behind its own dungeon entrance
  (`hasDungeon: true`), leave it unchecked for one fought on the spot in
  the open wilderness (`hasDungeon: false`). **Copy position** pastes
  `{ screenId, x, y, hasDungeon }` for that superboss id. Markers render as
  a filled circle, colored by `hasDungeon` (red = has its own dungeon,
  yellow = open-wilderness encounter), labeled with the first two letters
  of the superboss id.
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
- **Export All Changed to Files** (wilderness only) — one-click bulk save
  straight to disk, via the Node server if it's running, else "Choose Repo
  Folder" + the File System Access API (Chrome/Edge only). See the saving
  workflow above.
- **New Dungeon** — starts a brand-new, blank dungeon interior from
  scratch (for a superboss's own dungeon) instead of loading an existing
  map file: prompts for a map id and a width/height, then switches into
  the same painting view used for every other dungeon, filled with cave
  floor tiles ready to paint over. Its palette is
  caveFloor/caveWall/exit/guardian — `guardian` (not `boss`, which is
  wired specifically to the one real dragon fight) is the encounter tile
  every real tool-dungeon file already uses. **Save New Dungeon to
  Server** (only shown while a new dungeon is the active map) requires
  exactly one `exit` tile and at least one `guardian` tile, asks for the
  guardian's monster id (a key from `MONSTERS` in `js/data/monsters.js`),
  then writes the map file to `js/maps/superBosses/` and registers its
  import + `MAPS` entry in `js/main.js`. Needs the Node server — there's
  no existing file for a File System Access fallback to patch.
- **Export / Copy LEGEND/ROWS** — see the saving workflow above.

## Keyboard shortcuts

- **Ctrl+Z / Cmd+Z** — undo, same as the Undo button.

That's currently the only keyboard shortcut. Arrow keys / WASD do nothing
in the painter (they're the in-game movement keys, not painter controls).

## Known gaps (not built yet)

- **Scroll doesn't lock while painting.** If your click-drag stroke nears
  the edge of the browser window, the page can scroll out from under you
  mid-stroke. Backlogged, not fixed.
- Bulk export (the Node server path or its Chrome/Edge fallback) still
  doesn't cover the currently-open dragon-dungeon/mini-dungeon interior
  map — that still needs its own "Copy LEGEND/ROWS" + paste. (A brand-new
  dungeon *is* covered, via "Save New Dungeon to Server".)
- No reachability check for dungeon-interior maps (wilderness only).
- The dungeon entrance and tool dungeon entrance positions aren't wired to
  the Node server's endpoints (only wilderness screens and superboss
  markers are) — moving either still needs the Chrome/Edge "Choose Repo
  Folder" fallback. Both are already placed and stable on this branch, so
  this is expected to be rare.
