# Super-Boss Pass + Map-Editor Dungeon Authoring — Design

## Purpose

"There is not much interesting in the world to try and fight besides the
regular game" (Timothy, raised 2026-09-05 — see `docs/superpowers/BACKLOG.md`'s
"Special/super-boss pass" entry). Today's hardest repeatable fight is the
dragon at 600 HP; even a fully-decked NG+ build clears it comfortably. This
build adds the *system* for hand-placed, optional super-bosses — each a
3000+ HP wall that requires full best-in-slot gear, every potion, and real
ability/parry play to beat — plus the map-editor tooling to let Timothy
place and author them himself, one at a time, the same way the four
tool-dungeon guardians were placed incrementally.

This is **not** a request to design and ship all ~10 bosses now. It builds
the reusable content type (data model, tile kinds, combat/loot plumbing,
one new boss-attack mechanic) and the authoring tooling (map editor +
dungeon-from-scratch drawing + a local write server), validated against
**one fully worked example superboss** end to end. The other ~9 are future
content Timothy authors with the shipped tool, not part of this pass.

## Scope

In scope:
- A new `js/data/superBosses.js` registry + two new tile kinds for
  placing a superboss in the open wilderness or behind its own dungeon
  entrance.
- A new monster flag (`isSuperBoss`) and reuse of the existing
  `forceFullBattle` gate (no-surrender-skip, excluded from the
  toughness-weighted loot roll) — deliberately **not** `isBoss` (that flag
  is reserved for the one real dragon fight and its `dungeonBossDefeated`/
  NG+-unlock side effect).
- A new boss-attack mechanic: superbosses can telegraph a **special
  attack** (slow / stun / cooldown-overload) through the existing parry
  wind-up, instead of every attack being a plain hit. A successful parry
  negates it exactly like it negates damage today; a missed parry lets it
  land.
- Itemization: one new top-tier item-quality band above Mythic, a small
  pool (3-5) of new unique-effect items, and a `dropTable` entry can now
  carry an explicit `tier` (for guaranteed, non-random top-tier drops —
  guardians/bosses never go through the random toughness roll today).
- A separate, small itemization change requested in the same session:
  reworking `rollQualityTier`'s Mythic band so it's no longer flatly 0%
  before NG+1, and scales up per NG+ cycle instead of flatlining at the
  NG+1 numbers forever.
- Map-editor additions: a "Place Super-Boss Marker" mode and a "New
  Dungeon" (blank-canvas authoring) mode.
- A small local Node dev server for the editor, replacing
  `python3 -m http.server`, so saving works in any browser without the
  File System Access permission dance.
- One worked example: a single real superboss, its stat block (via the
  existing Monte-Carlo simulator methodology), and — Timothy's call at
  authoring time — either an open-wilderness placement or its own small
  dungeon, whichever exercises more of the new tooling.

Out of scope (deliberately, tracked in `BACKLOG.md` if relevant):
- Authoring the other ~9 superbosses, their stat blocks, or their loot
  assignments. The system supports any number; only one ships designed.
- Distance-from-town wilderness difficulty rings (separate, already-agreed
  design, unbuilt — may eventually interact with where bosses sit, not
  needed for this pass).
- The dragon's own repeatable-rematch tier-escalation system
  (`js/systems/bossTiers.js`). Superbosses are simpler: always there,
  always the same strength (modulo standard NG+ scaling), refightable with
  a guaranteed drop every time — no escalating-tier state to track.
- The three ring/charm ideas raised right after this spec was approved (no
  random encounters / harder monsters / better loot odds) — logged in
  `BACKLOG.md`, explicitly a separate future session.
- Any change to `js/systems/bossTiers.js`, the NG+ tool-carryover reset, or
  the economy/itemization threads shelved 2026-08-31/2026-09-04 (NG+-scaled
  store gear, per-NG+-level gear scaling, materials-as-clutter). Not
  reopened by this pass.

## Data model

### `js/data/superBosses.js`

Parallel in spirit to `js/data/toolDungeons.js`'s `TOOL_DUNGEON_ENTRANCES`,
but a superboss's entry describes either an open-wilderness encounter or a
dungeon entrance, not always the latter:

```js
export const SUPER_BOSSES = {
  <id>: {
    id: '<id>',
    monsterId: '<id in MONSTERS>',
    screenId: '<wilderness screen>',
    x, y,                      // placed via the terrain painter
    hasDungeon: boolean,
    dungeonMapId: '<MAPS key>' | null,   // set iff hasDungeon
  },
};
```

Same placeholder-until-placed convention as `TOOL_DUNGEON_ENTRANCES.portal`:
a fresh entry starts with `screenId: null`, inert (never matches a real
screen) until Timothy places it with the painter.

### Two placement shapes

**Open-wilderness** (`hasDungeon: false`): a new `superBossMarker` tile
(walkable, `action: 'superBossBattle'`) sits directly on a wilderness
screen at `(screenId, x, y)`. Stepping on it looks up the matching
`SUPER_BOSSES` entry by position (same shape as `mapScreen.js`'s existing
`TOOL_DUNGEON_ENTRANCES` position loop, ~line 253) and calls
`handleEncounter([monsterId])` directly — no dungeon map involved at all.

**Own dungeon** (`hasDungeon: true`): a new `superBossEntrance` tile
(parallel to `axeDungeonEntrance`/`pickDungeonEntrance`/etc., own
`action: 'enterSuperBossDungeon'`) sits in the wilderness and leads into a
brand-new map file under `js/maps/superBosses/<id>.js`, registered in
`main.js`'s `MAPS` object same as every other dungeon. Inside, the boss
sits on the existing dungeon-guardian tile pattern (`G` in the map's own
`LEGEND`, `guardianMonsterId` field) — **this half needs no new combat
code**, it's the exact tool-dungeon-guardian mechanism already shipped,
just pointed at a new monster.

Both tile kinds need the same handful of touch-points every existing
entrance tile already has: an entry in `js/tiles.js`, `mapScreen.js`'s
`FULL_SQUARE_MARKERS` and `GRASS_CONTEXT_MARKERS` sets, and a case in the
tile-resolution function (~line 253) for `superBossMarker`/
`superBossEntrance` alongside the existing tool-entrance loop.

## Monster/combat semantics

New `js/data/monsters.js` fields for a superboss entry:

```js
someSuperBoss: {
  id, name, emoji, hp, attack, defense, speed, xp, goldRange,
  dropTable: [{ itemId: '<guaranteed drop>', chance: 1, tier: '<new tier or omit>' }],
  isSuperBoss: true,
  forceFullBattle: true,   // reused as-is — see below
  specialAttacks: [ /* optional, see next section */ ],
  attackStyle, projectileEmoji, flavorLines,
},
```

Reusing `forceFullBattle: true` (already used by the four tool guardians)
gets three behaviors for free, with zero new gating code:
- `isToughnessEligible` already returns `false` for `forceFullBattle`
  monsters, so a superboss's guaranteed drop never collides with a random
  toughness-rolled tier — same as guardians today.
- `handleEncounter`'s pre-fight surrender/flee auto-roll is already
  skipped for `forceFullBattle` monsters (a "fled empty-handed" outcome
  would break a guaranteed drop).
- It does **not** set `isBoss`, so — per the flee-rule decision — the
  Escape/flee button still works mid-battle (only `battleScreen.js`'s
  `monsterIds.some((id) => MONSTERS[id].isBoss)` check blocks fleeing),
  and `state.flags.dungeonBossDefeated` (NG+ eligibility) is never
  falsely set. Same reasoning `axeGuardian`'s own comment in
  `monsters.js` already documents for guardians.

`isSuperBoss: true` is added purely for future hooks (a distinct victory
flavor/celebration, log-event tagging, a possible future "superbosses
defeated" counter) — not required by any gating logic above, which all
keys off `forceFullBattle`.

**NG+ scaling requires no new code.** `handleEncounter` already computes
`getNgPlusCombatOverrides(monster, state.ngPlusCycle)` unconditionally for
every monster in the encounter, superbosses included — they scale across
NG+ cycles exactly like every other monster in the game, for free.

**Repeatability**: no "defeated" flag, no escalating-tier state. A
superboss is always there, always the same strength (modulo standard NG+
scaling), and drops its guaranteed item on every win — same model as the
tool guardians, deliberately simpler than the dragon's
`bossTiers.js` rematch-escalation system (out of scope above).

## Boss special attacks

New system so a superboss's turn isn't always a plain hit. Reuses the
parry wind-up UI verbatim (`js/systems/parry.js`'s
`createWindupState`/`startWindup`/`isWindupComplete`/
`resolveParryAttempt`) — no new UI, just a distinct flavor line/icon so
the player can tell a special is incoming.

```js
specialAttacks: [
  { type: 'slow', chancePerTurn: <TBD>, slowPercent: <TBD>, durationMs: <TBD> },
  { type: 'stun', chancePerTurn: <TBD>, durationMs: <TBD> },
  { type: 'cooldownOverload', chancePerTurn: <TBD>, gcdMs: <TBD> },
],
```

On the monster's turn, `battleScreen.js`'s monster-attack resolution rolls
against `chancePerTurn` for each defined special (mutually exclusive, one
roll order) before falling back to a plain `resolveMonsterAttack`. Whichever
fires still goes through the same wind-up/parry-window flow already in
place:

- **Parry succeeds**: identical to today (50% damage reflected via
  `resolveParrySuccess`), *and* the special effect is fully negated —
  parry timing is what makes a special attack survivable, not damage
  mitigation.
- **Parry fails/missed**: normal damage lands *and* the special effect
  applies.

Three effect types, each following the existing `create*/tick*/apply*`
timed-debuff shape `abilities.js` already uses for its defense-shred
debuff (`createDefenseDebuff`/`tickDefenseDebuff`/`applyDefenseDebuff`):

- **Slow** — new `createPlayerSlowDebuff`/`tickPlayerSlowDebuff`/
  `applyPlayerSlowDebuff` in `combat.js`, mirroring the exact math
  `applyEnemySlow` already uses for Frost Charm (today: player slows the
  monster; this is the same formula pointed the other way). While active,
  it reduces the player's effective speed fed into
  `abilityGcdMsForSpeed`, lengthening the ability GCD.
- **Stun/Freeze** — new debuff of the same shape, blocks the
  Attack/ability/item action guards (alongside the existing
  `battleOver`/`battlePaused` checks in `battleScreen.js`) for a short
  fixed real-time window (~1-1.5s, TBD). Flee is deliberately **not**
  blocked — consistent with the flee-rule decision above; this punishes a
  missed parry, it isn't meant to trap the player.
- **Cooldown Overload** — one-shot, no persistent state: calls
  `abilities.js`'s existing `applyAbilityGcd(cooldowns, unlockedAbilities,
  null, gcdMs, totals)` with `usedAbilityId: null` (so no per-ability
  override floor applies) — the exact mechanism Attack-spam already uses
  to throttle itself, just boss-inflicted instead of self-inflicted.

`scripts/simulate-balance.js`'s `chooseAction()` policy stand-in will need
a matching update once these ship, per that file's own "KEEP THIS IN SYNC"
header — it currently has no concept of a monster special attack or a
telegraphed parry-or-suffer choice.

## Itemization

### New top tier

`js/systems/itemQuality.js`'s `QUALITY_TIER_MULTIPLIERS` gets one new key
above `mythic` — placeholder name/value pending Timothy's own naming and
simulator tuning:

```js
export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20, mythic: 1.5, apex: 1.9 /* PLACEHOLDER name+value */ };
```

Since a superboss's guaranteed drop bypasses the random toughness roll
entirely (`forceFullBattle` → `isToughnessEligible` false), `loot.js`'s
`rollDrop` needs a small addition: a `dropTable` entry may now carry an
explicit `tier` field, applied directly instead of rolled:

```js
// in rollDrop(), the monster.dropTable branch:
if (item && entry.tier) tier = entry.tier;
```

This is the only way to make a guaranteed drop deterministically the new
top tier — today only `rollQualityTier` (random) and the flat
`BOSS_MYTHIC_CHANCE` (dragon-only) ever set `tier`.

### New unique-effect items (3-5, small extensible pool)

Same shape as `emberRing`/`windfuryRing` in `items.js` — pure data, no new
combat-engine changes needed for stat-field reuse (`getEquipmentBonuses`
already sums whatever fields are present). Proposed split, names/flavor
all placeholders for Timothy to write:

- 1-2 items that **counter the new boss-special-attack system** directly —
  genuinely new stat fields, thematically tied to "beating a superboss
  takes real parry play": e.g. a `parryWindowBonusPercent` field widening
  `PARRY_ZONE_START_PERCENT` for its wearer, or a `debuffDurationPercent`
  field shortening the new slow/stun debuffs' `durationMs`. Small, bounded
  wiring into `parry.js`/the new debuff `apply*` functions.
- 1-2 items reusing today's existing effect vocabulary (`lifestealPercent`,
  `critChancePercent`, `extraSwingChance`, `elementalProcChance`/`Damage`,
  `thornsPercent`) at a new ceiling magnitude above what
  `emberRing`/`windfuryRing` currently offer — simplest, zero new wiring.

Any of these — or a plain `apex`-tier copy of existing gear — can be
assigned to any superboss's `dropTable`; the pool is shared, not one
bespoke item per boss (per the "extensible pool" scope decision), and
grows over time as more superbosses get authored.

### Mythic drop-rate rework (separate ask, same files)

`itemQuality.js`'s `rollQualityTier` currently gives Mythic a hard binary:
flatly 0% before NG+1, then a flat `lerp(0.005, 0.02, toughness)` band
forever after, never scaling further. Reworked to:

```js
export const PRE_NG_PLUS_MYTHIC_CHANCE_MIN = 0.001; // PLACEHOLDER - "very small"
export const PRE_NG_PLUS_MYTHIC_CHANCE_MAX = 0.004; // PLACEHOLDER
export const MYTHIC_TIER_CHANCE_MIN = 0.005; // unchanged - now the NG+1 baseline
export const MYTHIC_TIER_CHANCE_MAX = 0.02;  // unchanged
export const MYTHIC_TIER_NG_PLUS_GROWTH = 1.5; // PLACEHOLDER - matches NG_PLUS_DROP_CHANCE_MULTIPLIER's existing style

export function rollQualityTier(toughness, rng = Math.random, ngPlusCycle = 0) {
  const mythicChance = ngPlusCycle >= 1
    ? lerp(MYTHIC_TIER_CHANCE_MIN, MYTHIC_TIER_CHANCE_MAX, toughness) * (MYTHIC_TIER_NG_PLUS_GROWTH ** (ngPlusCycle - 1))
    : lerp(PRE_NG_PLUS_MYTHIC_CHANCE_MIN, PRE_NG_PLUS_MYTHIC_CHANCE_MAX, toughness);
  // ...rest unchanged
}
```

Growth applies starting at NG+2, so NG+1 reproduces today's exact band
unchanged (0.5%→2%) — NG+2 → ×1.5 (0.75%→3%), NG+3 → ×2.25 (1.125%→4.5%),
uncapped, consistent with every other NG+ scaling constant in this file
(`NG_PLUS_DROP_CHANCE_MULTIPLIER`/`NG_PLUS_COMBAT_MULTIPLIER` in
`ngPlus.js`). Pre-NG+ gets a genuinely small but nonzero chance instead of
a flat wall. All four new constants are first-pass placeholders in the
same spirit as the ability-GCD constants that shipped as "a starting
point, not final tuning" — adjust once it's been played, not blocked on
simulator validation (this is drop-rarity *feel*, not combat difficulty,
so the Monte-Carlo/telemetry-reconciliation approach below doesn't apply
to these four numbers specifically).

## Map editor (`tools/terrain-painter/`)

### Place Super-Boss Marker (new mode)

Same UX shape as today's "Place Tool Dungeon Entrance": pick a superboss
id from a dropdown (backed by `SUPER_BOSSES`), click a tile to set its
`screenId`/`x`/`y`, plus a toggle for `hasDungeon` (open-world marker vs.
dungeon-entrance tile). "Copy position" pastes into that superboss's entry
in `superBosses.js`, same as today's tool-dungeon workflow — or, with the
new authoring server below, a direct write.

### New Dungeon (blank-canvas authoring, new mode)

Today's dungeon painting only edits an existing map file's LEGEND/ROWS.
This adds: pick a name + starting size, get a blank canvas using the same
dungeon tile palette as today's dungeon-interior painting (walls/floor/
guardian-tile-equivalent), paint it, then save as a brand-new file under
`js/maps/superBosses/<id>.js` (matching the existing `axeDungeonMap`-style
shape: `LEGEND`, `ROWS`, `startPosition`, `encounterChance: 0`,
`cacheChance: 0`, `monsterTable: []`, `guardianMonsterId`) and register it
in `main.js`'s `MAPS` object — both steps handled by the write server
below, since creating a new file and inserting an import + registry line
in `main.js` is exactly what the current File-System-Access "patch a known
block" approach *can't* do.

### Authoring server (`tools/terrain-painter/server.js`)

New, small, using only Node's built-in `http`/`fs` (no new dependency —
repo already only has `jsdom` as a devDependency for `npm test`).
Replaces `python3 -m http.server` as the run command. Serves the painter's
static files, plus:

- a write endpoint doing what "Export All Changed to Files" does today
  (patch LEGEND/ROWS/position fields in existing files) — same
  patch-a-known-block logic, just running server-side instead of through
  the browser's File System Access API;
- a create endpoint for brand-new dungeon files (superboss dungeons) that
  writes the new file *and* inserts the corresponding import + `MAPS`
  entry into `main.js`.

Net effect: works in any browser (drops the Chrome/Edge-only limitation),
and drops the "re-grant folder access every session" annoyance, since a
local trusted dev server just writes to disk directly. `README.md` gets
updated to describe `node tools/terrain-painter/server.js` as the new run
command, with the File-System-Access flow's known gaps section adjusted
to note it's now handled server-side.

## Balance tuning

No new simulator. Extends `scripts/simulate-balance.js`'s existing
`--set`/`--parry-rate` mechanism to model the worked example's stat block
(and, later, each additional superboss as Timothy authors them) —
following axeGuardian/pickGuardian/boatGuardian/portalGuardian/dragon's own
2026-09-05 retune methodology in `monsters.js`:

1. Build the candidate stat block, run it through the real
   `combat.js`/`abilities.js`/`parry.js` functions via the simulator.
2. Target something well below even that pass's "48-53% HP remaining"
   comfort band for a well-geared build — a first-pass target of roughly
   **15-30% average HP remaining, heavy potion consumption, and a real
   non-trivial loss rate** even for a fully-decked build, given the known
   optimism bias (the simulated player has zero reaction latency and acts
   every tick, unlike a real human who hesitates, misses parry windows,
   and misclicks under pressure).
3. Reconcile against real telemetry once Timothy has actually fought the
   worked example, same as every prior retune in this project.
4. A deliberately under-geared build should lose outright, not scrape by —
   same bar the tool guardians were held to.

The new special-attack system needs `chooseAction()` in
`scripts/simulateAbilityPolicy.js` taught a parry-or-suffer policy for the
worked example before its numbers can be trusted (see the special-attacks
section above) — this is new simulator work, not a reuse of existing
policy code, and should be scoped into the implementation plan explicitly.

## Testing

- `tests/toolDungeonMaps.test.js`'s null-placeholder pattern (an unplaced
  `screenId: null` entry is inert, never reachable, never crashes) extends
  directly to `SUPER_BOSSES` — same invariant, same test shape.
- New unit coverage for: the new `dropTable.tier` override in
  `rollDrop`, the reworked `rollQualityTier` pre-NG+/per-cycle Mythic
  bands, the three new debuff `create*/tick*/apply*` triples, and
  `applyAbilityGcd`'s reuse for cooldown-overload (already covered
  generically, but a superboss-specific call site should get its own
  case).
- `tests/maps.test.js`-style structural checks (LEGEND/ROWS consistency,
  reachability where applicable) extend to any new superboss dungeon file
  the same way they already cover the tool dungeons.
- The map-editor server itself has no existing test pattern to extend
  (`tools/` isn't part of `npm test`'s `tests/*.js` glob, matching the
  painter's own dev-only, never-deployed status) — manual verification
  only, consistent with how the painter has always been validated.

## Sequencing (for the implementation plan)

Roughly, in dependency order:
1. Data model + tile kinds + monster/combat plumbing (`isSuperBoss`,
   reused `forceFullBattle`, `SUPER_BOSSES` registry, two new tile kinds
   and their `mapScreen.js` touch-points) — no new mechanics yet, just the
   generic "a superboss can exist and be fought" skeleton.
2. Itemization plumbing: new tier constant, `dropTable.tier` override in
   `loot.js`, the Mythic drop-rate rework (independent of everything else,
   could ship standalone first).
3. Boss special-attack system: new debuffs, parry-window tie-in,
   `simulateAbilityPolicy.js` update.
4. New unique-effect items (the small pool).
5. Map editor: Super-Boss Marker placement mode, New Dungeon mode, the
   Node authoring server.
6. The one worked example, placed by Timothy, tuned via the simulator,
   reconciled against real play.

Steps 1-4 are backend/data work with existing test patterns to extend;
step 5 is tooling with no automated tests (manual verification only,
consistent with the rest of the painter); step 6 depends on all of the
above and is where Timothy's own design/placement judgment takes over.
