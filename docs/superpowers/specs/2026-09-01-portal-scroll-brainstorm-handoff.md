# Portal scroll — brainstorm handoff

**Status:** brainstorm in progress, not yet a design doc. This is a
session-handoff prompt (written to be pasted as the opening message of a
new session), not an approved spec — don't confuse it with the
`*-design.md` files in this same folder. Once the brainstorm below
reaches an approved design, it should get written up as its own proper
`YYYY-MM-DD-portal-scroll-design.md` and this file can be left as
historical context or removed.

---

Continue the "portal scroll" feature brainstorm for the emoji-rpg game at
~/funstuff/rpg. This is picking up mid-brainstorm from a prior session —
invoke superpowers:brainstorming, classify it as **architectural** (already
decided last session), and treat everything below as already-answered
context, not open questions to re-ask. Pick up at "Open questions" and move
toward presenting the design.

## The idea

A reusable "portal scroll" tool item. Using it drops a portal on the ground
at the player's exact current position; walking into it warps you to town,
where a paired portal appears; walking into *that* one returns you to
exactly where you dropped the first one. After that round trip, both
portals disappear.

## Decisions already made (do not re-ask)

- **One-way visually, round-trip-then-gone in practice**: same portal
  pair, both directions, but the pair vanishes for good once you've used
  it to go to town and back.
- **Only one portal (pair) can ever exist at a time.** If the player could
  somehow drop another, it would silently replace the old one first —
  this was explicitly to avoid "littering the land" with abandoned
  portals.
- **It's a reusable TOOL, not a consumable scroll** — found once, kept
  forever, usable anytime after that. Matches the existing `axe` /
  `miningPick` / `boat` tools exactly (`js/data/items.js`, `type: 'tool'`).
  Timothy's own words: "I like #1 and you should have to fight it!"
- **Acquired via a guardian-monster fight**, matching the *exact* existing
  pattern for axe/pick/boat: a dedicated "Guardian" monster with
  `forceFullBattle: true` and a guaranteed (`chance: 1`) drop of the tool,
  placed inside its own small tool-dungeon. Timothy will hand-place the
  dungeon entrance himself via the terrain painter tool afterward ("I can
  place in a fun place using the map editor after") — that part is not
  ours to decide, just to build the mechanism for.
- **Activation**: a map-screen hotkey/button while exploring (not a
  battle action, not an Inventory-screen "Use" button) — press it while
  standing anywhere walkable to drop the portal at your exact current
  tile. Recommended over an Inventory Tools-tab button because it's more
  immediate.
- **Return portal placement**: always the same one fixed spot in town
  (near the shop/smith cluster), not wherever the player happens to be
  standing in town.

## Research already done — reuse these exact patterns, don't re-discover

- **Tool-dungeon entrance data**: `js/data/toolDungeons.js` —
  `TOOL_DUNGEON_ENTRANCES` is a plain object keyed by tool name
  (`axe`/`pick`/`canoe` today), each entry `{ screenId, x, y, mapId,
  tileKind }`. Adding a 4th key here is how Timothy will place the new
  guardian's dungeon entrance once the mechanism exists.
- **Tool-dungeon interior maps**: `js/maps/toolDungeons/{axe,pick,canoe}Dungeon.js`
  — each is a small map file with a `guardianMonsterId` field. A new
  `portalDungeon.js` (or similar) needs to follow this template, plus
  registration in the `MAPS` registry in `js/main.js` (see how
  `axeDungeonMap`/`pickDungeonMap`/`canoeDungeonMap` are imported and
  registered there today).
- **Guardian monsters**: `js/data/monsters.js` (~line 71-98) —
  `axeGuardian`/`pickGuardian`/`boatGuardian`. Read the comment block right
  above them (~line 61-70) explaining *why* `forceFullBattle: true` and
  deliberately NOT `isBoss` (isBoss sets `state.flags.dungeonBossDefeated`,
  which would falsely unlock NG+, and blocks fleeing — neither should apply
  to a portal guardian either). Model the new guardian's stats on
  axe/pick/boat's tier, or decide it should sit tougher (open question
  below).
- **Terrain painter tool is NOT generic for tools — real code changes
  needed**: `tools/terrain-painter/painter.js` hardcodes
  `TOOL_DUNGEON_IDS = ['axe', 'pick', 'canoe']` (~line 143),
  `TOOL_DUNGEON_MARKER_COLORS` per-tool (~line 144), a `dungeonModules`-style
  config with modulePath/exportName per tool (~lines 104-114), and the
  progression-reachability checker also hardcodes the three tools
  (~lines 654-656). A 4th tool needs all of these extended, not just data
  added elsewhere. This is real scope, not automatic.
- **Per-tile persistent world state pattern**: `js/systems/toolGates.js` +
  `state.clearedGates[screenId]["x,y"] = true` — this is the established
  shape for "something persistent exists/happened at this specific tile of
  this specific screen." The dropped-portal's own state
  (`state.portal` or similar — singular, since only one can ever exist)
  should probably follow a similar `{ screenId, x, y }` shape rather than
  literally reusing the gates dictionary (a portal isn't per-tile boolean
  state, it also needs the *origin* to return to).
- **Origin-capture/restore pattern**: `js/systems/miniDungeons.js` +
  `js/main.js`'s `handleEnterMiniDungeon`/`handleExitMiniDungeon`
  (~line 536-554) — `state.activeMiniDungeon = { screenId, x, y }` is
  captured before swapping into a mini-dungeon variant, then read back out
  and cleared on exit to restore the exact origin. This is the closest
  existing "remember where you came from, then return exactly there" model
  — directly relevant to how the portal should remember its drop point,
  though a portal is a persistent walkable *object* on the existing map,
  not an instant map-swap like a mini-dungeon entrance, so it needs
  adaptation, not a literal reuse.
- **Existing warp-to-town precedent (probably NOT reused, but worth
  knowing about)**: `js/systems/comeback.js` +
  `js/screens/postDeathTravelScreen.js` — death-only, menu-driven
  (button-click teleport, not a walk-into-object), and costs gold
  (`postDeathWarpCost(level) = 10 * level`). The portal is a walk-into
  mechanic and, since it's a found/fought-for tool rather than a
  gold-sink, probably shouldn't cost gold to use — but confirm this
  assumption with Timothy rather than just asserting it.

## Open questions — ask these before presenting a design

One at a time, per the brainstorming skill's own rule:

1. **Item name/flavor**: "Portal Scroll" implies a consumable (scrolls are
   usually single-use in this kind of game). Now that it's a permanent
   reusable tool, does Timothy want to keep calling it a "scroll," or
   rename it (Portal Stone? Portal Charm? Warp Tome?) to avoid the
   consumable connotation? Low-stakes, but worth asking rather than
   assuming.
2. **The hotkey itself**: needs an actual key that doesn't collide with
   `mapScreen.js`'s existing bindings (WASD movement, plus whatever else
   is already bound there — read `js/screens/mapScreen.js`'s keydown
   handler first to see what's free).
3. **Where can it be used?** Confirm: blocked in town (using it from town
   is a no-op / pointless since you're already there — or should it still
   "work" and just feel silly?), and confirm whether it's allowed inside
   the main dungeon, mini-dungeons, and other tool-dungeon interiors (the
   value case for "go to town mid-dungeon-run to sell/restock, then come
   right back" seems strong — but confirm rather than assume).
4. **Guardian difficulty/tier**: axe/pick/boat guardians gate early-to-mid
   progression. Should the portal guardian sit at a similar tier, or
   given how powerful "free repeatable trip to town from anywhere" is,
   should it require the other three tools first (a step tougher, matching
   how `boatGuardian`'s own comment says it "sits behind a gate meant to
   require axe + pick already")?
5. **Visual representation**: how does a dropped portal actually render on
   the map screen? It's dynamic per-save state on an otherwise-static map
   grid (`js/maps/wilderness/*.js` are static ASCII terrain) — investigate
   how `mapScreen.js` currently renders other dynamic per-tile things
   (mini-dungeon entrances, caches, cleared-gate tiles) before proposing an
   approach here, then present 1-2 options rather than just picking one.

## After the open questions

Follow the brainstorming skill's architectural path from there: propose
2-3 approaches for the trickiest piece (almost certainly the dynamic
portal-rendering + walk-into-it interaction), present the design in
sections, write it to
`docs/superpowers/specs/YYYY-MM-DD-portal-scroll-design.md`, self-review,
get Timothy's explicit approval on the written spec, then invoke
superpowers:writing-plans — do not invoke any other implementation skill.

**Two recent specs/plans in this same repo are good calibration for depth
and format**: `docs/superpowers/specs/2026-08-31-buff-potions-design.md`
and `docs/superpowers/plans/2026-08-31-buff-potions.md` (an ~1900-line,
8-task TDD plan that was fully executed and shipped this session — real
code, real tests, real commits, all passing). Match that level of concrete
detail (exact file paths, exact function signatures, real code in the
plan) rather than a vaguer sketch.

## Housekeeping context (not directly relevant to the portal work, just orientation)

- Repo: `~/funstuff/rpg`, a solo personal project. A push to `master`
  deploys immediately to rpg.burghertime.com — never push without
  Timothy's explicit go-ahead.
- Working tree was clean and fully pushed as of the end of the prior
  session (buff potions feature, a Power Ring equip-slot bug fix, an
  item-menu UX change, and a new Settings screen all shipped and live).
  `git log`/`git status` to reorient before starting new work.
- This repo's own `CLAUDE.md` has a versioning checklist (CHANGELOG.md +
  `js/data/playerChangelog.js` entries, `## [Unreleased]` → dated version
  bump before pushing) — follow it for whatever this session ships.
- `docs/superpowers/BACKLOG.md` has the fuller "excess gold sink" history
  this idea grew out of, plus unrelated adjacent entries (NG+ gear ideas,
  a materials-usefulness idea, a performance-pass watch item) raised in
  passing during the same session — not in scope for the portal work,
  just don't be surprised they're there.
