# Circle of Ultimate Portaling — design

**Status:** approved for planning
**Session:** 2026-09-01 brainstorming, continuing from
`2026-09-01-portal-scroll-brainstorm-handoff.md` (prior session's
decisions + research, reproduced/finalized below)

## Problem

The player has no way to leave a deep dungeon run to sell loot, restock
potions, or bank gold without walking all the way back out through
whatever they just fought through — and no way back in except walking
it again. A fourth tool, matching the existing axe/pick/boat pattern
exactly, fixes this: fight a guardian once, then have a reusable
"go to town and back" tool forever after.

## Item

**Name:** Circle of Ultimate Portaling — matches this game's established
joke-naming tone (`Snorty McPigface`, `Spooky Pancake`, `Mean Meatball`,
etc. in `js/data/monsters.js`) and sidesteps the "scroll" naming's
consumable connotation entirely.

`js/data/items.js`, new entry alongside `axe`/`miningPick`/`boat`:

```js
portalCircle: {
  id: 'portalCircle', name: 'Circle of Ultimate Portaling', emoji: '🌌',
  type: 'tool', price: 0,
  description: 'Drops a portal to town at your feet',
},
```

`type: 'tool'`, `price: 0` — matches the other three exactly (found, not
bought or sold).

## Acquisition

Exact axe/pick/boat template, one new instance of each:

- **Guardian monster**, `js/data/monsters.js`, alongside
  `axeGuardian`/`pickGuardian`/`boatGuardian`:

  ```js
  // Sits behind a gate meant to require axe + pick + boat already
  // (Timothy's map design, not enforced in code) - a step tougher than
  // boatGuardian, since "free repeatable trip to/from town from
  // anywhere" is the strongest of the four tools.
  portalGuardian: {
    id: 'portalGuardian', name: 'Portal Guardian', emoji: '🌌',
    hp: 210, attack: 28, defense: 9, speed: 9,
    xp: 65, goldRange: [22, 32],
    dropTable: [{ itemId: 'portalCircle', chance: 1 }],
    forceFullBattle: true,
    attackStyle: 'melee',
  },
  ```

  Stats continue the axe(140/18/5/7) → pick(140/18/5/7) → boat(175/24/7/8)
  progression one step further, landing just under dungeon-tier
  (orc/wraith/skeleton sit at hp 170-180, attack 30-34). `forceFullBattle:
  true`, deliberately not `isBoss`, for the same reasons documented above
  the existing three guardians.

- **Dungeon interior map**, `js/maps/toolDungeons/portalDungeon.js`,
  same template as `axeDungeon.js`:

  ```js
  const LEGEND = {
    '.': 'grass',
    '#': 'tree',
    E: 'exit',
    G: 'guardian',
  };

  const ROWS = [
    '##############',
    '#E...........#',
    '#............#',
    '#....##......#',
    '#.......#....#',
    '#............#',
    '#...........G#',
    '##############',
  ];

  export const portalDungeonMap = {
    id: 'portalDungeon',
    legend: LEGEND,
    rows: ROWS,
    startPosition: { x: 1, y: 1 },
    encounterChance: 0,
    cacheChance: 0,
    monsterTable: [],
    guardianMonsterId: 'portalGuardian',
  };
  ```

- **Entrance registration**, `js/data/toolDungeons.js`:

  ```js
  portal: {
    screenId: null, x: null, y: null, mapId: 'portalDungeon', tileKind: 'portalDungeonEntrance',
  },
  ```

  `screenId`/`x`/`y` are placeholders — Timothy hand-places the real
  entrance via the terrain painter's "Place Tool Dungeon Entrance" mode
  afterward, same as the other three. (`null` values need the same
  guard the other three don't currently need, since `axe`/`pick`/`canoe`
  are always pre-filled — see Testing below.)

- **Entrance tile**, `js/tiles.js`:

  ```js
  portalDungeonEntrance: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalDungeon', description: 'A guarded passage — a portal lies beyond' },
  ```

- **`js/main.js` wiring**: import + register `portalDungeonMap` in
  `MAPS` (matching the three existing imports/registrations at lines
  17-19 / 112-114), and add
  `if (action === 'enterPortalDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.portal.mapId);`
  next to the other three `enterXDungeon` cases (~line 447). The generic
  `exitMap` handler already walks `Object.values(TOOL_DUNGEON_ENTRANCES)`
  to find the return spot, so it needs no changes.

- **Terrain painter** (`tools/terrain-painter/painter.js`) — real code
  changes, not just data, per the handoff's flagged research:
  - `SINGLE_MAPS`: new `portal: { label: 'Portal Dungeon', modulePath: '../../js/maps/toolDungeons/portalDungeon.js', exportName: 'portalDungeonMap', palette: DUNGEON_PALETTE, defaultKind: 'grass' }` entry (~line 104-114 pattern).
  - `TOOL_DUNGEON_IDS` (~line 143): `['axe', 'pick', 'canoe', 'portal']`.
  - `TOOL_DUNGEON_MARKER_COLORS` (~line 144): add a `portal` color distinct
    from the other three's green/blue/orange (e.g. `'#b06fd6'`, purple).
  - Progression-reachability checker (~line 654-656): extend to include
    `portal` alongside the other three tool IDs.

## Activation

**Hotkey:** `P`, added to `mapScreen.js`'s `handleKeydown` (~line 726),
alongside the existing `KEY_TO_DELTA` movement check — not itself part
of `KEY_TO_DELTA` since it's an action, not a move:

```js
function handleKeydown(event) {
  const delta = KEY_TO_DELTA[event.key];
  if (delta) {
    tryMove(delta[0], delta[1]);
    return;
  }
  if (event.key === 'p' || event.key === 'P') {
    callbacks.onUsePortalTool();
  }
}
```

Confirmed non-colliding: `mapScreen.js` itself only binds
`w/a/s/d`/arrows. `battleScreen.js` binds `p`/`P` to pause, but that
screen's keydown listener is detached while the map screen underneath
is active (`screenManager.js`'s `pause()`/`resume()`, same reasoning
already documented for the `s`/parry collision at `battleScreen.js`
~line 1320) — no functional collision, just two unrelated meanings on
two mutually-exclusive screens.

**Where it works:** anywhere the player can stand — wilderness, the
main dungeon, mini-dungeons, tool-dungeon interiors, and town itself
(dropping it in town works, it's just pointless: both ends land a few
tiles apart inside the same town map). No location gating in code.
Requires owning the tool
(`state.inventory.some(e => e.itemId === 'portalCircle' && e.quantity > 0)`,
same check shape `hasRequiredTool` uses in `js/systems/toolGates.js`) —
pressing `P` without it is a no-op.

## State shape and lifecycle

New top-level field, `state.portal`, default `null` in
`createNewGame()` (`js/state.js`). No migration function needed: an
existing save simply lacks the key, and `undefined` reads exactly like
`null` everywhere this feature checks it — unlike `migrateRingSlots`/
`migratePowerRingSlot`/etc., there's no old shape to transform.

```js
state.portal = {
  originScreenId, originX, originY, // where it was dropped
  returnPending, // false until the origin end has been used once
};
```

**Lifecycle:**

1. **Drop** (`P`, tool owned): `state.portal = { originScreenId: state.map, originX: state.position.x, originY: state.position.y, returnPending: false }` — unconditionally overwrites whatever was there before. This is the "only one portal pair ever" rule from the prior session: no explicit check-and-block, just silent replacement, matching the decision's own wording.
2. **Walk into the origin tile** (`tileAt()` returns the portal-origin tile there, action `enterPortalToTown`): `enterMap('town', { x: TOWN_PORTAL_X, y: TOWN_PORTAL_Y })`, then `state.portal.returnPending = true`. The origin tile keeps behaving the same on any later visit (idempotent — just re-sends to the same town spot), so no extra state is needed to hide it afterward.
3. **Town-side tile appears** once `returnPending` is true, at a fixed spot near the shop/smith cluster: `TOWN_PORTAL_X = 7, TOWN_PORTAL_Y = 4` in `js/maps/townMap.js`'s grid (row 4 is `#..S.......M...#` — shop at x=3, smith at x=11, so x=7 sits centered between them, clear of the well at (11,8) and the exit at (7,10)).
4. **Walk into the town tile** (action `enterPortalToOrigin`): `enterMap(state.portal.originScreenId, { x: state.portal.originX, y: state.portal.originY })`, then `state.portal = null` — round trip complete, pair gone for good, matching "vanishes for good once you've used it to go to town and back."

`enterMap(mapId, position)` (`js/main.js` ~line 456) already does exactly
the `state.position = ...; state.map = ...; persist(); goToMap(...)` work
both transitions need — no new map-swap primitive required, just two new
`handleTileAction` cases calling it with the right target.

## Rendering — `tileAt()` override

Matches the exact pattern `dungeonEntrance`/`TOOL_DUNGEON_ENTRANCES`
already use in `tileAt()` (`js/screens/mapScreen.js:227`), not the
cache-overlay pattern (caches are incidental %-chance finds on ordinary
grass, checked separately from `tileAt`; a portal is a deliberate,
singular, prominent walk-into object — the entrance pattern is the
right shape, caches would need new interaction-triggering logic they
don't otherwise need):

```js
function tileAt(screenConfig, x, y) {
  const entrance = state.dungeonEntrancePosition;
  if (entrance && screenConfig.id === entrance.screenId && x === entrance.x && y === entrance.y) {
    return TILES.dungeonEntrance;
  }
  if (state.portal && screenConfig.id === state.portal.originScreenId && x === state.portal.originX && y === state.portal.originY) {
    return TILES.portalOrigin;
  }
  if (state.portal && state.portal.returnPending && screenConfig.id === 'town' && x === TOWN_PORTAL_X && y === TOWN_PORTAL_Y) {
    return TILES.portalReturn;
  }
  // ... existing TOOL_DUNGEON_ENTRANCES loop, sealed-edge check, etc.
}
```

Two new `js/tiles.js` entries:

```js
portalOrigin: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalToTown', description: 'A swirling portal — steps through to town' },
portalReturn: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalToOrigin', description: 'A swirling portal — steps through back where you left it' },
```

Once `state.portal` is cleared, both checks stop matching and `tileAt()`
falls through to whatever static terrain the map row actually has —
nothing to restore, same as how a used tool-dungeon entrance never needs
cleanup.

**Edge case, deliberately unhandled:** if the player drops the portal
while standing exactly on `(town, TOWN_PORTAL_X, TOWN_PORTAL_Y)`, the
origin check matches first in the `if`-chain and permanently masks the
return tile at that same coordinate — walking onto it just keeps
re-sending them to the same spot, and `returnPending` can never flip
back to `false` normally. This is harmless: it only happens in the
already-"silly but works" in-town case, and the existing
replace-to-reset escape valve (see below) clears it at zero cost, since
there's no return route to lose when the origin was town to begin with.
Not worth branching the `tileAt()` logic to special-case one
coincidental tile.

## The well-cheese problem and its fix

**The problem:** the town well (`js/main.js:484` `handleUseWell`,
`js/tiles.js` `well` tile) gives free, unlimited healing outside combat
— already shipped, unrelated to this feature. Without a guard, the
portal turns that into free healing reachable from *anywhere*,
*repeatedly*, with zero risk — removing the actual cost (the walk back
through danger) that currently makes retreating to heal a real
decision. Flagged by Timothy directly during this session as trivializing
difficulty.

**The fix:** block the well specifically while `state.portal.returnPending`
is `true` — the portal's outbound leg has been used but the return leg
hasn't. `handleUseWell()` gets one new early check:

```js
function handleUseWell() {
  if (state.portal && state.portal.returnPending) {
    showFlavorBanner("The well's waters seem out of reach — you're not fully returned to this world.");
    return;
  }
  // ... existing full-heal logic unchanged
}
```

This needs no changes to movement or town-exit code at all — an
earlier, more invasive version of this fix considered blocking normal
town exits while a portal round-trip is pending (town-to-wilderness
transitions here are free-form edge-crossings anywhere along the screen
boundary, not discrete doors, so that would've meant new
movement-blocking logic at every edge of town). The well-only check
achieves the same goal because it isn't tied to how the player moves
around town — it stays blocked whether they linger at the well, wander
out to a neighboring wilderness screen and back, or do anything else,
for as long as `returnPending` is `true`.

**Abandoned portals:** if the player never uses the return leg, the
well stays blocked and the single-portal slot stays occupied
indefinitely — deliberately, with one always-available way out:
pressing `P` again (from anywhere, including at the well) drops a fresh
portal, silently replacing the stale one per the "only one ever" rule.
That fresh portal's `returnPending` starts `false`, so the well
unblocks immediately — but the player loses their route back to wherever
the old portal was and has to walk it manually. Considered and rejected
a time/step-based auto-dissolve for the abandoned case: it would grant
the same reset for free, undercutting the fix's whole point. The
existing replace-to-reset behavior is the only reset, and it's never
free.

## Testing

- **Unit-level** (state/system logic, no DOM): portal lifecycle
  (drop → overwrite → origin walk-in sets `returnPending` → town
  walk-in clears `state.portal`), well-block gated correctly on
  `returnPending`, `tileAt()` override priority/fallthrough once
  `state.portal` is `null`.
- **`TOOL_DUNGEON_ENTRANCES.portal`'s placeholder `null` fields**: unlike
  the other three tools' entries, this one ships with `screenId: null,
  x: null, y: null` until Timothy hand-places it. Anything that iterates
  `Object.values(TOOL_DUNGEON_ENTRANCES)` and compares `screenConfig.id
  === toolEntrance.screenId` (the `tileAt()` loop, the `exitMap` handler)
  needs to keep working harmlessly with a `null` `screenId` in the list
  (comparing a real screen id against `null` is already always `false`,
  so no crash — worth an explicit test asserting that, since it's the
  one behavioral difference from the other three tools' entries).
- Existing `tests/versionSync.test.js` unaffected; this feature follows
  the repo's normal versioning checklist (`CHANGELOG.md` +
  `js/data/playerChangelog.js`) like any other shipped change.

## Out of scope

- Where the dungeon entrance actually sits in the wilderness — Timothy
  places it via the terrain painter after this ships, per the prior
  session's decision.
- Exact guardian stat tuning beyond the progression estimate above —
  reasonable starting numbers, adjustable after a real fight.
