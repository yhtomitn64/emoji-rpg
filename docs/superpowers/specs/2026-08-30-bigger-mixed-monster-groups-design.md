# Bigger, Mixed Monster Groups — Design

Sub-project 1 of the larger "bigger/mixed monster groups + battle-screen
visual overhaul" backlog item (`docs/superpowers/BACKLOG.md`'s "Combat pass
ideas" section, raised 2026-08-29). This build covers the functional layer
only — group size, composition, and the NG+/zone-1-lingering escalation
tied to it. The "cool" visual overhaul (bigger battle screen,
overlapping/varied-size rendering scaled to monster toughness, background
illustration) and the inter-monster buff/synergy mechanic are each their
own separate, later spec.

## Purpose

Today a monster group is always 2-3 copies of one species
(`js/systems/groupEncounters.js`), gated behind a per-species lifetime kill
threshold. Timothy wants: (1) a higher size ceiling (up to 6), (2) mixed
species within one group instead of always-identical copies, and (3) two
independent escalation pressures pushing group size toward that ceiling -
NG+ cycle, and time spent wandering zone-1 screens this cycle, plus NG+
also raising how *often* a group spawns at all (not just how big).

## Scope

In scope:
- Raising the baseline group-size range from 2-3 to 2-4.
- An `effectiveMax` formula that adds NG+ cycle and a new zone-1-steps
  counter on top of the baseline, capped at 6.
- NG+ cycle also raising `GROUP_SPAWN_CHANCE` (packs appear more often, not
  just bigger).
- Mixed species: every group slot beyond the seed monster independently
  rolled from that screen's own `monsterTable`.
- A new `state.zone1Steps` counter, incremented per tile-move on a zone-1
  wilderness screen, reset on NG+ transition.
- A minimal battle-screen sizing/spacing tweak so up to 6 slots stay
  legible in the existing flex-wrap row - not the real visual overhaul.

Out of scope (deliberately, deferred to later specs):
- Inter-monster buffs/synergies.
- Overlapping/varied-size monster rendering, a bigger battle screen, and a
  background illustration.
- Any change to the existing per-species `GROUP_SPAWN_KILL_THRESHOLD` gate
  itself (10 kills) - untouched.
- Any change to elite or boss encounters - both already bypass
  `rollEncounterGroup` entirely and stay that way.

## Mechanics

### Group size & spawn-chance scaling

`js/systems/groupEncounters.js` today:

```js
export const GROUP_SPAWN_KILL_THRESHOLD = 10;
export const GROUP_SPAWN_CHANCE = 0.3;
export const GROUP_SIZE_MIN = 2;
export const GROUP_SIZE_MAX = 3;

export function rollEncounterGroup(monsterId, killCounts, rng = Math.random) {
  const kills = killCounts[monsterId] || 0;
  if (kills < GROUP_SPAWN_KILL_THRESHOLD || rng() >= GROUP_SPAWN_CHANCE) {
    return [monsterId];
  }
  const size = GROUP_SIZE_MIN + Math.floor(rng() * (GROUP_SIZE_MAX - GROUP_SIZE_MIN + 1));
  return Array(size).fill(monsterId);
}
```

Becomes:

```js
export const GROUP_SPAWN_KILL_THRESHOLD = 10;
export const GROUP_SPAWN_CHANCE_BASE = 0.3;
export const GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE = 0.1;
export const GROUP_SIZE_MIN = 2;
export const GROUP_SIZE_MAX_BASE = 4;
export const GROUP_SIZE_MAX_CAP = 6;
export const ZONE1_STEPS_PER_SIZE_ESCALATION = 300;

export function groupSpawnChance(ngPlusCycle) {
  return GROUP_SPAWN_CHANCE_BASE + ngPlusCycle * GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE;
}

export function effectiveGroupSizeMax(ngPlusCycle, zone1Steps) {
  const escalation = ngPlusCycle + Math.floor(zone1Steps / ZONE1_STEPS_PER_SIZE_ESCALATION);
  return Math.min(GROUP_SIZE_MAX_CAP, GROUP_SIZE_MAX_BASE + escalation);
}

export function rollEncounterGroup(monsterId, killCounts, monsterTable, ngPlusCycle, zone1Steps, rng = Math.random) {
  const kills = killCounts[monsterId] || 0;
  if (kills < GROUP_SPAWN_KILL_THRESHOLD || rng() >= groupSpawnChance(ngPlusCycle)) {
    return [monsterId];
  }
  const max = effectiveGroupSizeMax(ngPlusCycle, zone1Steps);
  const size = GROUP_SIZE_MIN + Math.floor(rng() * (max - GROUP_SIZE_MIN + 1));
  return [monsterId, ...Array.from({ length: size - 1 }, () => monsterTable[Math.floor(rng() * monsterTable.length)])];
}
```

`GROUP_SIZE_MAX` is removed (replaced by the base/cap pair above) - grep the
codebase for it before implementing to catch any other reference (today
only `groupEncounters.js` itself and its own test use it).

### Wiring: mapScreen.js's call site

`js/screens/mapScreen.js`'s `tryMove` (around line 698) currently calls:

```js
const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts);
```

Becomes:

```js
const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts, mapConfig.monsterTable, state.ngPlusCycle, state.zone1Steps);
```

`mapConfig.monsterTable` is already in scope at this call site (used two
lines above to pick `monsterId` itself), so no new data threading is
needed beyond the two new state reads.

### Zone-1 steps tracking

No "zone" concept exists in the map registry today - `js/main.js`'s `MAPS`
object just lists every screen id flatly. Add an explicit id list (new
export, `js/systems/groupEncounters.js` or a new tiny module - implementer's
call) enumerating the wilderness screens, deliberately excluding `center`
(the town screen, `monsterTable: []`, no encounters ever roll there) and
every dungeon/mini-dungeon:

```js
export const ZONE1_WILDERNESS_MAP_IDS = new Set([
  'north', 'south', 'east', 'west',
  'northeast', 'northwest', 'southeast', 'southwest',
  'farNorthwest', 'northNorthwest', 'farNorth', 'northNortheast', 'farNortheast',
  'westNorthwest', 'farWest', 'westSouthwest',
  'eastNortheast', 'farEast', 'eastSoutheast',
  'southSouthwest', 'farSouth', 'southSoutheast',
  'farSouthwest', 'farSoutheast',
]);
```

`js/screens/mapScreen.js`'s `tryMove` (where the player's position actually
advances a tile, upstream of the encounter roll) increments
`state.zone1Steps` by 1 whenever `state.map` is in that set, right
alongside the existing position update - no new call site, no new event.

### State

`js/state.js`'s `createNewGame()`: add `zone1Steps: 0`.

`js/main.js`'s `startGame()` migration block (alongside the existing
`monsterKillCounts`/`questLevel` backfills): add
`if (!state.zone1Steps) state.zone1Steps = 0;` for saves from before this
field existed.

`js/systems/ngPlus.js`'s `resetWorldForNgPlus()`: add `zone1Steps: 0` to the
returned object, alongside the other per-cycle resets (`lossStreak: 0`,
etc.) - resets on NG+ transition, not on death, matching "time spent this
cycle."

### Battle-screen sizing

`css/styles.css`'s `.battle-monster-row` already uses `flex-wrap: wrap`
with an 18px `gap`, and nothing in `js/screens/battleScreen.js` hardcodes a
3-slot assumption (`monsterZones`/`monsterCombatants` are built from
`monsterIds.length` throughout). At 6 slots the row will wrap onto two
lines inside the panel's `max-width: min(92vw, 860px)`, which should
already look reasonable - a live check once this is wired up decides
whether the gap/HP-bar width need a small reduction past a slot-count
threshold. No structural change anticipated; call this a checkpoint to
verify, not a guaranteed code change.

## Testing

- `groupEncounters.test.js`: `effectiveGroupSizeMax`/`groupSpawnChance` pure
  function tests across the ngPlusCycle x zone1Steps matrix (0/1/2 cycles x
  a few step buckets, confirming the cap at 6 holds). `rollEncounterGroup`
  updated for the new signature - existing tests already exercise the
  kill-threshold gate and min/max size range; extend for mixed-species
  output (assert a rolled group of size > 1 isn't always uniform once a
  multi-species `monsterTable` is passed, using a seeded/mock rng the way
  the existing suite already does).
- `js/state.js`/`ngPlus.test.js`: `createNewGame()` includes `zone1Steps: 0`;
  `resetWorldForNgPlus()` resets it.
- `mapScreenDom.test.js` (or a new lightweight test): a tile-move on a
  zone-1 screen increments `state.zone1Steps`; a tile-move on `center`/town
  does not.
