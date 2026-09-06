# Super-Boss Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable "super-boss" content type (data model, tile
kinds, combat/loot plumbing, a new parry-tied boss special-attack system)
and the map-editor tooling to author it, validated by one fully worked
example superboss.

**Architecture:** Reuses the existing tool-dungeon-guardian pattern almost
entirely (`forceFullBattle`, `guardianMonsterId`, the `MAPS` registry) for
a superboss's own dungeon; adds a new position-keyed registry
(`SUPER_BOSSES`, parallel to `TOOL_DUNGEON_ENTRANCES`) for open-wilderness
placement and for pointing at a dungeon when one exists. A new boss
special-attack system hooks into the existing parry wind-up so a
successful parry negates it, exactly like it negates damage today.

**Tech Stack:** Vanilla JS (ES modules, no framework, no bundler), `node
--test` for the test suite, Node's built-in `http`/`fs` for the new
map-editor authoring server (no new dependency).

**Spec:** `docs/superpowers/specs/2026-09-05-superboss-pass-design.md`

## Global Constraints

- No new npm dependencies anywhere in this plan (repo has only `jsdom` as
  a devDependency) — the authoring server uses Node's built-in `http`/`fs`.
- Every task that touches `js/`, `tests/`, or `scripts/` must leave `npm
  run test` fully green before its commit — never `npm test` (per this
  project's own `CLAUDE.md`).
- Every commit that touches non-doc files needs a `CHANGELOG.md` entry
  under `## [Unreleased]` (CI enforces this). Land entries as each task
  commits; Task 14 bumps `Unreleased` into a real dated version and adds
  the matching `js/data/playerChangelog.js` entry, per this repo's own
  versioning checklist.
- Superboss monsters are **never** `isBoss: true` (that flag is reserved
  for the one real dragon and its `dungeonBossDefeated`/NG+-unlock side
  effect) — they use `forceFullBattle: true` instead, exactly like the
  four existing tool guardians.
- New unique-effect items are guaranteed drops referenced directly by a
  superboss's own `dropTable` — never added to `loot.js`'s
  `UNIQUE_EFFECT_ITEM_IDS` (that pool feeds the regular random per-kill
  roll; these items must stay exclusive to superboss guaranteed drops).
- `tools/` has no automated test coverage (dev-only, never deployed,
  matches the existing terrain-painter's own pattern) — Phase 5 tasks are
  manual-verification only, explicitly noted per task.

---

## Phase 1: Data model, tile kinds, monster/combat plumbing

### Task 1: `SUPER_BOSSES` registry

**Files:**
- Create: `js/data/superBosses.js`
- Test: `tests/superBosses.test.js`

**Interfaces:**
- Produces: `export const SUPER_BOSSES` — object keyed by superboss id,
  each entry `{ id, monsterId, screenId, x, y, hasDungeon, dungeonMapId }`.
  Later tasks (2, 3, 14) read this directly.

- [ ] **Step 1: Write the failing test**

```js
// tests/superBosses.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPER_BOSSES } from '../js/data/superBosses.js';

test('every SUPER_BOSSES entry has the required shape', () => {
  for (const [id, entry] of Object.entries(SUPER_BOSSES)) {
    assert.equal(entry.id, id, `${id}'s own id field must match its registry key`);
    assert.equal(typeof entry.monsterId, 'string');
    assert.equal(typeof entry.hasDungeon, 'boolean');
    if (entry.hasDungeon) {
      assert.equal(typeof entry.dungeonMapId, 'string', `${id} has hasDungeon: true but no dungeonMapId`);
    } else {
      assert.equal(entry.dungeonMapId, null, `${id} has hasDungeon: false but a non-null dungeonMapId`);
    }
  }
});

// Mirrors tests/toolDungeonMaps.test.js's "a not-yet-placed entry is inert
// everywhere that matches on screenId" test - a fresh SUPER_BOSSES entry
// starts with screenId: null so it never matches a real wilderness screen
// until Timothy places it with the terrain painter.
test('a not-yet-placed SUPER_BOSSES entry (null screenId) is inert everywhere that matches on screenId', () => {
  const placeholder = { id: 'someSuperBoss', monsterId: 'someMonster', screenId: null, x: null, y: null, hasDungeon: false, dungeonMapId: null };
  assert.equal(placeholder.screenId, null);
  assert.notEqual(typeof 'anyRealScreenId', typeof placeholder.screenId);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/superBosses.test.js`
Expected: FAIL — `Cannot find module '../js/data/superBosses.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// js/data/superBosses.js
// Position-keyed registry for hand-placed super-bosses, parallel to
// js/data/toolDungeons.js's TOOL_DUNGEON_ENTRANCES - but a superboss can
// either sit directly in the open wilderness (hasDungeon: false, fought
// on the spot via the superBossMarker tile) or behind its own dungeon
// entrance (hasDungeon: true, dungeonMapId points at a MAPS registry key
// under js/maps/superBosses/). See
// docs/superpowers/specs/2026-09-05-superboss-pass-design.md.
//
// A fresh entry starts with screenId: null, x: null, y: null - inert
// (never matches a real screen) until placed via the terrain painter's
// "Place Super-Boss Marker" mode (js/screens/mapScreen.js's tileAt()
// compares screenId against this null, which is always false - same
// invariant TOOL_DUNGEON_ENTRANCES.portal relied on before it was placed).
export const SUPER_BOSSES = {};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/superBosses.test.js`
Expected: PASS (both tests trivially pass against an empty registry — the
first iterates zero entries, the second is a synthetic self-check)

- [ ] **Step 5: Commit**

```bash
git add js/data/superBosses.js tests/superBosses.test.js
```

Add to `CHANGELOG.md` under `## [Unreleased]`:
```markdown
### Added
- New empty `SUPER_BOSSES` registry (`js/data/superBosses.js`) - the
  data model super-bosses will be placed into. Part of the super-boss
  pass, see `docs/superpowers/specs/2026-09-05-superboss-pass-design.md`.
```

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add empty SUPER_BOSSES registry

First piece of the super-boss pass - a position-keyed data model,
parallel to TOOL_DUNGEON_ENTRANCES, for hand-placing superbosses either
directly in the wilderness or behind their own dungeon entrance.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 2: New tile kinds + `mapScreen.js` marker resolution

**Files:**
- Modify: `js/tiles.js:60-61` (append two new tile entries before the closing `};`)
- Modify: `js/screens/mapScreen.js:13` (import), `:92-108` (`FULL_SQUARE_MARKERS`), `:122-136` (`GRASS_CONTEXT_MARKERS`), `:248-275` (`tileAt`)
- Test: `tests/superBosses.test.js` (extend)

**Interfaces:**
- Consumes: `SUPER_BOSSES` from Task 1 (`js/data/superBosses.js`).
- Produces: `TILES.superBossMarker`, `TILES.superBossEntrance` — Task 3
  reads these tile kinds' `.action` fields.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/superBosses.test.js
import { TILES } from '../js/tiles.js';

test('superBossMarker and superBossEntrance tile kinds exist and are walkable', () => {
  assert.ok(TILES.superBossMarker, 'TILES.superBossMarker must exist');
  assert.equal(TILES.superBossMarker.walkable, true);
  assert.equal(TILES.superBossMarker.action, 'superBossBattle');

  assert.ok(TILES.superBossEntrance, 'TILES.superBossEntrance must exist');
  assert.equal(TILES.superBossEntrance.walkable, true);
  assert.equal(TILES.superBossEntrance.action, 'enterSuperBossDungeon');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/superBosses.test.js`
Expected: FAIL — `TILES.superBossMarker must exist`

- [ ] **Step 3: Write minimal implementation**

In `js/tiles.js`, add before the closing `};` (after the existing
`guardian` entry at line 60):

```js
  superBossMarker: { emoji: '💀', walkable: true, encounter: false, action: 'superBossBattle', description: 'A powerful presence looms here - only the best-prepared should approach' },
  superBossEntrance: { emoji: '🌋', walkable: true, encounter: false, action: 'enterSuperBossDungeon', description: 'A guarded passage - something far stronger than a guardian lies beyond' },
```

In `js/screens/mapScreen.js`, add the import alongside the existing one
at line 13:

```js
import { TOOL_DUNGEON_ENTRANCES } from '../data/toolDungeons.js';
import { SUPER_BOSSES } from '../data/superBosses.js';
```

Add both new tile kinds to `FULL_SQUARE_MARKERS` (line 92-108, alongside
the existing entrance tiles):

```js
const FULL_SQUARE_MARKERS = new Set([
  TILES.townEntrance,
  TILES.dungeonEntrance,
  TILES.axeDungeonEntrance,
  TILES.pickDungeonEntrance,
  TILES.canoeDungeonEntrance,
  TILES.portalDungeonEntrance,
  TILES.superBossEntrance,
  TILES.superBossMarker,
  TILES.miniDungeonEntrance,
  TILES.miniDungeonTreasure,
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
]);
```

(Note: `TILES.portalDungeonEntrance` was missing from this set before this
task — a pre-existing gap unrelated to superbosses, left as-is per this
plan's scope; only the two new tile kinds are added here.)

Add both to `GRASS_CONTEXT_MARKERS` (line 122-136):

```js
const GRASS_CONTEXT_MARKERS = new Set([
  TILES.townEntrance,
  TILES.dungeonEntrance,
  TILES.axeDungeonEntrance,
  TILES.pickDungeonEntrance,
  TILES.canoeDungeonEntrance,
  TILES.superBossEntrance,
  TILES.superBossMarker,
  TILES.shop,
  TILES.smith,
  TILES.questBoard,
  TILES.well,
  TILES.exit,
  TILES.treeGapNorth,
  TILES.treeGapSouth,
  TILES.treeGapEast,
  // ...rest of the existing set, unchanged
```

In `tileAt` (line 248-275), add a new loop right after the existing
tool-entrance loop (after line 257's closing `}`):

```js
function tileAt(screenConfig, x, y) {
  const entrance = state.dungeonEntrancePosition;
  if (entrance && screenConfig.id === entrance.screenId && x === entrance.x && y === entrance.y) {
    return TILES.dungeonEntrance;
  }
  for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
    if (screenConfig.id === toolEntrance.screenId && x === toolEntrance.x && y === toolEntrance.y) {
      return TILES[toolEntrance.tileKind];
    }
  }
  for (const superBoss of Object.values(SUPER_BOSSES)) {
    if (screenConfig.id === superBoss.screenId && x === superBoss.x && y === superBoss.y) {
      return TILES[superBoss.hasDungeon ? 'superBossEntrance' : 'superBossMarker'];
    }
  }
  if (state.portal && screenConfig.id === state.portal.originScreenId && x === state.portal.originX && y === state.portal.originY) {
    return TILES.portalOrigin;
  }
  // ...rest unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/superBosses.test.js`
Expected: PASS

Run the full suite to check nothing else broke: `node --test tests/*.js`
Expected: all PASS

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- Two new tile kinds, `superBossMarker` (open-wilderness encounter) and
  `superBossEntrance` (leads to a superboss's own dungeon), and their
  `mapScreen.js` rendering/resolution wiring - part of the super-boss
  pass.
```

```bash
git add js/tiles.js js/screens/mapScreen.js tests/superBosses.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add superBossMarker/superBossEntrance tile kinds

Wires SUPER_BOSSES into mapScreen.js's tile resolution and marker
rendering sets, same pattern as TOOL_DUNGEON_ENTRANCES.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 3: `main.js` action wiring

**Files:**
- Modify: `js/main.js` (import near the `TOOL_DUNGEON_ENTRANCES` import, `handleTileAction` at line 503-546, `exitMap` branch at line 515-530)
- Test: `tests/superBosses.test.js` (extend)

**Interfaces:**
- Consumes: `SUPER_BOSSES` (Task 1), `TILES.superBossMarker`/`superBossEntrance` `.action` values (Task 2), existing `handleEncounter(monsterIds)` and `enterMap(mapId, position)`.
- Produces: `findSuperBossAt(screenId, x, y)` helper — no other task consumes it directly, but it's the shared lookup both new action branches use.

- [ ] **Step 1: Write the failing test**

`main.js` isn't unit-tested directly anywhere in this repo (it's the
top-level app wiring, exercised via the existing DOM/jsdom screen tests
instead) — this task's correctness is verified by extending
`tests/superBosses.test.js` with a pure structural check on the registry
shape actually needed by the new action handlers, plus manual
verification once Task 14 places a real superboss:

```js
// append to tests/superBosses.test.js
test('a hasDungeon SUPER_BOSSES entry always names a distinct dungeonMapId, never reused across entries', () => {
  const dungeonMapIds = Object.values(SUPER_BOSSES)
    .filter((entry) => entry.hasDungeon)
    .map((entry) => entry.dungeonMapId);
  const uniqueIds = new Set(dungeonMapIds);
  assert.equal(uniqueIds.size, dungeonMapIds.length, 'each hasDungeon superboss must have its own unique dungeonMapId');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/superBosses.test.js`
Expected: PASS trivially (empty registry, zero entries to check) — this
step's real value lands once Task 14 adds a real entry; confirm instead
that the full suite still passes before continuing: `node --test tests/*.js`

- [ ] **Step 3: Write the implementation**

Add the import in `js/main.js`, alongside the existing
`TOOL_DUNGEON_ENTRANCES` import:

```js
import { TOOL_DUNGEON_ENTRANCES } from './data/toolDungeons.js';
import { SUPER_BOSSES } from './data/superBosses.js';
```

Add a small helper near the top of the file, alongside `TOWN_ENTRANCE`:

```js
function findSuperBossAt(screenId, x, y) {
  return Object.values(SUPER_BOSSES).find(
    (entry) => entry.screenId === screenId && entry.x === x && entry.y === y
  );
}
```

Add two new branches to `handleTileAction` (line 503-546), alongside the
existing `guardianBattle` branch:

```js
  if (action === 'guardianBattle') {
    handleEncounter([MAPS[state.map].guardianMonsterId]);
    return;
  }
  if (action === 'superBossBattle') {
    const superBoss = findSuperBossAt(state.map, state.position.x, state.position.y);
    if (superBoss) handleEncounter([superBoss.monsterId]);
    return;
  }
  if (action === 'enterSuperBossDungeon') {
    const superBoss = findSuperBossAt(state.map, state.position.x, state.position.y);
    if (superBoss) return enterMap(superBoss.dungeonMapId);
    return;
  }
```

Add a `SUPER_BOSSES` branch to the `exitMap` handler's per-source loop
(line 515-530), alongside the existing tool-entrance loop, so leaving a
superboss's dungeon lands back at its entrance:

```js
  if (action === 'exitMap') {
    if (state.map === 'dungeon') {
      const { screenId, x, y } = state.dungeonEntrancePosition;
      return enterMap(screenId, { x, y });
    }
    for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
      if (state.map === toolEntrance.mapId) {
        return enterMap(toolEntrance.screenId, { x: toolEntrance.x, y: toolEntrance.y });
      }
    }
    for (const superBoss of Object.values(SUPER_BOSSES)) {
      if (superBoss.hasDungeon && state.map === superBoss.dungeonMapId) {
        return enterMap(superBoss.screenId, { x: superBoss.x, y: superBoss.y });
      }
    }
    return;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/*.js`
Expected: all PASS (no regressions; `main.js` has no direct unit test to
newly pass here, this is manually smoke-tested once Task 14's real
superboss exists — see that task's own verification step)

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- `main.js` now resolves `superBossBattle`/`enterSuperBossDungeon` tile
  actions and handles exiting a superboss's own dungeon back to its
  entrance - completes the super-boss pass's placement plumbing.
```

```bash
git add js/main.js tests/superBosses.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: wire superboss tile actions into main.js

Stepping on a superBossMarker fights it directly; stepping on a
superBossEntrance enters its dungeon map; exiting that dungeon lands
back at the entrance - same shape as the existing tool-dungeon flow.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

## Phase 2: Itemization plumbing

### Task 4: New top tier + guaranteed-drop `tier` override

**Files:**
- Modify: `js/systems/itemQuality.js` (`QUALITY_TIER_MULTIPLIERS`, `tierLabel`)
- Modify: `js/systems/loot.js` (`rollDrop`'s `monster.dropTable` branch)
- Test: `tests/itemQuality.test.js` (apex tier + `tierLabel`) and `tests/loot.test.js` (the `dropTable.tier` override) — both files already exist, append to them

**Interfaces:**
- Produces: `QUALITY_TIER_MULTIPLIERS.apex` (placeholder name/value, `1.9`), a `dropTable` entry may now carry an explicit `tier` field that `rollDrop` applies directly.
- Consumes: nothing new from earlier tasks.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/itemQuality.test.js (it already imports QUALITY_TIER_MULTIPLIERS/tierLabel-equivalent from itemQuality.js - match its existing import block rather than adding a duplicate)
test('apex is a real quality tier, above mythic', () => {
  assert.ok(QUALITY_TIER_MULTIPLIERS.apex, 'apex tier must exist');
  assert.ok(QUALITY_TIER_MULTIPLIERS.apex > QUALITY_TIER_MULTIPLIERS.mythic, 'apex must multiply more than mythic');
  assert.equal(tierLabel('apex'), 'Apex ');
});
```

```js
// append to tests/loot.test.js (already imports rollDrop from ../js/systems/loot.js)
test('a dropTable entry with an explicit tier is applied directly, bypassing the random roll', () => {
  const monster = {
    hp: 3200, attack: 70, defense: 30, speed: 14, xp: 500, goldRange: [150, 220],
    forceFullBattle: true,
    dropTable: [{ itemId: 'ironSword', chance: 1, tier: 'apex' }],
  };
  // rng() always returns 0 - if the explicit tier were NOT honored, the
  // toughness-eligibility exclusion (forceFullBattle) would still block
  // any tier from ever being set, so this specifically pins down that the
  // explicit `tier` field wins regardless of what rollQualityTier would
  // have rolled.
  const drop = rollDrop(monster, () => 0, 0);
  assert.equal(drop.item, 'ironSword');
  assert.equal(drop.tier, 'apex');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/itemQuality.test.js tests/loot.test.js`
Expected: FAIL — `apex tier must exist` (AssertionError, `undefined`)

- [ ] **Step 3: Write minimal implementation**

In `js/systems/itemQuality.js`, extend `QUALITY_TIER_MULTIPLIERS` (find
the existing line and replace it):

```js
// New top tier for guaranteed super-boss drops, above mythic - name and
// multiplier are both first-pass placeholders (Timothy writes the real
// name; the multiplier is tuned via the simulator alongside each
// superboss's own stat block, same as every number in this pass). Never
// reachable via rollQualityTier's random roll (superbosses are
// forceFullBattle, so isToughnessEligible excludes them) - only assigned
// via an explicit `tier` field on a dropTable entry (see loot.js's
// rollDrop).
export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20, mythic: 1.5, apex: 1.9 };
```

Extend `tierLabel`:

```js
export function tierLabel(tier) {
  if (tier === 'fine') return 'Fine ';
  if (tier === 'superior') return 'Superior ';
  if (tier === 'mythic') return 'Mythic ';
  if (tier === 'apex') return 'Apex ';
  return '';
}
```

In `js/systems/loot.js`'s `rollDrop`, find the `monster.dropTable` branch
(the block right after the toughness-weighted `if (eligible) { ... }`)
and add the explicit-tier override right after the existing named-drop
quality roll:

```js
  if (!item && monster.dropTable && monster.dropTable.length > 0) {
    const roll = rng();
    let cumulative = 0;
    let matchedEntry = null;
    for (const entry of monster.dropTable) {
      cumulative += entry.chance;
      if (roll < cumulative) {
        item = entry.itemId;
        matchedEntry = entry;
        break;
      }
    }
    if (item && eligible && ITEMS[item].slot) {
      const quality = rollQualityTier(toughness, rng, ngPlusCycle);
      if (quality !== 'plain') tier = quality;
    }
    if (item && monster.isBoss && ngPlusCycle >= 1 && ITEMS[item].slot && rng() < BOSS_MYTHIC_CHANCE) {
      tier = 'mythic';
    }
    // A dropTable entry can name its own guaranteed tier directly (e.g. a
    // superboss's chance:1 drop at tier: 'apex') - bypasses the random
    // rolls above entirely, since forceFullBattle monsters are already
    // excluded from them (isToughnessEligible), so without this a
    // guaranteed drop could never reach a non-plain tier at all.
    if (item && matchedEntry.tier) {
      tier = matchedEntry.tier;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/itemQuality.test.js tests/loot.test.js`
Expected: PASS

Run the full suite: `node --test tests/*.js`
Expected: all PASS

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- New `apex` item-quality tier above `mythic` (placeholder name/value,
  `js/systems/itemQuality.js`), and a `dropTable` entry can now carry an
  explicit `tier` field applied directly (`js/systems/loot.js`) - needed
  since guaranteed super-boss drops bypass the random toughness roll
  entirely.
```

```bash
git add js/systems/itemQuality.js js/systems/loot.js tests/itemQuality.test.js tests/loot.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add apex item tier and dropTable.tier override

New top quality tier above mythic, plus a way for a dropTable entry to
guarantee its own tier directly - the mechanism super-boss guaranteed
drops need, since forceFullBattle monsters are already excluded from
the random toughness-weighted roll.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 5: Mythic drop-rate rework (pre-NG+ chance + per-cycle growth)

**Files:**
- Modify: `js/systems/itemQuality.js` (`rollQualityTier` and its constants)
- Test: `tests/itemQuality.test.js` (already exists and already tests
  `rollQualityTier`-adjacent behavior — append there, reusing its
  existing import block rather than adding a duplicate import)

**Interfaces:**
- Produces: `PRE_NG_PLUS_MYTHIC_CHANCE_MIN/MAX`, `MYTHIC_TIER_NG_PLUS_GROWTH` constants; `rollQualityTier`'s signature is unchanged (`(toughness, rng, ngPlusCycle)`).

- [ ] **Step 1: Write the failing test**

```js
// append to tests/itemQuality.test.js (add MYTHIC_TIER_CHANCE_MIN/MAX to its existing itemQuality.js import block if not already imported there)
test('pre-NG+ (cycle 0) has a small but nonzero Mythic chance instead of a flat 0%', () => {
  // rng() just above the pre-NG+ band's ceiling at max toughness should
  // NOT roll mythic; just below it should.
  const roll = rollQualityTier(1, () => 0.003, 0);
  assert.equal(roll, 'mythic');
  const noRoll = rollQualityTier(1, () => 0.01, 0);
  assert.notEqual(noRoll, 'mythic');
});

test('NG+1 reproduces the exact pre-existing Mythic band, unchanged', () => {
  const justUnder = rollQualityTier(1, () => (MYTHIC_TIER_CHANCE_MAX - 0.0001), 1);
  assert.equal(justUnder, 'mythic');
  const justOver = rollQualityTier(1, () => (MYTHIC_TIER_CHANCE_MAX + 0.0001), 1);
  assert.notEqual(justOver, 'mythic');
});

test('NG+2 scales the Mythic band up by the growth multiplier, uncapped', () => {
  const scaledMax = MYTHIC_TIER_CHANCE_MAX * 1.5;
  const justUnder = rollQualityTier(1, () => (scaledMax - 0.0001), 2);
  assert.equal(justUnder, 'mythic');
  const justOver = rollQualityTier(1, () => (scaledMax + 0.0001), 2);
  assert.notEqual(justOver, 'mythic');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/itemQuality.test.js`
Expected: FAIL — cycle-0 test fails first (`rollQualityTier(1, () => 0.003,
0)` returns `'plain'` under the current flat-0% behavior, not `'mythic'`)

- [ ] **Step 3: Write minimal implementation**

In `js/systems/itemQuality.js`, replace the existing constants/function:

```js
// Very small but nonzero pre-NG+ Mythic band, and per-cycle growth for
// NG+1 and beyond, replacing the old flat 0%-before-NG+1-then-forever-
// fixed shape. First-pass placeholder numbers, same spirit as the
// ability-GCD constants that shipped as "a starting point, not final
// tuning" - this is drop-rarity feel, not combat difficulty, so it isn't
// gated on simulator validation like the combat numbers elsewhere in this
// pass.
export const PRE_NG_PLUS_MYTHIC_CHANCE_MIN = 0.001;
export const PRE_NG_PLUS_MYTHIC_CHANCE_MAX = 0.004;
export const MYTHIC_TIER_CHANCE_MIN = 0.005;
export const MYTHIC_TIER_CHANCE_MAX = 0.02;
// Matches the exponential-uncapped style ngPlus.js's own
// NG_PLUS_DROP_CHANCE_MULTIPLIER/NG_PLUS_COMBAT_MULTIPLIER already use.
// Growth starts at NG+2 (NG_PLUS_MYTHIC_TIER_GROWTH ** (cycle - 1)), so
// NG+1 reproduces today's exact band unchanged.
export const MYTHIC_TIER_NG_PLUS_GROWTH = 1.5;

export function rollQualityTier(toughness, rng = Math.random, ngPlusCycle = 0) {
  const mythicChance = ngPlusCycle >= 1
    ? lerp(MYTHIC_TIER_CHANCE_MIN, MYTHIC_TIER_CHANCE_MAX, toughness) * (MYTHIC_TIER_NG_PLUS_GROWTH ** (ngPlusCycle - 1))
    : lerp(PRE_NG_PLUS_MYTHIC_CHANCE_MIN, PRE_NG_PLUS_MYTHIC_CHANCE_MAX, toughness);
  const superiorChance = lerp(0.02, 0.10, toughness);
  const fineChance = lerp(0.10, 0.25, toughness);
  const roll = rng();
  if (roll < mythicChance) return 'mythic';
  if (roll < mythicChance + superiorChance) return 'superior';
  if (roll < mythicChance + superiorChance + fineChance) return 'fine';
  return 'plain';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/itemQuality.test.js`
Expected: PASS

Run the full suite: `node --test tests/*.js`
Expected: all PASS — double-check no other test hardcodes the old
flat-0%-pre-NG+ behavior (search first: `grep -rn "rollQualityTier" tests/`)

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Changed
- Mythic-tier item drops are no longer flatly impossible before your
  first NG+ cycle - a small new pre-NG+ chance exists (~0.1-0.4% by
  monster toughness), and the NG+1+ band now scales up per cycle
  (×1.5/cycle starting at NG+2) instead of staying fixed at the NG+1
  numbers forever. `js/systems/itemQuality.js`.
```

```bash
git add js/systems/itemQuality.js tests/itemQuality.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
balance: rework Mythic drop-rate curve for pre-NG+ and per-cycle growth

Was a hard binary - flat 0% before NG+1, then a fixed band forever
after. Now a small nonzero pre-NG+ chance, and the post-NG+1 band scales
up per cycle (matching the exponential-uncapped style the rest of the
NG+ system already uses), instead of flatlining. First-pass numbers, not
simulator-gated (drop rarity feel, not combat difficulty).

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

## Phase 3: Boss special-attack system

### Task 6: Player slow/stun debuffs in `combat.js` + guard wiring

**Files:**
- Modify: `js/systems/combat.js` (append new functions near `applyEnemySlow`)
- Modify: `js/screens/battleScreen.js` (module state near line 75, `recomputeEffectBonuses` line 477-493, `tick()` line 1884-1889, guards at lines 594-595, 1587-1588, 1618)
- Test: `tests/combat.test.js` (already exists — append there)

**Interfaces:**
- Produces: `createPlayerSlowDebuff(slowPercent, durationMs)`,
  `tickPlayerSlowDebuff(debuff, dt)`, `applyPlayerSlowDebuff(speed, debuff)`,
  `createPlayerStunDebuff(durationMs)`, `tickPlayerStunDebuff(debuff, dt)`
  in `combat.js`. Task 7 creates these debuffs when a special attack
  lands; this task only builds the primitives and wires their tick/apply
  into the existing battle loop (with `null` initial state, so nothing
  yet actually creates one).

- [ ] **Step 1: Write the failing test**

```js
// append to tests/combat.test.js - add createPlayerSlowDebuff, tickPlayerSlowDebuff,
// applyPlayerSlowDebuff, createPlayerStunDebuff, tickPlayerStunDebuff to its
// existing combat.js import block (do not add a second import statement)

test('createPlayerSlowDebuff then applyPlayerSlowDebuff reduces speed by the given percent', () => {
  const debuff = createPlayerSlowDebuff(20, 3000);
  assert.equal(applyPlayerSlowDebuff(20, debuff), 16); // same math as applyEnemySlow(20, 20) => round(20 * 0.8)
});

test('applyPlayerSlowDebuff with no debuff returns speed unchanged', () => {
  assert.equal(applyPlayerSlowDebuff(20, null), 20);
});

test('tickPlayerSlowDebuff expires to null exactly at zero remaining', () => {
  let debuff = createPlayerSlowDebuff(20, 300);
  debuff = tickPlayerSlowDebuff(debuff, 300);
  assert.equal(debuff, null);
});

test('tickPlayerSlowDebuff on null stays null', () => {
  assert.equal(tickPlayerSlowDebuff(null, 300), null);
});

test('createPlayerStunDebuff then tickPlayerStunDebuff counts down to null', () => {
  let debuff = createPlayerStunDebuff(1000);
  assert.ok(debuff);
  debuff = tickPlayerStunDebuff(debuff, 700);
  assert.equal(debuff.remainingMs, 300);
  debuff = tickPlayerStunDebuff(debuff, 700);
  assert.equal(debuff, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/combat.test.js`
Expected: FAIL — `createPlayerSlowDebuff is not a function`

- [ ] **Step 3: Write minimal implementation**

In `js/systems/combat.js`, add after `applyEnemySlow`:

```js
// Player-side counterpart to applyEnemySlow above - a superboss special
// attack (js/screens/battleScreen.js) slows the PLAYER instead of the
// player slowing a monster, same math, opposite direction. null means "no
// debuff active" (same convention as abilities.js's createDefenseDebuff/
// tickDefenseDebuff), not an {active: false} object.
export function createPlayerSlowDebuff(slowPercent, durationMs) {
  return { slowPercent, remainingMs: durationMs };
}

export function tickPlayerSlowDebuff(debuff, dt) {
  if (!debuff) return null;
  const remainingMs = Math.max(0, debuff.remainingMs - dt);
  return remainingMs === 0 ? null : { ...debuff, remainingMs };
}

export function applyPlayerSlowDebuff(speed, debuff) {
  if (!debuff) return speed;
  return applyEnemySlow(speed, debuff.slowPercent);
}

// Blocks Attack/ability/item actions while active (js/screens/
// battleScreen.js's own guards) - Flee is deliberately NOT blocked, so a
// missed parry against a superboss's special attack costs you a beat of
// action, not the ability to disengage.
export function createPlayerStunDebuff(durationMs) {
  return { remainingMs: durationMs };
}

export function tickPlayerStunDebuff(debuff, dt) {
  if (!debuff) return null;
  const remainingMs = Math.max(0, debuff.remainingMs - dt);
  return remainingMs === 0 ? null : { remainingMs };
}
```

In `js/screens/battleScreen.js`, add module state near the existing
`let widenBuffState = null;` (line 75):

```js
let widenBuffState = null;
let playerSlowDebuff = null;
let playerStunDebuff = null;
```

Import the new functions alongside the existing `combat.js` import (line 4):

```js
import { tickGauge, isReady, ATB_MAX, pickAppearLine, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, applyKnockback, ATB_KNOCKBACK, attackStreakMultiplier, attackKnockbackMultiplier, attackCooldownMsForStreak, ATTACK_STREAK_FLOOR, ATTACK_STREAK_FLOOR_PER_ABILITY, ATTACK_STREAK_RECOVERY_MS, attackFalloffJustTriggered, abilityGcdMsForSpeed, attackStreakGcdBonusMs, createPlayerSlowDebuff, tickPlayerSlowDebuff, applyPlayerSlowDebuff, createPlayerStunDebuff, tickPlayerStunDebuff } from '../systems/combat.js';
```

In `recomputeEffectBonuses()` (line 477-493), apply the slow debuff right
after `playerCombatant.speed` is set:

```js
    playerCombatant.attack = state.player.attack + playerEffectBonuses.attack;
    playerCombatant.defense = state.player.defense + playerEffectBonuses.defense;
    playerCombatant.speed = applyPlayerSlowDebuff(state.player.speed + playerEffectBonuses.speed, playerSlowDebuff);
    playerCombatant.maxHp = state.player.maxHp + playerEffectBonuses.maxHp;
```

In `tick()` (line 1884-1889), tick both new debuffs alongside the
existing ones:

```js
  attackCooldownMs = Math.max(0, attackCooldownMs - 300);
  parryCooldownMs = Math.max(0, parryCooldownMs - 300);
  abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
  buffState = tickBuff(buffState, 300);
  widenBuffState = tickDefenseDebuff(widenBuffState, 300);
  playerSlowDebuff = tickPlayerSlowDebuff(playerSlowDebuff, 300);
  playerStunDebuff = tickPlayerStunDebuff(playerStunDebuff, 300);
  activeBuffs = tickActiveBuffs(activeBuffs, 300);
  recomputeEffectBonuses();
```

Add the stun guard to `openItemMenu()` (line 594-595):

```js
function openItemMenu() {
  if (battleOver || battlePaused || itemMenuOpen || playerStunDebuff) return;
```

Add the stun guard to `playerAttack()` (line 1587-1588):

```js
  if (battleOver || battlePaused || playerStunDebuff) return;
  if (abilityActionInFlight || attackCooldownMs > 0) return;
```

Add the stun guard to `playerUseAbility()` (line 1618):

```js
  if (battleOver || battlePaused || playerStunDebuff) return;
```

Reset both to `null` in `mount()` alongside the existing combatant setup
(find the line that resets `widenBuffState` on mount, or add near line
2170's `recomputeEffectBonuses(); playerCombatant = buildPlayerCombatant(playerEffectBonuses);` — add `playerSlowDebuff = null; playerStunDebuff = null;` right before those two lines, so a fresh battle never inherits a stale debuff from a previous one).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/combat.test.js`
Expected: PASS

Run the full suite: `node --test tests/*.js`
Expected: all PASS (no monster yet has a special attack, so this is
dead-but-tested code until Task 7)

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- New player-side slow/stun debuff primitives (`js/systems/combat.js`)
  and their tick/guard wiring in the battle screen - foundation for the
  super-boss special-attack system (not yet triggerable by any monster).
```

```bash
git add js/systems/combat.js js/screens/battleScreen.js tests/combat.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add player slow/stun debuff primitives

New create/tick/apply functions in combat.js, wired into battleScreen's
tick loop and action guards (Attack/ability/item menu blocked while
stunned; Flee deliberately untouched). No monster can trigger these yet
- that's Task 7's special-attack roll.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 7: Monster special-attack roll + parry tie-in

**Files:**
- Modify: `js/screens/battleScreen.js` (`buildMonsterCombatant` line 144-159, `monsterAttack` line 1797-1819, `resolveMonsterWindup` line 1826-1856)
- Create: `tests/battleSpecialAttacks.test.js` (mirrors `tests/battleScreenDom.test.js`'s exact jsdom/real-time-wall-clock pattern — that file already exists and already tests parry timing this same way; this task follows it, not a new pattern)

**Interfaces:**
- Consumes: `createPlayerSlowDebuff`, `createPlayerStunDebuff` (Task 6),
  `applyAbilityGcd` (already in `abilities.js`).
- Produces: a monster with `specialAttacks: [{ type, chancePerTurn, ...params }]`
  now telegraphs one instead of always attacking plainly; a successful
  parry negates it exactly like it negates damage.

- [ ] **Step 1: Write the failing test**

`tests/battleScreenDom.test.js` already tests parry timing against a
real wall clock (not a mocked one) — `waitForWindupStart(fill)` polls
until the windup's CSS animation actually starts, and
`waitUntilZoneMidpoint(windupStart)` waits until the real elapsed time
hits the parry zone's midpoint. This new file copies that exact pattern
verbatim rather than inventing a mock-clock approach:

```js
// tests/battleSpecialAttacks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT, PARRY_ZONE_END_PERCENT } from '../js/systems/parry.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), ...overrides };
}

// Copied verbatim from tests/battleScreenDom.test.js - see that file's own
// comment for why a real wall-clock wait is the correct approach here
// (this IS the timing behavior under test).
async function waitForWindupStart(fill) {
  const pollStart = Date.now();
  while (!fill.style.animation) {
    if (Date.now() - pollStart > 2000) throw new Error('windup animation never started');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return Date.now();
}

async function waitUntilZoneMidpoint(windupStart) {
  const midpointPercent = (PARRY_ZONE_START_PERCENT + PARRY_ZONE_END_PERCENT) / 2;
  const targetElapsedMs = (midpointPercent / 100) * PARRY_WINDUP_DURATION_MS;
  const remaining = windupStart + targetElapsedMs - Date.now();
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

async function mountBattle(monsterIds, { state = baseState(), callbacks = {}, monsterOverrides } = {}) {
  const { mount } = await import('../js/screens/battleScreen.js');
  const root = createRoot();
  const battleEnds = [];
  mount(root, {
    state,
    monsterIds,
    monsterOverrides,
    callbacks: { onBattleEnd: (...args) => battleEnds.push(args), ...callbacks },
  });
  return { root, state, battleEnds };
}

test('battle special attacks', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/battleScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('an unparried slow special applies its debuff and logs it', async () => {
    // 'boar' supplies real hp/attack/defense/speed; monsterOverrides
    // layers specialAttacks on top, same merge main.js's own
    // ngPlusOverridesList already does for real battles.
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ specialAttacks: [{ type: 'slow', chancePerTurn: 1, slowPercent: 20, durationMs: 3000 }] }],
    });
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    await waitForWindupStart(fill);
    // Let the windup expire unparried (mirrors battleScreenDom.test.js's
    // own coverage of a plain unparried hit - no press, just wait past
    // PARRY_WINDUP_DURATION_MS).
    await new Promise((resolve) => setTimeout(resolve, PARRY_WINDUP_DURATION_MS + 200));
    assert.match(root.querySelector('#battle-log').textContent, /slows you down/);
  });

  await t.test('a successful parry against a special attack negates it, not just the damage', async () => {
    const { root } = await mountBattle(['boar'], {
      monsterOverrides: [{ specialAttacks: [{ type: 'slow', chancePerTurn: 1, slowPercent: 20, durationMs: 3000 }] }],
    });
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    const windupStart = await waitForWindupStart(fill);
    await waitUntilZoneMidpoint(windupStart);
    const { keydown } = await import('./helpers/dom.js');
    keydown('s'); // same parry shortcut tests/battleScreenDom.test.js already uses
    const log = root.querySelector('#battle-log').textContent;
    assert.match(log, /parry .*negate it/);
    assert.doesNotMatch(log, /slows you down/);
  });

  await t.test('an unparried cooldownOverload special disables an off-cooldown ability button', async () => {
    const state = baseState();
    state.player.level = 6; // unlocks stab/chop/slash
    const { root } = await mountBattle(['boar'], {
      state,
      monsterOverrides: [{ specialAttacks: [{ type: 'cooldownOverload', chancePerTurn: 1, gcdMs: 6000 }] }],
    });
    const stabBtn = root.querySelector('#btn-ability-stab');
    assert.equal(stabBtn.disabled, false, 'stab should start off cooldown');
    const fill = root.querySelector('#battle-monster-atb-fill-0');
    await waitForWindupStart(fill);
    await new Promise((resolve) => setTimeout(resolve, PARRY_WINDUP_DURATION_MS + 200));
    assert.equal(stabBtn.disabled, true, 'stab should be pushed onto cooldown by the special attack');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/battleSpecialAttacks.test.js`
Expected: FAIL — no monster combatant ever gets a `specialAttacks` field
yet, so the slow/stun/cooldown assertions all fail against unaffected
state.

- [ ] **Step 3: Write minimal implementation**

In `buildMonsterCombatant` (line 144-159), carry the new field through:

```js
function buildMonsterCombatant(monsterId, overrides, bonuses) {
  const monster = { ...MONSTERS[monsterId], ...(overrides || {}) };
  const speed = applyEnemySlow(monster.speed, bonuses.enemySlowPercent);
  return {
    monsterId,
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed,
    attackStyle: monster.attackStyle, projectileEmoji: monster.projectileEmoji,
    atb: 0,
    windup: createWindupState(),
    defenseDebuff: null,
    pendingDelayedHit: null,
    deathStyle: null,
    specialAttacks: monster.specialAttacks || [],
    pendingSpecialAttack: null,
  };
}
```

Roll which special (if any) fires at the moment a windup starts. In
`tick()`, right after `mc.windup = startWindup();` (inside the
`if (isReady(mc.atb) && !mc.windup.active)` branch):

```js
    if (isReady(mc.atb) && !mc.windup.active) {
      mc.windup = startWindup();
      mc.pendingSpecialAttack = rollSpecialAttack(mc.specialAttacks);
      if (mc.pendingSpecialAttack) {
        log.push(`${mc.name} winds up for something different...`);
        updateLog();
      }
      const index = monsterCombatants.indexOf(mc);
      // ...rest of the existing windup-start block, unchanged
```

Add the roll helper near the top of the file, alongside
`pickRandomOtherLivingIndices`:

```js
// Mutually exclusive, first-match-wins roll through a monster's own
// specialAttacks list (empty for every non-superboss monster today) -
// returns the chosen config or null for a plain attack this turn.
function rollSpecialAttack(specialAttacks) {
  for (const special of specialAttacks) {
    if (Math.random() < special.chancePerTurn) return special;
  }
  return null;
}
```

In `resolveMonsterWindup` (line 1826-1856), the successful-parry branch
already never calls `monsterAttack` — so a special attack is already
fully negated on a successful parry with zero changes needed there. Just
clear `pendingSpecialAttack` on both branches so it can't leak into a
future turn's plain attack:

```js
function resolveMonsterWindup(monster, parried, { requireZone = true, playHeroEffect = true } = {}) {
  if (battleOver || battlePaused) return false;
  if (monster.hp <= 0) return false;
  if (!monster.windup.active) return false;
  const elapsedPercent = windupElapsedPercent(monster.windup);
  monster.windup = createWindupState();
  const special = monster.pendingSpecialAttack;
  monster.pendingSpecialAttack = null;
  const index = monsterCombatants.indexOf(monster);
  if (parried && (!requireZone || resolveParryAttempt(elapsedPercent))) {
    const { damage, isCrit } = rollIncomingDamage(monster, playerCombatant);
    const result = resolveParrySuccess(monster, damage);
    monster.hp = result.monsterHp;
    monster.atb = result.monsterAtb;
    log.push(special
      ? `You parry ${monster.name}'s strange attack and negate it, striking back for ${result.reflectedDamage}!`
      : `You parry ${monster.name}'s attack and strike back for ${result.reflectedDamage}!`);
    playHitEffect(elements.monsterZones[index], elements.monsterEmojis[index], result.reflectedDamage, true);
    if (playHeroEffect) playParryEffect(elements.heroZone, elements.heroEmoji);
    updateHpBars();
    updateLog();
    checkOutcome();
    updateAtbBars();
    updateMenu();
    return true;
  }
  monsterAttack(monster, special);
  updateAtbBars();
  updateMenu();
  return false;
}
```

In `monsterAttack` (line 1797-1819), apply the special's effect on a
missed/failed parry, after the normal damage impact:

```js
function monsterAttack(monster, special = null) {
  const result = resolveMonsterAttack(monster, playerCombatant, Math.random, playerEffectBonuses.thornsPercent);
  playerCombatant.hp = result.playerHp;
  if (playerCombatant.hp <= 0 && secondWindAvailable) {
    secondWindAvailable = false;
    playerCombatant.hp = 1;
    log.push('Second Wind kicks in! You survive with 1 HP.');
  }
  monster.atb = result.monsterAtb;
  monster.hp = result.monsterHp;
  const monsterIndex = monsterCombatants.indexOf(monster);
  playMonsterAttackWindup(monster, monsterIndex);
  applyMonsterAttackImpact(monster, result);
  if (special) applySpecialAttackEffect(monster, special);
}

// Applies a superboss's special-attack effect on top of the normal hit
// that already landed above - only reached when the parry was missed or
// not attempted (resolveMonsterWindup never calls monsterAttack on a
// successful parry).
function applySpecialAttackEffect(monster, special) {
  if (special.type === 'slow') {
    playerSlowDebuff = createPlayerSlowDebuff(special.slowPercent, special.durationMs);
    log.push(`${monster.name}'s attack slows you down!`);
  } else if (special.type === 'stun') {
    playerStunDebuff = createPlayerStunDebuff(special.durationMs);
    log.push(`${monster.name}'s attack leaves you reeling!`);
  } else if (special.type === 'cooldownOverload') {
    ({ cooldowns: abilityCooldowns, totals: abilityCooldownTotals } = applyAbilityGcd(
      abilityCooldowns, getUnlockedAbilities(state.player.level), null, special.gcdMs, abilityCooldownTotals
    ));
    log.push(`${monster.name}'s attack disrupts your rotation!`);
  }
  updateLog();
  updateMenu();
}
```

(`getUnlockedAbilities` and `applyAbilityGcd` are already imported at the
top of `battleScreen.js` for the existing Attack-spam GCD throttle — no
new import needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/battleSpecialAttacks.test.js`
Expected: PASS

Run the full suite: `node --test tests/*.js`
Expected: all PASS

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- Monsters can now define `specialAttacks` (slow/stun/cooldownOverload),
  telegraphed through the existing parry wind-up - a successful parry
  negates the effect exactly like it negates damage, a missed one lets
  it land alongside the normal hit. No monster uses this yet (that's the
  super-boss pass's worked example).
```

```bash
git add js/screens/battleScreen.js tests/battleSpecialAttacks.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add monster special-attack system (slow/stun/cooldownOverload)

Rolled at windup start, resolved through the existing parry window -
parry success negates the effect, parry failure/miss applies it on top
of the normal hit. Reuses applyAbilityGcd for cooldownOverload (the
exact mechanism Attack-spam already uses on itself).

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 8: `simulateAbilityPolicy.js` parry-or-suffer policy

**Files:**
- Modify: `scripts/simulateAbilityPolicy.js`
- Modify: `scripts/simulate-balance.js` (wherever it calls `chooseAction`/resolves a monster's turn — read the surrounding ~30 lines around its existing `resolveMonsterWindup`-equivalent call before editing, since this file re-implements the tick loop headlessly rather than importing `battleScreen.js`)
- Test: `tests/simulateAbilityPolicy.test.js` if it exists (check with
  `ls tests/ | grep -i simulate`), else this task is verified by running
  `scripts/simulate-balance.js` itself against a synthetic special-attack
  monster (no unit test — this script is explicitly excluded from `npm
  test`'s `tests/*.js` glob per its own header comment)

**Interfaces:**
- Consumes: nothing new from earlier tasks structurally — this models the
  *policy* (a stand-in for human parry timing/reaction), not the mechanic
  itself, which Task 7 already built for the real game.
- Produces: `chooseAction` gains a `parryRate` and telegraphed-special
  awareness so `simulate-balance.js` can model a superboss's special
  attacks at all; without this, the simulator's HP-remaining/win-rate
  numbers for any superboss with special attacks would silently ignore
  them entirely (the sim's monster-turn loop, not `chooseAction`, decides
  whether a parry is even attempted today — confirm exactly where by
  reading `scripts/simulate-balance.js`'s `--parry-rate` handling, already
  referenced in its own header comment, before wiring this in).

- [ ] **Step 1: Read the existing parry-rate mechanism first**

```bash
grep -n "parryRate\|parry-rate\|PARRY_RATE" scripts/simulate-balance.js
```

This finds where the simulator already rolls whether its simulated player
"attempts" a parry on a given monster windup (per the CLI's own
`--parry-rate` flag documented in its header). Read that exact block (should
be within ~20 lines of the match) before writing this task's change — the
implementation below assumes that mechanism exists and just needs a
special-attack-aware log line for report readability; if the real
mechanism differs from this assumption, adjust to match what's actually
there rather than the sketch below.

- [ ] **Step 2: Write the implementation**

Add a special-attack outcome counter to `simulate-balance.js`'s existing
per-trial report accumulation (find the object that already tracks things
like win/loss counts and potions-used, add fields to it):

```js
// In whatever object already accumulates per-trial results:
specialAttacksLanded: 0,
specialAttacksParried: 0,
```

Wherever the existing parry-rate roll resolves a monster's windup
(located in Step 1 above), increment these two counters on the
special-attack path specifically, mirroring exactly how Task 7's real
`resolveMonsterWindup`/`monsterAttack` distinguish a parried vs. landed
special attack — reuse the same `pendingSpecialAttack`-style bookkeeping
(the simulator should carry a monster's `specialAttacks` config the same
way it already carries `hp`/`attack`/`defense` from `MONSTERS`, and roll
`rollSpecialAttack` the same way `battleScreen.js` does — extract that
function into `js/systems/combat.js` as a shared export instead of leaving
it private to `battleScreen.js`, so the simulator can import the exact
same logic rather than re-deriving it):

- [ ] **Step 2a: Move `rollSpecialAttack` out of `battleScreen.js` into `combat.js`**

Since the simulator needs the identical roll logic (not a re-implementation
that could drift), promote it to a shared export:

```js
// js/systems/combat.js - add near resolveMonsterAttack
export function rollSpecialAttack(specialAttacks, rng = Math.random) {
  for (const special of specialAttacks) {
    if (rng() < special.chancePerTurn) return special;
  }
  return null;
}
```

Update `battleScreen.js`'s own `rollSpecialAttack` call (Task 7) to import
this instead of defining it locally — delete the private copy Task 7 added,
import it from `combat.js` alongside the other imports there.

Update `tests/battleSpecialAttacks.test.js` — no change needed if it only
asserted observable behavior (not the private function directly); if it
imported the private copy, redirect that import to `combat.js`.

- [ ] **Step 2b: Wire it into `simulate-balance.js`'s monster-turn resolution**

At the point found in Step 1 (where a monster's windup resolves against
the simulated parry-rate roll), add:

```js
const special = rollSpecialAttack(monster.specialAttacks || []);
if (special && !parriedThisWindup) {
  applySpecialAttackEffect(monster, special); // mirrors battleScreen.js's own function, see below
  trialResult.specialAttacksLanded += 1;
} else if (special && parriedThisWindup) {
  trialResult.specialAttacksParried += 1;
}
```

Add a minimal `applySpecialAttackEffect` local to
`scripts/simulate-balance.js` (not shared with `battleScreen.js` — this
file already keeps its own parallel bookkeeping variables like
`player.atb`/`abilityCooldowns` rather than importing UI state, per its own
existing pattern):

```js
function applySpecialAttackEffect(monster, special, player, abilityCooldowns, unlockedAbilities) {
  if (special.type === 'slow') {
    player.speed = applyEnemySlow(player.speed, special.slowPercent); // reverted at the end of durationMs by whatever mechanism the sim already uses for timed effects - check its existing buff-duration bookkeeping and mirror that, don't invent a second one
  } else if (special.type === 'cooldownOverload') {
    ({ cooldowns: abilityCooldowns } = applyAbilityGcd(abilityCooldowns, unlockedAbilities, null, special.gcdMs));
  }
  // 'stun' has no simulator-side equivalent to model yet - the sim's
  // chooseAction() already only acts once per tick, same cadence a real
  // ~1-1.5s stun would suppress; leaving it unmodeled is a known
  // conservative gap (makes the sim slightly MORE optimistic against a
  // stun-heavy boss, on top of the reaction-latency optimism already
  // documented in this file's own header) - flag this explicitly in the
  // report output rather than silently ignoring it.
}
```

- [ ] **Step 3: Run to verify it works**

Run: `node scripts/simulate-balance.js --set someSuperBoss.specialAttacks='[{"type":"cooldownOverload","chancePerTurn":1,"gcdMs":6000}]' --trials 100`
(adjust the `--set` syntax to match whatever this script's existing
argument parser actually supports for non-scalar fields — check
`scripts/simulate-balance.js`'s CLI parsing section first; if it can't
take a JSON blob via `--set`, add a minimal `--special-attack` flag
instead, following the same parsing style as its existing `--parry-rate`)
Expected: report output includes non-zero `specialAttacksLanded`/
`specialAttacksParried` counts, confirming the wiring is live.

Run the full test suite to confirm nothing broke: `node --test tests/*.js`
Expected: all PASS

- [ ] **Step 4: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- `scripts/simulate-balance.js` can now model a monster's special
  attacks (slow/cooldownOverload; stun is a known unmodeled gap, noted
  in its report output) - `rollSpecialAttack` promoted from
  `battleScreen.js` to a shared `js/systems/combat.js` export so both
  the real game and the simulator use the identical roll.
```

```bash
git add js/systems/combat.js js/screens/battleScreen.js scripts/simulate-balance.js scripts/simulateAbilityPolicy.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: teach the balance simulator about special attacks

Promotes rollSpecialAttack to a shared combat.js export (both the real
game and the simulator now call the identical roll, not a
reimplementation that could drift) and models slow/cooldownOverload
effects in simulate-balance.js's headless tick loop. Stun has no
simulator-side model yet - flagged in the report output as a known
conservative gap, on top of the file's existing zero-reaction-latency
optimism.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

## Phase 4: New unique-effect items

### Task 9: New stat fields (`parryWindowBonusPercent`, `debuffDurationPercent`)

**Files:**
- Modify: `js/systems/inventory.js:24-28` (`STAT_KEYS`)
- Modify: `js/systems/parry.js` (`resolveParryAttempt` gains an optional bonus parameter)
- Modify: `js/screens/battleScreen.js` (both `resolveParryAttempt` call sites; the two `createPlayerSlowDebuff`/`createPlayerStunDebuff` call sites from Task 7's `applySpecialAttackEffect`)
- Test: `tests/parry.test.js` (widened `resolveParryAttempt`) and `tests/inventory.test.js` (new `STAT_KEYS` entries) — both already exist, append to them

**Interfaces:**
- Produces: two new keys in `getEquipmentBonuses`'s output shape —
  `parryWindowBonusPercent`, `debuffDurationPercent`. Task 10's new items
  set these via their `stats` object.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/parry.test.js (add resolveParryAttempt/PARRY_ZONE_START_PERCENT to its existing parry.js import block if not already there)
test('resolveParryAttempt widens the zone when given a positive bonus', () => {
  const justBeforeDefaultZone = PARRY_ZONE_START_PERCENT - 1;
  assert.equal(resolveParryAttempt(justBeforeDefaultZone), false);
  assert.equal(resolveParryAttempt(justBeforeDefaultZone, 10), true, 'a 10-point bonus should widen the zone to catch this');
});

test('resolveParryAttempt with no bonus behaves exactly as before', () => {
  assert.equal(resolveParryAttempt(PARRY_ZONE_START_PERCENT), true);
  assert.equal(resolveParryAttempt(PARRY_ZONE_START_PERCENT - 1), false);
});
```

```js
// append to tests/inventory.test.js (it already imports getEquipmentBonuses from ../js/systems/inventory.js)
test('getEquipmentBonuses recognizes parryWindowBonusPercent and debuffDurationPercent as real stat keys', () => {
  const bonuses = getEquipmentBonuses({
    equipment: {}, // no item equipped - just confirm the KEYS exist on the zero-object
    equipmentTiers: {},
  });
  assert.ok('parryWindowBonusPercent' in bonuses, 'parryWindowBonusPercent must be a recognized stat key');
  assert.ok('debuffDurationPercent' in bonuses, 'debuffDurationPercent must be a recognized stat key');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/parry.test.js tests/inventory.test.js`
Expected: FAIL — `resolveParryAttempt` doesn't accept a second argument
yet (widen test fails); `'parryWindowBonusPercent' in bonuses` is `false`

- [ ] **Step 3: Write minimal implementation**

In `js/systems/inventory.js`, extend `STAT_KEYS` (line 24-28):

```js
const STAT_KEYS = [
  'attack', 'defense', 'maxHp', 'speed', 'enemySlowPercent',
  'lifestealPercent', 'extraSwingChance', 'elementalProcChance', 'elementalProcDamage',
  'critChancePercent', 'thornsPercent',
  'parryWindowBonusPercent', 'debuffDurationPercent',
];
```

In `js/systems/parry.js`, widen `resolveParryAttempt`:

```js
export function resolveParryAttempt(elapsedPercent, windowBonusPercent = 0) {
  const start = Math.max(PARRY_ZONE_END_PERCENT - 50, PARRY_ZONE_START_PERCENT - windowBonusPercent);
  return elapsedPercent >= start && elapsedPercent <= PARRY_ZONE_END_PERCENT;
}
```

(The `Math.max(..., 50-point-floor)` keeps a stacked bonus from ever
trivializing the window down to near-100%-of-the-whole-bar — a generous
but non-absurd floor; revisit once a real item's magnitude is chosen in
Task 10.)

In `js/screens/battleScreen.js`, pass the bonus at both existing call
sites (search for `resolveParryAttempt(` — two call sites, at roughly
line 1430 and line 1833 per this plan's earlier research):

```js
} else if (resolveParryAttempt(windupElapsedPercent(mc.windup), playerEffectBonuses.parryWindowBonusPercent)) {
```
```js
  if (parried && (!requireZone || resolveParryAttempt(elapsedPercent, playerEffectBonuses.parryWindowBonusPercent))) {
```

In `applySpecialAttackEffect` (Task 7), apply `debuffDurationPercent` when
creating the slow/stun debuffs:

```js
function applySpecialAttackEffect(monster, special) {
  const durationMs = Math.round(special.durationMs * (1 - playerEffectBonuses.debuffDurationPercent / 100));
  if (special.type === 'slow') {
    playerSlowDebuff = createPlayerSlowDebuff(special.slowPercent, durationMs);
    log.push(`${monster.name}'s attack slows you down!`);
  } else if (special.type === 'stun') {
    playerStunDebuff = createPlayerStunDebuff(durationMs);
    log.push(`${monster.name}'s attack leaves you reeling!`);
  } else if (special.type === 'cooldownOverload') {
    ({ cooldowns: abilityCooldowns, totals: abilityCooldownTotals } = applyAbilityGcd(
      abilityCooldowns, getUnlockedAbilities(state.player.level), null, special.gcdMs, abilityCooldownTotals
    ));
    log.push(`${monster.name}'s attack disrupts your rotation!`);
  }
  updateLog();
  updateMenu();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/*.js`
Expected: all PASS

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- Two new equippable stat fields, `parryWindowBonusPercent` (widens the
  parry timing zone) and `debuffDurationPercent` (shortens the new
  slow/stun debuffs) - the mechanics super-boss counter-items (Task 10)
  need. No item grants them yet.
```

```bash
git add js/systems/inventory.js js/systems/parry.js js/screens/battleScreen.js tests/parry.test.js tests/combat.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add parryWindowBonusPercent and debuffDurationPercent stat fields

Widens the parry timing zone / shortens the new slow-stun debuffs
respectively - the two new mechanics super-boss counter-items will
grant. No item exists yet that sets either field.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 10: New unique-effect items

**Files:**
- Modify: `js/data/items.js` (append after the existing unique-effect block, line 59)
- Test: `tests/loot.test.js` (already imports `ITEMS` and `UNIQUE_EFFECT_ITEM_IDS` — append there)

**Interfaces:**
- Produces: 4 new `ITEMS` entries — 2 using the new fields from Task 9, 2
  reusing existing stat vocabulary at a higher ceiling than
  `emberRing`/`windfuryRing`. All names/emoji/flavor are placeholders for
  Timothy to rename before shipping.
- Consumes: `parryWindowBonusPercent`/`debuffDurationPercent` (Task 9).

- [ ] **Step 1: Write the failing test**

```js
// append to tests/loot.test.js (already imports ITEMS and UNIQUE_EFFECT_ITEM_IDS - no new imports needed)
const NEW_SUPERBOSS_UNIQUE_IDS = ['parryMasterRing', 'unshakenCharm', 'ferocityFang', 'stormringOfHaste'];

test('the new super-boss unique items exist with real slots and stats, and are excluded from the regular unique-drop pool', () => {
  for (const id of NEW_SUPERBOSS_UNIQUE_IDS) {
    assert.ok(ITEMS[id], `${id} must exist in ITEMS`);
    assert.ok(ITEMS[id].slot, `${id} must have a slot`);
    assert.ok(Object.keys(ITEMS[id].stats || {}).length > 0, `${id} must grant at least one stat`);
    assert.equal(ITEMS[id].price, 0, `${id} must be a found-only item (price 0)`);
  }
});

test('new super-boss unique items are NOT in the regular random unique-drop pool', () => {
  for (const id of NEW_SUPERBOSS_UNIQUE_IDS) {
    assert.ok(!UNIQUE_EFFECT_ITEM_IDS.includes(id), `${id} must stay exclusive to superboss guaranteed drops`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.js`
Expected: FAIL — `parryMasterRing must exist in ITEMS`

- [ ] **Step 3: Write minimal implementation**

In `js/data/items.js`, append after the existing unique-effect block
(after `windfuryRing`, before the `// Consumables` comment at line 61):

```js
  // Super-boss guaranteed drops - referenced directly by a superboss's own
  // dropTable, never added to js/systems/loot.js's UNIQUE_EFFECT_ITEM_IDS
  // (that pool feeds the regular random per-kill roll; these stay
  // exclusive to super-boss encounters). All names/emoji/flavor are
  // placeholders - see docs/superpowers/specs/2026-09-05-superboss-pass-
  // design.md's Itemization section.
  parryMasterRing: { id: 'parryMasterRing', name: 'Parry Master Ring [PLACEHOLDER NAME]', emoji: '💍', slot: 'ring', price: 0,
    stats: { parryWindowBonusPercent: 15 } },
  unshakenCharm: { id: 'unshakenCharm', name: 'Unshaken Charm [PLACEHOLDER NAME]', emoji: '🧿', slot: 'accessory', price: 0,
    stats: { debuffDurationPercent: 40 } },
  ferocityFang: { id: 'ferocityFang', name: 'Ferocity Fang [PLACEHOLDER NAME]', emoji: '🦷', slot: 'weapon', price: 0,
    stats: { lifestealPercent: 25, critChancePercent: 12 } },
  stormringOfHaste: { id: 'stormringOfHaste', name: 'Stormring of Haste [PLACEHOLDER NAME]', emoji: '💍', slot: 'ring', price: 0,
    stats: { extraSwingChance: 18, elementalProcChance: 25, elementalProcDamage: 8 } },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/*.js`
Expected: all PASS

- [ ] **Step 5: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- 4 new unique-effect items for super-boss guaranteed drops
  (placeholder names, `js/data/items.js`): 2 using the new
  parry-window/debuff-duration mechanics, 2 at a higher ceiling than
  today's best (`emberRing`/`windfuryRing`). Not yet assigned to any
  superboss's drop table.
```

```bash
git add js/data/items.js tests/loot.test.js CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: add 4 new super-boss-exclusive unique items (placeholder names)

Extensible pool per the spec's scope decision - not one bespoke item
per boss. Two use the new parry-window/debuff-duration mechanics, two
reuse existing stat vocabulary at a higher ceiling. Excluded from the
regular random unique-drop pool by construction (not added to
UNIQUE_EFFECT_ITEM_IDS). Names are placeholders for Timothy to write.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

## Phase 5: Map editor (manual verification only — `tools/` has no automated tests)

### Task 11: "Place Super-Boss Marker" mode

**Files:**
- Modify: `tools/terrain-painter/painter.js` (mirror the existing "Place Tool Dungeon Entrance" mode — search `grep -n "toolDungeonMarkers\|PLACE_TOOL" tools/terrain-painter/painter.js` for its exact mode-switching/click-handling code before writing this, since this task must match that pattern exactly, not invent a new one)
- Modify: `tools/terrain-painter/index.html` (new mode button + superboss-id dropdown + hasDungeon toggle, mirroring the existing tool-dungeon-entrance controls' markup)
- Modify: `tools/terrain-painter/README.md` (document the new mode under "Features")

**Interfaces:**
- Consumes: `SUPER_BOSSES` (Task 1) — the painter loads it the same way it
  already loads `TOOL_DUNGEON_ENTRANCES` (`toolDungeonsMod` import visible
  in the earlier grep at line 720/820).
- Produces: an in-memory `superBossMarkers` object (parallel to the
  existing `toolDungeonMarkers`), read by Task 13's write server.

- [ ] **Step 1: Locate the exact existing pattern to mirror**

```bash
grep -n "toolDungeonMarkers\|cloneToolDungeonMarkers\|Place Tool Dungeon" tools/terrain-painter/painter.js tools/terrain-painter/index.html
```

Read the full surrounding blocks this finds — the mode-toggle button
wiring (`index.html`), the click handler that writes into
`toolDungeonMarkers[toolId]` on a click while that mode is active
(`painter.js`), and `cloneToolDungeonMarkers` (used by the undo-snapshot
system at line 154-160 from this plan's earlier research). This task's
implementation must follow that exact same three-part shape:
state object → click handler → undo-snapshot integration.

- [ ] **Step 2: Implement, mirroring the located pattern exactly**

Add `superBossMarkers = {}` alongside `toolDungeonMarkers` in the
painter's module state, extend `cloneToolDungeonMarkers`-equivalent
snapshot cloning to include it (so undo covers superboss placement too),
add a mode-select dropdown to `index.html` populated from
`SUPER_BOSSES`' keys (plus a "hasDungeon" checkbox that's saved onto the
marker alongside its position), and a click handler — while "Place
Super-Boss Marker" mode is active and a superboss id is selected in the
dropdown — that sets `superBossMarkers[selectedSuperBossId] = { x, y,
hasDungeon: checkboxState }`, exactly paralleling the tool-dungeon-entrance
click handler found in Step 1. Add a "Copy position" readout button
matching the existing tool-dungeon one's markup/behavior.

- [ ] **Step 3: Manual verification (no automated test — `tools/` is excluded from `npm test`)**

```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/tools/terrain-painter/index.html`, select
"Place Super-Boss Marker" mode, pick a superboss id (once Task 1's
registry has at least a placeholder key — coordinate with Task 14, or
temporarily add a throwaway test key to `SUPER_BOSSES` for this manual
check and remove it before committing), click a tile, confirm the
readout shows the position, toggle "hasDungeon", confirm undo (Ctrl+Z)
correctly reverts the placement.

- [ ] **Step 4: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- Terrain painter: new "Place Super-Boss Marker" mode
  (`tools/terrain-painter/`), same UX as today's "Place Tool Dungeon
  Entrance" - pick a superboss id, click a tile, toggle open-world vs.
  has-its-own-dungeon. Dev-only tool, not part of the deployed build.
```

```bash
git add tools/terrain-painter/painter.js tools/terrain-painter/index.html tools/terrain-painter/README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat(tools): add Place Super-Boss Marker mode to terrain painter

Same UX shape as the existing Place Tool Dungeon Entrance mode, plus a
hasDungeon toggle. Manually verified (tools/ has no automated tests, per
this repo's own established pattern for this dev-only tool).

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 12: "New Dungeon" blank-canvas authoring mode

**Files:**
- Modify: `tools/terrain-painter/painter.js` (new mode: prompt for a map id + width/height, initialize a blank grid using the same tile palette as today's dungeon-interior painting — find that palette with `grep -n "currentPalette\|DUNGEON_PALETTE" tools/terrain-painter/painter.js`, read `switchMap`/`rebuildPalette` at the lines this plan's earlier research already located (~746-820) to match exactly how an existing dungeon map is loaded/painted, then reuse the same code path against an empty grid instead of a loaded file)
- Modify: `tools/terrain-painter/index.html` (new "New Dungeon" button + name/size prompt UI)

**Interfaces:**
- Produces: a blank paintable grid the existing dungeon palette/brush/undo
  system already works against unmodified (this task only adds how a
  *blank* one gets created and named, not a new painting mechanism).

- [ ] **Step 1: Locate the exact existing single-map-loading pattern to mirror**

```bash
grep -n "function switchMap\|function loadSingleMap\|singleGrid\|singleMapW\|singleMapH" tools/terrain-painter/painter.js
```

Read the full `loadSingleMap`/`switchMap` implementation this finds (this
plan's earlier research already located `loadSingleMap` at line 234 and
`switchMap` at line 775) — it currently always loads an existing map
module's `rows`/`legend`. This task adds a second path that instead
initializes `singleGrid`/`singleMapW`/`singleMapH` from a blank
width×height grid filled with whatever the dungeon palette's default
walkable floor tile is (`caveFloor`, per `js/tiles.js`), without ever
calling the existing file-loading code.

- [ ] **Step 2: Implement**

Add a "New Dungeon" button to `index.html` that prompts for a map id
(validated as a legal JS identifier, since it becomes both a file's
exported const name and a `MAPS` registry key) and a width/height (a
sane default like 14×8, matching `axeDungeonMap`'s own size from this
plan's earlier research). On confirm, initialize `singleGrid` as
`Array(height).fill(null).map(() => Array(width).fill('caveFloor'))`,
set `singleMapW`/`singleMapH`, switch the current mode to the existing
single-map dungeon view (reusing `rebuildPalette`/`render` unchanged,
since they already operate on `singleGrid` generically), and remember the
new map's id + a `isNewDungeon: true` flag so Task 13's server knows to
*create* a file rather than *patch* one when this map is exported.

- [ ] **Step 3: Manual verification**

Start the painter, click "New Dungeon", enter a name and size, confirm a
blank paintable grid renders with the dungeon palette (walls/floor/exit/
guardian-equivalent tiles all clickable), paint a small test layout,
confirm undo works against it same as any other map.

- [ ] **Step 4: Commit**

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- Terrain painter: new "New Dungeon" mode - start a blank canvas at a
  chosen size using the existing dungeon tile palette, for authoring a
  brand-new dungeon interior from scratch (super-boss dungeons, not
  just editing an existing map file).
```

```bash
git add tools/terrain-painter/painter.js tools/terrain-painter/index.html CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat(tools): add New Dungeon blank-canvas authoring mode

Reuses the existing single-map dungeon painting/undo/palette code
unmodified, against a freshly initialized blank grid instead of a
loaded file. Manually verified (tools/ has no automated tests).

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

### Task 13: Node authoring server

**Files:**
- Create: `tools/terrain-painter/server.js`
- Modify: `tools/terrain-painter/painter.js` (point "Export All"/new-dungeon-save at the server's endpoints instead of the File System Access API, when running under the new server — keep the FSA path as a fallback exactly as it exists today for Firefox/Safari, per the spec's "Hybrid... drop the Chrome-only limitation" framing)
- Modify: `tools/terrain-painter/README.md` (new run command)

**Interfaces:**
- Consumes: `patchLegendRows`, `patchToolDungeonEntrance`,
  `patchDungeonEntrancePosition` logic (ported from `painter.js`'s
  existing client-side implementations, found at lines 522-550 in this
  plan's earlier research) — these are already pure string transforms
  taking `(originalText, ...)` and returning new text; port them verbatim
  into `server.js`, only swapping the File System Access
  `readFileText`/`writeFileText` calls for Node's `fs.readFile`/
  `fs.writeFile`.
- Produces: HTTP endpoints the painter's browser-side code calls with
  `fetch()` instead of `showDirectoryPicker()`.

- [ ] **Step 1: Port the existing patch functions**

Copy `patchLegendRows`, `patchDungeonEntrancePosition`,
`patchToolDungeonEntrance` from `painter.js` (lines 522-550) into
`server.js` unchanged (they take/return plain strings, no DOM/browser API
involved) and add a new `patchSuperBossEntry`, mirroring
`patchToolDungeonEntrance`'s exact regex approach:

```js
// tools/terrain-painter/server.js
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

// --- Ported verbatim from painter.js's client-side patch functions -----
function patchLegendRows(originalText, newLegendRowsText, fileLabel) {
  const legendRe = /const LEGEND = \{[\s\S]*?\};/;
  const rowsRe = /const ROWS = \[[\s\S]*?\];/;
  const legendMatch = originalText.match(legendRe);
  const rowsMatch = originalText.match(rowsRe);
  if (!legendMatch || !rowsMatch) throw new Error(`${fileLabel}: could not find LEGEND/ROWS block`);
  if (rowsMatch.index <= legendMatch.index) throw new Error(`${fileLabel}: ROWS appears before LEGEND - unexpected file shape, aborting`);
  if (!/'.+',/.test(rowsMatch[0])) throw new Error(`${fileLabel}: ROWS block doesn't look like row strings - aborting`);
  const newLegendText = newLegendRowsText.match(legendRe)[0];
  const newRowsText = newLegendRowsText.match(rowsRe)[0];
  return originalText.replace(legendRe, newLegendText).replace(rowsRe, newRowsText);
}

function patchDungeonEntrancePosition(originalText, pos) {
  const re = /export const DEFAULT_DUNGEON_ENTRANCE_POSITION = \{[^}]*\};/;
  if (!re.test(originalText)) throw new Error('state.js: could not find DEFAULT_DUNGEON_ENTRANCE_POSITION');
  return originalText.replace(re, `export const DEFAULT_DUNGEON_ENTRANCE_POSITION = { screenId: '${pos.screenId}', x: ${pos.x}, y: ${pos.y} };`);
}

function patchToolDungeonEntrance(originalText, toolId, pos) {
  const blockRe = new RegExp(`${toolId}: \\{[^}]*\\}`);
  const match = originalText.match(blockRe);
  if (!match) throw new Error(`toolDungeons.js: could not find '${toolId}' entry`);
  const mapIdMatch = match[0].match(/mapId: '([^']*)'/);
  const tileKindMatch = match[0].match(/tileKind: '([^']*)'/);
  if (!mapIdMatch || !tileKindMatch) throw new Error(`toolDungeons.js: '${toolId}' entry missing mapId/tileKind`);
  const newBlock = `${toolId}: {\n    screenId: '${pos.screenId}', x: ${pos.x}, y: ${pos.y}, mapId: '${mapIdMatch[1]}', tileKind: '${tileKindMatch[1]}',\n  }`;
  return originalText.replace(blockRe, newBlock);
}

// New: mirrors patchToolDungeonEntrance's exact shape for SUPER_BOSSES'
// slightly wider entry (also carries monsterId/hasDungeon/dungeonMapId).
function patchSuperBossEntry(originalText, superBossId, entry) {
  const blockRe = new RegExp(`${superBossId}: \\{[^}]*\\}`);
  const match = originalText.match(blockRe);
  if (!match) throw new Error(`superBosses.js: could not find '${superBossId}' entry`);
  const monsterIdMatch = match[0].match(/monsterId: '([^']*)'/);
  if (!monsterIdMatch) throw new Error(`superBosses.js: '${superBossId}' entry missing monsterId`);
  const dungeonMapId = entry.hasDungeon ? `'${entry.dungeonMapId}'` : 'null';
  const newBlock = `${superBossId}: {\n    id: '${superBossId}', monsterId: '${monsterIdMatch[1]}', screenId: '${entry.screenId}', x: ${entry.x}, y: ${entry.y}, hasDungeon: ${entry.hasDungeon}, dungeonMapId: ${dungeonMapId},\n  }`;
  return originalText.replace(blockRe, newBlock);
}
```

- [ ] **Step 2: Add the HTTP server itself**

```js
const STATIC_ROOT = join(import.meta.dirname);
const MIME_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

async function serveStatic(req, res) {
  const path = req.url === '/' ? '/index.html' : req.url;
  try {
    const content = await readFile(join(STATIC_ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(path)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function handlePatchWilderness(req, res) {
  const { screenId, legendRowsText } = await readJsonBody(req);
  const relativePath = join(REPO_ROOT, 'js', 'maps', 'wilderness', `${screenId}.js`);
  const originalText = await readFile(relativePath, 'utf8');
  const patched = patchLegendRows(originalText, legendRowsText, relativePath);
  if (patched !== originalText) await writeFile(relativePath, patched);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ changed: patched !== originalText }));
}

async function handlePatchSuperBoss(req, res) {
  const { superBossId, entry } = await readJsonBody(req);
  const relativePath = join(REPO_ROOT, 'js', 'data', 'superBosses.js');
  const originalText = await readFile(relativePath, 'utf8');
  const patched = patchSuperBossEntry(originalText, superBossId, entry);
  if (patched !== originalText) await writeFile(relativePath, patched);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ changed: patched !== originalText }));
}

// Creates a brand-new dungeon map file (New Dungeon mode's save action)
// AND inserts its import + MAPS registry entry into main.js - the one
// thing the old File System Access "patch a known block" approach could
// never do at all.
async function handleCreateDungeon(req, res) {
  const { mapId, legendRowsText, startX, startY, guardianMonsterId } = await readJsonBody(req);
  const filePath = join(REPO_ROOT, 'js', 'maps', 'superBosses', `${mapId}.js`);
  const fileContent = `${legendRowsText}\n\nexport const ${mapId}Map = {\n  id: '${mapId}',\n  legend: LEGEND,\n  rows: ROWS,\n  startPosition: { x: ${startX}, y: ${startY} },\n  encounterChance: 0,\n  cacheChance: 0,\n  monsterTable: [],\n  guardianMonsterId: '${guardianMonsterId}',\n};\n`;
  await writeFile(filePath, fileContent);

  const mainPath = join(REPO_ROOT, 'js', 'main.js');
  let mainText = await readFile(mainPath, 'utf8');
  const importLine = `import { ${mapId}Map } from './maps/superBosses/${mapId}.js';\n`;
  if (!mainText.includes(importLine)) {
    // Insert right before the `const MAPS = {` declaration, matching this
    // file's existing import ordering (tool dungeons imported just above
    // their own MAPS entries).
    mainText = mainText.replace('const MAPS = {', `${importLine}\nconst MAPS = {`);
    mainText = mainText.replace('const MAPS = {', `const MAPS = {\n  ${mapId}: ${mapId}Map,`);
    await writeFile(mainPath, mainText);
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ created: true }));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/patch-wilderness') return await handlePatchWilderness(req, res);
    if (req.method === 'POST' && req.url === '/api/patch-superboss') return await handlePatchSuperBoss(req, res);
    if (req.method === 'POST' && req.url === '/api/create-dungeon') return await handleCreateDungeon(req, res);
    return await serveStatic(req, res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Terrain painter authoring server running at http://localhost:${PORT}/`);
});
```

- [ ] **Step 3: Point the painter's browser code at these endpoints**

In `painter.js`, add a feature-detect: if `fetch('/api/patch-wilderness',
{ method: 'OPTIONS' })` succeeds (server is present), use `fetch()` calls
to the three endpoints above for "Export All"/"New Dungeon save" instead
of the existing `showDirectoryPicker()`/`writeFileText()` path; otherwise
fall back to the existing File System Access flow unchanged (so Firefox/
Safari users who haven't switched to the new server yet keep working
exactly as before).

- [ ] **Step 4: Manual verification**

```bash
node tools/terrain-painter/server.js
```
Open `http://localhost:8000/`, place a superboss marker (Task 11), click
"Export All Changed to Files", confirm `js/data/superBosses.js` on disk
actually updated with the new position. Create a new dungeon (Task 12),
save it, confirm both the new file under `js/maps/superBosses/` and the
new import+registry line in `js/main.js` appear on disk correctly. Run
`node --test tests/*.js` afterward to confirm the newly-written files
don't break anything structurally.

- [ ] **Step 5: Commit**

Update `tools/terrain-painter/README.md`'s "Run it" section to lead with
`node tools/terrain-painter/server.js` (keep the `python3 -m http.server`
instructions as a documented fallback for browsers without the new
endpoints, per the Hybrid framing above), and update its "Known gaps"
section to remove the now-solved "repo folder permission isn't remembered
across reloads" and "bulk export... not the currently-open dungeon
interior map" gaps for users on the new server.

Add to `CHANGELOG.md` `## [Unreleased]`:
```markdown
### Added
- `tools/terrain-painter/server.js` - a small Node dev server (built-in
  `http`/`fs` only, no new dependency) that serves the painter and
  writes changes straight to disk, including creating brand-new dungeon
  files and registering them in `main.js`. Works in any browser, not
  just Chrome/Edge. The old File System Access flow remains as a
  fallback.
```

```bash
git add tools/terrain-painter/server.js tools/terrain-painter/painter.js tools/terrain-painter/README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat(tools): add Node authoring server for the terrain painter

Ports the existing LEGEND/ROWS/position patch logic server-side (same
pure string transforms, just fs.readFile/writeFile instead of the File
System Access API) and adds a create-dungeon endpoint that writes a new
map file plus its main.js import+registry entry - the one thing the old
approach couldn't do. Works in any browser; the old flow stays as a
fallback for anyone not running the new server.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

---

## Phase 6: Worked example

### Task 14: Author, tune, and place one real superboss end-to-end

**Files:**
- Modify: `js/data/monsters.js` (append the real superboss entry)
- Modify: `js/data/superBosses.js` (replace the empty registry with one real entry)
- Create: `js/maps/superBosses/<mapId>.js` (only if Timothy chooses `hasDungeon: true` for this one — otherwise skip, it stays an open-wilderness `superBossMarker`)
- Modify: `js/main.js` (MAPS registry entry, only if a dungeon file was created)
- Modify: `CHANGELOG.md` (bump `Unreleased` into a real dated version, per this repo's versioning checklist)
- Modify: `js/data/playerChangelog.js` (matching entry)
- Test: extend `tests/superBosses.test.js` and `tests/toolDungeonMaps.test.js`-style structural checks if a new dungeon file was created

**Interfaces:**
- Consumes: every earlier task in this plan.
- Produces: nothing further consumes this — it's the terminal deliverable.

- [ ] **Step 1: Write the candidate monster entry**

In `js/data/monsters.js`, append (using `superBossOne` as a placeholder
codename — a mechanical identifier only, not a creative name; rename
freely before this ships):

```js
  // Super-boss pass worked example - see
  // docs/superpowers/specs/2026-09-05-superboss-pass-design.md. Starting
  // candidate stat block, NOT final - tune via scripts/simulate-balance.js
  // per that spec's Balance tuning section (target ~15-30% average HP
  // remaining, heavy potion use, real non-trivial loss rate for a
  // fully-decked build, well below even the guardian pass's 48-53%
  // comfort band, given the simulator's known zero-reaction-latency
  // optimism).
  superBossOne: {
    id: 'superBossOne', name: 'Super Boss One [PLACEHOLDER NAME]', emoji: '💀',
    hp: 3200, attack: 70, defense: 30, speed: 14,
    xp: 500, goldRange: [150, 220],
    dropTable: [{ itemId: 'ferocityFang', chance: 1, tier: 'apex' }],
    isSuperBoss: true,
    forceFullBattle: true,
    specialAttacks: [
      { type: 'stun', chancePerTurn: 0.25, durationMs: 1200 },
      { type: 'slow', chancePerTurn: 0.25, slowPercent: 25, durationMs: 4000 },
      { type: 'cooldownOverload', chancePerTurn: 0.2, gcdMs: 6000 },
    ],
    attackStyle: 'melee',
  },
```

- [ ] **Step 2: Run the balance simulator and iterate**

```bash
node scripts/simulate-balance.js --set superBossOne.hp=3200 --set superBossOne.attack=70 --set superBossOne.defense=30 --set superBossOne.speed=14 --trials 2000
```

Read the report's win-rate/HP-remaining output for the maxed-gear build.
Per the spec's target: adjust `hp`/`attack`/`defense` (re-run after each
change) until the fully-decked build's average HP-remaining lands
roughly in the 15-30% band with a real non-trivial loss rate, and an
under-geared build (re-run with `--set` overrides simulating a starter-
gear build, matching the guardian pass's own comparison approach) loses
outright. Update the real numbers in `js/data/monsters.js` to whatever
this converges on — do not leave the untuned starting candidate above as
final.

- [ ] **Step 3: Decide placement shape and update `superBosses.js`**

Decide (Timothy's call, per the spec) whether `superBossOne` is
open-wilderness or gets its own dungeon. Update
`js/data/superBosses.js`:

```js
export const SUPER_BOSSES = {
  superBossOne: {
    id: 'superBossOne', monsterId: 'superBossOne',
    screenId: null, x: null, y: null,
    hasDungeon: false, // or true, Timothy's call
    dungeonMapId: null, // or 'superBossOneDungeon' if hasDungeon
  },
};
```

If `hasDungeon: true`, create `js/maps/superBosses/superBossOneDungeon.js`
following the exact `axeDungeonMap` shape from Task 12's authoring-server
template (`LEGEND`, `ROWS`, `startPosition`, `encounterChance: 0`,
`cacheChance: 0`, `monsterTable: []`, `guardianMonsterId: 'superBossOne'`),
either hand-written now or authored via Task 12's painter mode, and
register it in `js/main.js`'s `MAPS` object (either by hand or via Task
13's create-dungeon endpoint).

- [ ] **Step 4: Extend structural tests**

Extend `tests/superBosses.test.js`'s shape-check test (Task 1) — it
already iterates `Object.values(SUPER_BOSSES)` generically, so it needs
no changes to cover the new real entry, just confirm it now exercises a
non-empty registry:

```bash
node --test tests/superBosses.test.js
```
Expected: PASS, now actually checking `superBossOne`'s shape (previously
vacuous against the empty registry).

If a dungeon file was created, add it to `tests/toolDungeonMaps.test.js`'s
style of checks in a new small block (or extend that file directly if its
`TOOL_DUNGEONS`-keyed structure can accommodate a non-tool dungeon
cleanly — otherwise add a short parallel test in
`tests/superBosses.test.js` reusing that file's `assertValidMap`/
`assertFullyReachable`-equivalent logic, ported since `toolDungeonMaps.test.js`
doesn't export those helpers).

- [ ] **Step 5: Place it in the wilderness**

```bash
node tools/terrain-painter/server.js
```
Use the "Place Super-Boss Marker" mode (Task 11) to set a real
`screenId`/`x`/`y` for `superBossOne`, matching the `hasDungeon` choice
from Step 3. Export, confirming `js/data/superBosses.js` updates on disk.

- [ ] **Step 6: Full verification**

```bash
node --test tests/*.js
```
Expected: all PASS.

Start the real game (`python3 -m http.server 8000` from the repo root,
per this project's own dev workflow) and manually walk to the placed
superboss, confirm the encounter triggers, fight it, confirm special
attacks telegraph and parry correctly negates them, confirm the
guaranteed `apex`-tier drop lands on a win.

- [ ] **Step 7: Version bump and commit**

Per this repo's own versioning checklist: bump `CHANGELOG.md`'s
`Unreleased` section into a new dated MINOR version (this is a completed
feature/build), e.g.:

```markdown
## [Unreleased]

## [0.26.0] - <today's date>

### Added
- The first hand-placed super-boss: [name Timothy gives it], a
  3000+ HP optional encounter requiring full best-in-slot gear and real
  parry play. Drops a guaranteed Apex-tier item. Placed via
  `tools/terrain-painter/`'s new authoring workflow. First of ~10
  planned - the remaining ones are future content using the same
  system. See `docs/superpowers/specs/2026-09-05-superboss-pass-design.md`.
```

(Fold in every `### Added`/`### Changed` entry accumulated across Tasks
1-13's own `## [Unreleased]` additions into this same dated section,
consolidating rather than leaving them scattered across many small
`Unreleased` bullets — matches how prior version bumps in this file's
own history read.)

Add the matching `js/data/playerChangelog.js` entry (newest-first, per
that file's own convention):

```js
export const PLAYER_CHANGELOG = [
  {
    version: '0.26.0',
    date: '<today's date>',
    highlights: [
      'New: the first hand-placed super-boss encounter - a genuinely brutal optional fight for players with the best gear and every potion, dropping loot better than anything else in the game.',
    ],
  },
  // ...existing entries unchanged
];
```

```bash
node --test tests/*.js
```
Expected: all PASS (`tests/versionSync.test.js` confirms `CHANGELOG.md`'s
newest version matches `PLAYER_CHANGELOG[0].version`).

```bash
git add js/data/monsters.js js/data/superBosses.js js/main.js CHANGELOG.md js/data/playerChangelog.js tests/superBosses.test.js
# (add js/maps/superBosses/*.js too if a dungeon file was created)
git commit -m "$(cat <<'EOF'
feat: place the first super-boss, completing the super-boss pass (0.26.0)

Worked example for the system built across this plan's earlier tasks -
a 3000+ HP guaranteed-Apex-drop encounter, tuned via
scripts/simulate-balance.js and placed via tools/terrain-painter/'s new
authoring workflow. First of ~10 planned; the rest are future content
using this same system.

Claude-Session: https://claude.ai/code/session_01WHMRRxn5Np2fucGu1HzvQG
EOF
)"
```

**Do not push without explicit approval** — per this project's own
`CLAUDE.md`, a push to `main` deploys immediately, and per this session's
own standing instructions, pushes need Timothy's go-ahead each time.
