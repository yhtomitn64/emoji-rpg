# Multi-Mob Encounters — Design

## Purpose

Every battle today is strictly one monster. After a player has killed a
given non-boss monster type enough times, that monster type should start
occasionally "bringing friends" — spawning as a group of 2-3 instead of
solo — with a partial-reward option for killing some of the group and
fleeing before finishing the rest. This is the first real multi-monster
battle in the game; `battleScreen.js`'s entire data model is singular
today (one `monsterCombatant`, one HP/ATB bar, no targeting UI at all),
so this build is largely a rework of that file, not a small addition.

## Scope

In scope:
- A new lifetime, never-resetting kill counter per non-boss monster
  type, independent of the existing quest-turn-in tally.
- A chance for a monster type to spawn as a 2-3 member group once its
  lifetime kill count crosses a threshold, applied uniformly everywhere
  the existing random-encounter roll already exists (every wilderness
  screen and the dungeon interior — there is no "zone 1 only" boundary
  in the code today to gate this against).
- `battleScreen.js`'s monster state becomes an array (`monsterCombatants`),
  each entry independent (own ATB gauge, own attack wind-up/parry
  window, own defense-shred debuff, own delayed-hit state) — solo
  encounters are simply a 1-element array, not a separate code path.
- Click, Left/Right arrow, and Tab target selection; Attack and all 5
  abilities act on the selected target.
- The parry key (`s`) stays a **global sweep** — it resolves every
  monster currently sitting in its own parry zone at the moment of the
  press, regardless of which one is selected. Clicking a specific
  monster's own ATB bar stays scoped to just that monster.
- Partial rewards on flee: every monster actually killed before fleeing
  grants full XP/gold/drop/quest-progress credit, exactly as if it had
  been beaten solo; untouched survivors grant nothing.
- Group encounters are never eligible for the existing weak-mob-surrender
  pre-fight roll — they always play out as a real fight.

Out of scope (deliberately):
- Any redesign of the 5 existing abilities themselves (targeting model,
  timing-meter mechanics, combo chains) — a separate backlog item
  ("Ability rotation redesign, raised 2026-08-20"), explicitly kept out
  of this pass. Every ability stays single-target on the current
  selection, using its existing math unchanged.
- AOE/multi-target abilities of any kind.
- The boss fight — already structurally excluded, since the dragon is
  only reached via the dedicated boss-battle tile action, never via the
  `monsterTable` random-encounter roll this feature hooks into.
- A "surviving monster flees on its own" mechanic — raised and explicitly
  ruled out during design; only the player's own Flee action can end a
  fight early.
- Death animations for a killed monster — a separate, already-backlogged
  idea (raised 2026-08-20); this build just removes a dead monster from
  the active row without a special animation.

## Mechanics

### Kill tracking and group-spawn roll

New pure module `js/systems/groupEncounters.js`:

```js
export const GROUP_SPAWN_KILL_THRESHOLD = 10;
export const GROUP_SPAWN_CHANCE = 0.3;
export const GROUP_SIZE_MIN = 2;
export const GROUP_SIZE_MAX = 3;

export function incrementKillCount(killCounts, monsterId) {
  return { ...killCounts, [monsterId]: (killCounts[monsterId] || 0) + 1 };
}

export function rollEncounterGroup(monsterId, killCounts, rng = Math.random) {
  const kills = killCounts[monsterId] || 0;
  if (kills < GROUP_SPAWN_KILL_THRESHOLD || rng() >= GROUP_SPAWN_CHANCE) {
    return [monsterId];
  }
  const size = GROUP_SIZE_MIN + Math.floor(rng() * (GROUP_SIZE_MAX - GROUP_SIZE_MIN + 1));
  return Array(size).fill(monsterId);
}
```

`rollEncounterGroup` is the single entry point the map screen's existing
encounter roll calls after picking a `monsterId` from `monsterTable` —
it either returns that same id back as a 1-element array (no group, the
overwhelming majority of encounters even past the threshold, since
`GROUP_SPAWN_CHANCE` still has to hit) or a 2-3 element array of the
same id repeated. `GROUP_SPAWN_KILL_THRESHOLD`, `GROUP_SPAWN_CHANCE`,
`GROUP_SIZE_MIN/MAX` are all named, exported constants specifically so a
future balance pass is a one-line change — the same pattern already
established for the parry mechanic's tunables.

### Wiring into encounter generation

`js/screens/mapScreen.js`'s `tryMove()` currently ends its encounter
check with:

```js
if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
  const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
  callbacks.onEncounter(monsterId);
}
```

This changes to roll the group on top of the existing monster-type pick:

```js
if (tile.encounter && mapConfig.monsterTable.length > 0 && Math.random() < mapConfig.encounterChance) {
  const monsterId = mapConfig.monsterTable[Math.floor(Math.random() * mapConfig.monsterTable.length)];
  const monsterIds = rollEncounterGroup(monsterId, state.monsterKillCounts);
  callbacks.onEncounter(monsterIds);
}
```

`callbacks.onEncounter` — and every function downstream of it
(`handleEncounter` in `js/main.js`, `battleScreen.mount()`'s props) —
changes from taking a single `monsterId` string to always taking an
array of monster ids. This is a deliberate single-shape choice: rather
than branching between a scalar (solo) and array (group) form
throughout `battleScreen.js`'s rewrite, every encounter is "a list of 1
or more monsters," and solo is simply the 1-element case. The existing
boss-fight path (`startBossFight()` in `main.js`) also updates to pass
`[bossMonsterId]` — a boss fight is always, and will always remain, a
1-element array, since group-eligibility never applies to a boss.

### `state.monsterKillCounts`

New field in `js/state.js`, alongside `questProgress`, same 8 keys
(every non-boss monster id), same zero-initialized shape — but never
reset by any code path, unlike `questProgress` which zeroes out on
quest turn-in:

```js
monsterKillCounts: {
  boar: 0, bat: 0, snake: 0, goblin: 0,
  direWolf: 0, spider: 0, orc: 0, wraith: 0,
},
```

Incremented in `js/main.js`'s `handleBattleEnd`, once per monster id
actually killed (see "Rewards" below), via
`incrementKillCount(state.monsterKillCounts, monsterId)` — called once
per killed monster, not once per battle, so a 3-member group win
increments the same monster id's count by 3 in one battle.

### `battleScreen.js`'s data model

Module-level state changes from a single `monsterCombatant` to an array:

```js
let monsterIds = [];
let monsterCombatants = [];
let selectedMonsterIndex = 0;
```

`buildMonsterCombatant(monsterId, overrides)` (renamed/adjusted from
today's `buildMonsterCombatant()`, which currently closes over the
module-level `monsterId`/`monsterOverrides` directly) becomes explicit
about which monster it's building, and gains the per-monster fields that
today live as separate module-level variables:

```js
function buildMonsterCombatant(monsterId, overrides) {
  const monster = { ...MONSTERS[monsterId], ...(overrides || {}) };
  const enemySlowPercent = getEquipmentBonuses(state).enemySlowPercent;
  const speed = applyEnemySlow(monster.speed, enemySlowPercent);
  return {
    monsterId,
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed,
    atb: 0,
    windup: createWindupState(),
    defenseDebuff: null,
    pendingDelayedHit: null,
  };
}
```

`mount(root, props)` builds one combatant per id in `props.monsterIds`
(an array now, matching the `monsterOverrides` prop which becomes an
array of the same length, or `null` entries where no override applies):

```js
monsterIds = props.monsterIds;
monsterCombatants = monsterIds.map((id, i) => buildMonsterCombatant(id, props.monsterOverrides?.[i]));
selectedMonsterIndex = 0;
```

### Tick loop

`tick()`'s monster-advancing block runs once per **living**
(`hp > 0`) monster instead of once globally:

```js
for (const mc of monsterCombatants) {
  if (mc.hp <= 0) continue;
  mc.atb = tickGauge(mc.atb, mc.speed, 1);
  if (isReady(mc.atb) && !mc.windup.active) {
    mc.windup = startWindup();
  } else if (mc.windup.active) {
    mc.windup = tickWindup(mc.windup, 300);
    if (isWindupComplete(mc.windup)) {
      resolveMonsterWindup(mc, false);
    }
  }
  mc.defenseDebuff = tickDefenseDebuff(mc.defenseDebuff, 300);
  if (mc.pendingDelayedHit) {
    mc.pendingDelayedHit.dueAtMs -= 300;
    if (mc.pendingDelayedHit.dueAtMs <= 0) {
      const amount = mc.pendingDelayedHit.amount;
      mc.pendingDelayedHit = null;
      mc.hp = Math.max(0, mc.hp - amount);
      mc.atb = applyKnockback(mc.atb, ATB_KNOCKBACK);
      log.push(`Slash's bleed hits ${mc.name} for ${amount}!`);
      updateHpBars();
      updateAtbBars();
      updateLog();
      playHitEffect(zoneElFor(mc), emojiElFor(mc), amount, false);
      checkOutcome();
      if (battleOver) return;
    }
  }
}
```

(`zoneElFor(mc)`/`emojiElFor(mc)` resolve to `elements.monsterZones[monsterCombatants.indexOf(mc)]`/
`elements.monsterEmojis[monsterCombatants.indexOf(mc)]` — `buildDom()`
builds one zone/emoji DOM element per entry in `monsterCombatants` at
mount time and stores them as parallel arrays on `elements`, the same
way `elements.monsterZone`/`elements.monsterEmoji` are single element
references today. The plan may choose a cleaner lookup than
`indexOf` — e.g. storing the DOM element directly on each combatant
object instead of a separate parallel array — but the behavior is
fixed here: one independent tick-block per living monster, each able to
resolve its own zone/emoji element for hit effects.)

### `resolveMonsterWindup` becomes per-monster, parry stays global

`resolveMonsterWindup(monster, parried)` takes an explicit monster
reference now (today it closes over the single module-level
`monsterCombatant`):

```js
function resolveMonsterWindup(monster, parried) {
  if (battleOver) return;
  if (!monster.windup.active) return;
  const elapsedPercent = windupElapsedPercent(monster.windup);
  monster.windup = createWindupState();
  if (parried && resolveParryAttempt(elapsedPercent)) {
    const { damage, isCrit } = rollIncomingDamage(monster, playerCombatant);
    const result = resolveParrySuccess(monster, damage);
    monster.hp = result.monsterHp;
    monster.atb = result.monsterAtb;
    log.push(`You parry ${monster.name}'s attack and strike back for ${result.reflectedDamage}!`);
    updateHpBars();
    updateLog();
    playHitEffect(zoneElFor(monster), emojiElFor(monster), result.reflectedDamage, false);
    checkOutcome();
  } else {
    monsterAttack(monster);
  }
  updateAtbBars();
  updateMenu();
}
```

The `s`/`S` keydown branch changes from "resolve the one active windup"
to a **sweep across every monster currently in its parry zone**:

```js
if (key === 's' || key === 'S') {
  for (const mc of monsterCombatants) {
    if (mc.hp > 0 && mc.windup.active && resolveParryAttempt(windupElapsedPercent(mc.windup))) {
      resolveMonsterWindup(mc, true);
    }
  }
  return;
}
```

A monster whose wind-up is active but **not yet** inside its parry zone
is left alone by this sweep — pressing `s` early doesn't touch it, same
single-monster semantics as today, just evaluated against every living
monster instead of one. Clicking a specific monster's own ATB-bar
element stays a single-monster call: `resolveMonsterWindup(thatMonster, true)`,
regardless of whether it's currently in-zone (exactly today's
click-to-attempt behavior, scoped to the clicked monster only).

### Targeting

`selectedMonsterIndex` drives which monster Attack and every ability act
on. Clicking a monster's zone sets it directly. Left/Right arrow keys
and Tab cycle it, skipping dead monsters:

```js
function livingIndices() {
  return monsterCombatants.map((mc, i) => i).filter((i) => monsterCombatants[i].hp > 0);
}

function cycleTarget(direction) {
  const living = livingIndices();
  if (living.length === 0) return;
  const currentPos = living.indexOf(selectedMonsterIndex);
  const nextPos = currentPos === -1
    ? 0
    : (currentPos + direction + living.length) % living.length;
  selectedMonsterIndex = living[nextPos];
  render();
}
```

If the currently-selected monster dies, the next `render()` (already
called after every state-changing action) needs `selectedMonsterIndex`
to land on a living monster — `cycleTarget`'s `currentPos === -1` branch
handles this by re-anchoring to the first living monster whenever the
previously-selected index is no longer in `livingIndices()`.

`playerAttack()` and `playerUseAbility()` change their target argument
from the single `monsterCombatant` to `monsterCombatants[selectedMonsterIndex]`
— every other line in both functions (damage application, log message,
`checkOutcome()`) stays the same shape, just reading/writing through
that one array element instead of the module-level singular variable.

### Win/loss condition

`checkOutcome()` changes from "the one monster's hp is 0" to "every
monster's hp is 0":

```js
function checkOutcome() {
  if (monsterCombatants.every((mc) => mc.hp <= 0)) {
    endBattle('won');
  } else if (playerCombatant.hp <= 0) {
    endBattle('lost');
  }
}
```

A solo encounter (1-element array) behaves identically to today, since
`every()` over a single element is the same check as before.

### Rendering: dead monsters drop out of the row

A monster whose `hp <= 0` is filtered out of the rendered row entirely
(no animation for this pass — see "Out of scope" above) — the remaining
living monsters re-flow to fill the space, matching the "B" layout
approved during design (selected target scaled up, others dimmed;
removing a dead one just shrinks the row by one).

### Rewards and flee

`endBattle(outcome)` reports which monster ids were actually killed by
the time the battle ended, not a single id:

```js
function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  const killedMonsterIds = monsterCombatants.filter((mc) => mc.hp <= 0).map((mc) => mc.monsterId);
  if (outcome === 'lost') {
    playReviveEffect(elements.heroZone, elements.heroEmoji);
  }
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, killedMonsterIds);
  }, VICTORY_PAUSE_MS);
}
```

For a `'won'` outcome, `killedMonsterIds` is necessarily every monster in
the fight (that's what winning means). For `'fled'`, it's whichever
monsters had already been killed before the Flee action fired — empty
for the exact scenario that always resolves to zero reward today (flee
before killing anything).

`js/main.js`'s `handleBattleEnd(outcome, killedMonsterIds)` changes its
`'won'`/`'surrender'` and `'fled'` branches to loop over
`killedMonsterIds` instead of looking up a single `monsterId`. Each
killed monster gets **full** treatment — XP, gold, drop-table roll, and
quest-progress increment — exactly as if it had been beaten solo; this
was an explicit design decision (confirmed directly: "if fighting two
mobs and you kill 1 then other flees, you still get full stuff for 1 and
nothing for the other") and is a real step beyond the existing
`fled-with-loot` outcome (which grants gold/item only, no XP, no quest
credit) — that outcome is unrelated and untouched by this build, since
groups are never eligible for the weak-mob-surrender roll that produces
it (see below).

```js
} else if (outcome === 'won' || outcome === 'surrender') {
  // existing first-kill-celebration and lossStreak-reset logic stays a
  // single per-battle check (not per monster), unchanged in shape - it
  // only ever needs to fire once regardless of how many monsters died.
  // Boss-tier progression below DOES change shape, from a singular
  // monster.isBoss check to an array-aware one - see the comment there.
  for (const monsterId of killedMonsterIds) {
    const monster = MONSTERS[monsterId];
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const baseXp = resolveBattleXp(bossTierXp, monster);
    const xp = Math.round(baseXp * rewardMultiplier.xp);
    const { player, leveledUp } = applyXp(state.player, xp);
    state.player = player;
    if (leveledUp) { /* existing level-up handling, unchanged */ }
    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) grantDropItem(drop.item);
    Object.assign(state, incrementQuestProgress(state, monsterId));
    Object.assign(state, { monsterKillCounts: incrementKillCount(state.monsterKillCounts, monsterId) });
  }
  if (killedMonsterIds.some((id) => MONSTERS[id].isBoss)) {
    // Necessarily array-aware now (was a singular `monster.isBoss` check) since
    // every reward path flows through killedMonsterIds. Behaviorally equivalent
    // to today for the solo boss-fight path, whose killedMonsterIds is always
    // the same 1-element array as its old singular monsterId - unreachable for
    // a real group, since bosses never appear in monsterTable-rolled encounters.
    state.flags.dungeonBossDefeated = true;
    if (bossTierAttempt !== null) {
      state.bossTier = resolveBossTierAfterWin(state.bossTier, bossTierAttempt);
    }
  }
  state.lossStreak = 0;
  persist();
  renderHud();
} else if (outcome === 'fled') {
  // killedMonsterIds may be non-empty now (partial group kills before fleeing) -
  // same per-monster reward loop as the won/surrender branch above, minus the
  // battle-level lossStreak reset and boss-tier/first-kill handling, which only
  // make sense for a genuine win
  for (const monsterId of killedMonsterIds) {
    // identical per-monster XP/gold/drop/quest/kill-count block as above
  }
  persist();
  renderHud();
}
```

`formatBattleOutcomeMessage` (used for the post-battle flavor banner,
currently reads `MONSTERS[monsterId].name` for a single monster) needs a
group-aware variant — this spec doesn't prescribe exact banner wording
for "you fought 3 boars," since that's copy, not mechanics; the
implementer picks something serviceable (e.g. naming the group's
monster type once, not each individual) and flags it for a follow-up
polish pass if the wording matters more than function-shipping-correctly
right now.

### Weak-mob-surrender exclusion for groups

`mount()`'s existing pre-fight check —

```js
const weakMobOutcome = resolveWeakMobEncounter(playerCombatant, monsterCombatant, Boolean(MONSTERS[monsterId].isBoss));
```

— only runs when `monsterIds.length === 1`. A group encounter (length
2-3) skips this check entirely and always proceeds into the normal
battle loop, per the explicit design decision that crossing the
group-spawn threshold means that monster type is no longer trivial for
this player.

## Data model

- `state.monsterKillCounts: { [monsterId]: number }` — new field, same 8
  keys as `questProgress`, all zero-initialized, incremented once per
  killed monster on `'won'`/`'surrender'`/`'fled'` (for whichever
  monsters were actually killed), never reset by any code path.
- `battleScreen.js`'s `monsterCombatants: Array<{ monsterId, name,
  emoji, hp, maxHp, attack, defense, speed, atb, windup, defenseDebuff,
  pendingDelayedHit }>` — replaces the singular `monsterCombatant`;
  length is always ≥ 1, and 1 for every encounter that isn't a rolled
  group.
- `battleScreen.mount()`'s props: `monsterIds: string[]` (was
  `monsterId: string`), `monsterOverrides: (object|null)[]` (was a
  single object or `null`) — same length as `monsterIds`.
- `callbacks.onBattleEnd(outcome, killedMonsterIds)` — second argument
  changes from a single `monsterId` to an array (possibly empty).

## Wiring changes

- **New:** `js/systems/groupEncounters.js` — pure,
  `GROUP_SPAWN_KILL_THRESHOLD`, `GROUP_SPAWN_CHANCE`, `GROUP_SIZE_MIN`,
  `GROUP_SIZE_MAX`, `incrementKillCount(killCounts, monsterId)`,
  `rollEncounterGroup(monsterId, killCounts, rng)`.
- **Modify:** `js/state.js` — new `monsterKillCounts` field in
  `createNewGame`'s returned object.
- **Modify:** `js/main.js` — backfill `monsterKillCounts` for legacy
  saves in `startGame()` (same pattern as the existing
  `dungeonEntrancePosition`/`gateRewards`/`lossStreak` backfills);
  `handleEncounter`/`handleBattleEnd` signatures change from a single
  `monsterId` to arrays as described above; `startBossFight()` passes
  `[bossMonsterId]`.
- **Modify:** `js/screens/mapScreen.js` — `tryMove()`'s encounter block
  calls `rollEncounterGroup` and passes an array to `onEncounter`.
- **Modify:** `js/screens/battleScreen.js` — the majority of this file's
  internals, per "battle-screen architecture" above: module state
  becomes array-shaped, `tick()`/`resolveMonsterWindup`/targeting/
  rendering/`endBattle` all change as described. This is the largest
  single-file change in the plan this spec feeds into.
- **Modify:** `css/styles.css` — new classes for the per-monster
  selected/dimmed states approved during design (mirroring the "B"
  layout: selected target scaled up, others dimmed), and however many
  monster zones need to render side by side (2 or 3, not a fixed single
  slot).

## Testing

- `groupEncounters.test.js` (new): `incrementKillCount` — increments the
  right key, leaves others untouched, starts from 0 for an unseen key;
  `rollEncounterGroup` — below threshold always returns a 1-element
  array regardless of rng; at/above threshold with a fixed rng, verify
  the chance-roll boundary (just under `GROUP_SPAWN_CHANCE` → group,
  just at/over → solo) and the group-size roll's boundaries (verify
  both `GROUP_SIZE_MIN` and `GROUP_SIZE_MAX` are reachable with an
  injected rng, and the returned array is always exactly that many
  copies of the input `monsterId`).
- `battleScreen.js` changes have no dedicated test file, matching this
  codebase's existing convention (screen modules are DOM-driving,
  verified manually) — this build's manual-verification pass needs to
  be unusually thorough given the size of the rework: a solo encounter
  must play identically to before (regression, not just new-feature
  correctness), and a rolled group encounter needs every mechanic
  exercised live (targeting via click/arrow/Tab, single-target
  Attack/ability on the selected monster, the parry sweep catching
  multiple simultaneous windows, a partial-kill-then-flee actually
  granting only the killed monster's rewards).
- `main.js`'s reward-loop changes likewise have no dedicated test file
  (matching existing convention) — same manual-verification bar as
  above, specifically confirming `state.monsterKillCounts` actually
  increments and persists, and that a fled-with-partial-kills battle's
  XP/gold/drop/quest-progress numbers match summing each killed
  monster's own values, not the old single-monster shape.
