#!/usr/bin/env node
/**
 * Dungeon-tier & boss balance simulation.
 *
 * Drives the REAL combat/leveling/inventory/abilities/boss-tier modules
 * (`js/systems/combat.js`, `js/systems/leveling.js`, `js/systems/inventory.js`,
 * `js/systems/abilities.js`, `js/systems/bossTiers.js`) and the REAL monster and
 * item data, replaying `battleScreen.js`'s tick loop headlessly so the numbers
 * here reflect the shipped mechanics rather than a re-implementation.
 *
 * This lives in `scripts/` (not `tests/`) on purpose: `npm test` globs
 * `tests/*.js`, and this is a stochastic balance report with no pass/fail
 * assertions, so it must not run as part of the test suite.
 *
 * Usage:
 *   node scripts/simulate-balance.js
 *   node scripts/simulate-balance.js --trials 5000
 *   node scripts/simulate-balance.js --set orc.attack=20 --set wraith.hp=32
 *
 * `--set` applies a temporary in-memory stat override, which is how candidate
 * retunes were explored before being written into `js/data/monsters.js`.
 *
 * KEEP THIS IN SYNC: this file used to hand-roll its own copies of the
 * combat formulas and quietly fell behind real fixes for a long stretch
 * before anyone noticed (see the 2026-08-17 fix that made it call the real
 * combat.js functions instead) - and it was blind to the entire ability
 * system for just as long after abilities shipped (see the 2026-08-22
 * balance-simulator-ability-modeling plan that added ability/combo/boss-tier
 * modeling here, months later). When you change `js/systems/combat.js`,
 * `js/systems/abilities.js`, `js/systems/bossTiers.js`, or add a new combat
 * mechanic anywhere in the battle system: check whether `simulateBattle()`
 * below and `scripts/simulateAbilityPolicy.js`'s `chooseAction()` need a
 * matching update. The *math* (damage/crit/cooldowns/combo bonuses) stays
 * in sync automatically as long as this file keeps calling the real shared
 * functions instead of reimplementing them - but the *policy* (what action
 * the simulated player takes each tick) is a hand-rolled stand-in for a
 * human, and nothing enforces that it reflects a new ability, a new status
 * effect, or a new player action. It has to be updated by hand, on purpose,
 * every time.
 */

import { tickGauge, isReady, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, attackStreakMultiplier, attackKnockbackMultiplier } from '../js/systems/combat.js';
import { ABILITIES, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveAbilityUse, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff } from '../js/systems/abilities.js';
import { chooseAction } from './simulateAbilityPolicy.js';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';
import { getEquipmentBonuses } from '../js/systems/inventory.js';
import { applyXp, xpForLevel } from '../js/systems/leveling.js';
import { createNewGame } from '../js/state.js';
import { getBossTierStats, MAX_BOSS_TIER } from '../js/systems/bossTiers.js';

// --- CLI ---------------------------------------------------------------

function parseArgs(argv) {
  const opts = { trials: 2000, overrides: {} };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--trials') {
      opts.trials = Number(argv[++i]);
    } else if (argv[i] === '--set') {
      const [path, rawValue] = argv[++i].split('=');
      const [monsterId, stat] = path.split('.');
      (opts.overrides[monsterId] ||= {})[stat] = Number(rawValue);
    }
  }
  return opts;
}

// --- Player builds -----------------------------------------------------

/** Level a fresh character up using the real XP curve and level-up growth. */
function playerAtLevel(targetLevel) {
  let player = createNewGame().player;
  while (player.level < targetLevel) {
    player = applyXp(player, xpForLevel(player.level)).player;
  }
  return player;
}

/** Total shop cost of a gear set, so "cheaply achievable" stays honest. */
function gearCost(equipment) {
  return Object.values(equipment)
    .filter(Boolean)
    .reduce((sum, itemId) => sum + (ITEMS[itemId].price || 0), 0);
}

function makeBuild({ name, level, equipment, potions }) {
  const player = playerAtLevel(level);
  const fullEquipment = { weapon: null, head: null, body: null, legs: null, accessory: null, ...equipment };
  const bonuses = getEquipmentBonuses({ player, equipment: fullEquipment, upgrades: {} });
  return {
    name,
    level,
    potions,
    goldSpent: gearCost(fullEquipment),
    maxHp: player.maxHp + bonuses.maxHp,
    attack: player.attack + bonuses.attack,
    defense: player.defense + bonuses.defense,
    speed: player.speed + bonuses.speed,
  };
}

const BUILDS = [
  // The true fresh-start baseline: no shop trip at all, just the starting
  // sword and starting potions. Added 2026-08-17 after Timothy reported his
  // actual first playthrough skipped armor entirely and leaned on potions.
  makeBuild({
    name: 'L1 (starter sword only, no armor)',
    level: 1,
    equipment: { weapon: 'starterSword' },
    potions: 2,
  }),
  // Near-town tier baseline for the savage-early-game rework: the cheapest
  // armor piece a level-1 character can actually afford (clothTunic spends
  // the entire 20g starting purse).
  makeBuild({
    name: 'L1 (starter sword + cloth tunic)',
    level: 1,
    equipment: { weapon: 'starterSword', body: 'clothTunic' },
    potions: 2,
  }),
  // Far-corner tier baseline: a couple levels and a second cloth piece in.
  makeBuild({
    name: 'L4 (starter sword + cloth tunic + cloth cap)',
    level: 4,
    equipment: { weapon: 'starterSword', body: 'clothTunic', head: 'clothCap' },
    potions: 3,
  }),
  // Timothy's exact 2026-08-17 report: level 5, full cloth set, starter
  // sword never upgraded at the smith - "killing guys with a few hits and
  // no potions" (i.e. leveling alone is trivializing fights before gear
  // has caught up at all).
  makeBuild({
    name: "L5 (starter sword unupgraded, full cloth)",
    level: 5,
    equipment: { weapon: 'starterSword', body: 'clothTunic', head: 'clothCap', legs: 'clothPants' },
    potions: 3,
  }),
  // Rushed the dungeon: barely bought anything, just the free starting sword
  // and the cheapest hat. This is the "under-prepared arrival".
  makeBuild({
    name: 'rushed L6 (starter sword + cloth cap)',
    level: 6,
    equipment: { weapon: 'starterSword', head: 'clothCap' },
    potions: 2,
  }),
  // Bought the cheap full cloth set plus an iron sword. This is the
  // "reasonable effort" arrival the finding calls out as currently trivial.
  makeBuild({
    name: 'reasonable L7 (iron sword + full cloth)',
    level: 7,
    equipment: {
      weapon: 'ironSword', head: 'clothCap', body: 'clothTunic',
      legs: 'clothPants', accessory: 'luckyCharm',
    },
    potions: 4,
  }),
  // The finding's own baseline: L6 with the full iron defensive set.
  makeBuild({
    name: 'geared L6 (full iron)',
    level: 6,
    equipment: {
      weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor',
      legs: 'ironGreaves', accessory: 'powerRing',
    },
    potions: 4,
  }),
  // Fully prepared: cleared the far screens, levelled, bought everything.
  makeBuild({
    name: 'prepared L9 (full iron)',
    level: 9,
    equipment: {
      weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor',
      legs: 'ironGreaves', accessory: 'powerRing',
    },
    potions: 6,
  }),
  // Same gear and level, but skimped on consumables — isolates how much of the
  // boss fight is carried by potion preparation rather than gear alone.
  makeBuild({
    name: 'prepared L9 (full iron, 2 potions)',
    level: 9,
    equipment: {
      weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor',
      legs: 'ironGreaves', accessory: 'powerRing',
    },
    potions: 2,
  }),
  // Over-levelled from grinding the dungeon: confirms the top end is not a wall.
  makeBuild({
    name: 'veteran L11 (full iron)',
    level: 11,
    equipment: {
      weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor',
      legs: 'ironGreaves', accessory: 'powerRing',
    },
    potions: 6,
  }),
];

const MATCHUPS = ['boar', 'bat', 'snake', 'goblin', 'direWolf', 'spider', 'orc', 'wraith'];
const BOSS_TIER_MATCHUP_IDS = Array.from({ length: MAX_BOSS_TIER + 1 }, (_, tier) => `dragonTier${tier}`);

// --- Battle simulation -------------------------------------------------

const MAX_TICKS = 3000;
const POTION_THRESHOLD = 0.4; // drink when below 40% of max HP

// Stands in for a human's real meter timing, since the simulator has no
// input timing to model. 0.7 = a reasonably-attentive player hits the
// sweet spot most of the time, not always. Only setup abilities (Stab/
// Slash) still have the timing meter post-combo-rework - payoffs (Chop/
// Sweep) never roll this. See docs/superpowers/specs/2026-08-22-balance-
// pass-design.md for why 0.7 and what to re-check if results feel overly
// sensitive to it.
const TIMING_HIT_RATE = 0.7;
const ATTACK_COOLDOWN_MS = 500; // matches battleScreen.js's ATTACK_COOLDOWN_MS

/**
 * Replays battleScreen.js's tick loop. The actual combat math (damage, crit,
 * knockback, speed bonus, heal, ability scaling) is NOT reimplemented here - it calls
 * resolvePlayerAttack/resolveMonsterAttack/resolvePotionUse/resolveAbilityUse from
 * js/systems/combat.js and js/systems/abilities.js, the exact same functions
 * battleScreen.js calls, so this script's numbers can't silently drift from the
 * shipped mechanics the way they did before 2026-08-17 (this file used to hand-roll
 * the same formulas, and quietly fell behind a battleScreen.js turn-priority fix
 * and three new combat-pass mechanics before anyone noticed).
 *
 * What's modeled here via real code (not reimplemented):
 *   - Ability rotation policy via chooseAction from simulateAbilityPolicy.js
 *   - Combo primer tracking and timing hits for setup abilities
 *   - Buff state (duration, active/inactive)
 *   - Defense debuff application and ticking (Sweep's shred effect)
 *   - Attack streak multiplier/knockback scaling
 *   - All potion and ability cooldown management
 *
 * What's still hand-rolled here (AI policy layer, not combat math): the
 * "drink a potion when below 40% HP" decision and the potion cooldown loop
 * structure. That's an AI stand-in for human clicking and has no real
 * battleScreen.js equivalent to share.
 *
 * What's deliberately NOT modeled (known scope limits):
 *   - Slash's delayed bleed tick from its buff state
 *   - The parry wind-up that monsters have before attacking (monsters still
 *     attack the instant their ATB is ready in this simulation)
 */
function simulateBattle(build, monsterStats) {
  const player = {
    hp: build.maxHp, maxHp: build.maxHp,
    attack: build.attack, defense: build.defense, speed: build.speed, atb: 0,
  };
  const monster = {
    hp: monsterStats.hp, maxHp: monsterStats.hp,
    attack: monsterStats.attack, defense: monsterStats.defense, speed: monsterStats.speed, atb: 0,
    defenseDebuff: null,
  };

  let potions = build.potions;
  let potionsUsed = 0;

  // Real-time-style state, same shape battleScreen.js keeps at module scope
  // - reset fresh per simulated battle here since each trial is independent.
  let abilityCooldowns = {};
  let comboState = {};
  let buffState = createBuffState();
  let attackStreak = 0;
  let attackCooldownMs = 0;

  for (let ticks = 1; ticks <= MAX_TICKS; ticks++) {
    player.atb = tickGauge(player.atb, player.speed, 1);
    monster.atb = tickGauge(monster.atb, monster.speed, 1);
    if (isReady(player.atb)) attackStreak = 0;
    attackCooldownMs = Math.max(0, attackCooldownMs - 300);
    abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
    buffState = tickBuff(buffState, 300);
    monster.defenseDebuff = tickDefenseDebuff(monster.defenseDebuff, 300);

    if (potions > 0 && player.hp < player.maxHp * POTION_THRESHOLD) {
      potions--;
      potionsUsed++;
      player.hp = resolvePotionUse(player, ITEMS.potion.heal).playerHp;
    }

    if (isReady(monster.atb)) {
      const result = resolveMonsterAttack(monster, player);
      player.hp = result.playerHp;
      player.atb = result.playerAtb;
      monster.atb = result.monsterAtb;
      if (player.hp <= 0) return { outcome: 'lost', hpLeft: 0, potionsUsed, ticks };
    }

    const action = chooseAction({
      level: build.level,
      cooldowns: abilityCooldowns,
      comboState,
      buffActive: buffState.active,
      ready: isReady(player.atb),
      attackOnCooldown: attackCooldownMs > 0,
    });

    if (action.kind === 'ability') {
      const ability = ABILITIES.find((a) => a.id === action.id);
      if (ability.type === 'buff') {
        buffState = activateBuff(ability);
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
      } else {
        const timingHit = ability.comboRole === 'setup' ? Math.random() < TIMING_HIT_RATE : false;
        const comboBonusActive = !!comboState[ability.id];
        const result = resolveAbilityUse(player, applyDefenseDebuff(monster, monster.defenseDebuff), ability, buffState.active, timingHit, comboBonusActive);
        monster.hp = result.monsterHp;
        monster.atb = result.monsterAtb;
        player.atb = result.playerAtb;
        abilityCooldowns[ability.id] = ability.cooldownMs;
        attackStreak = 0;
        comboState[ability.id] = false;
        if (ability.comboPartnerId && (ability.comboRole === 'payoff' || timingHit)) {
          comboState[ability.comboPartnerId] = true;
        }
        if (ability.defenseShredMultiplier) {
          monster.defenseDebuff = createDefenseDebuff(ability);
        }
        if (monster.hp <= 0) {
          return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
        }
      }
    } else if (action.kind === 'attack') {
      const result = resolvePlayerAttack(
        player, applyDefenseDebuff(monster, monster.defenseDebuff), Math.random,
        attackStreakMultiplier(attackStreak), attackKnockbackMultiplier(attackStreak)
      );
      attackStreak += 1;
      attackCooldownMs = ATTACK_COOLDOWN_MS;
      monster.hp = result.monsterHp;
      monster.atb = result.monsterAtb;
      player.atb = result.playerAtb;
      if (monster.hp <= 0) {
        return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
      }
    }
  }
  return { outcome: 'stalemate', hpLeft: player.hp / player.maxHp, potionsUsed, ticks: MAX_TICKS };
}

function runMatchup(build, monsterStats, trials) {
  let wins = 0;
  let stalemates = 0;
  let hpLeftOnWin = 0;
  let potionsUsed = 0;

  for (let i = 0; i < trials; i++) {
    const result = simulateBattle(build, monsterStats);
    if (result.outcome === 'won') {
      wins++;
      hpLeftOnWin += result.hpLeft;
    } else if (result.outcome === 'stalemate') {
      stalemates++;
    }
    potionsUsed += result.potionsUsed;
  }

  return {
    winRate: wins / trials,
    stalemateRate: stalemates / trials,
    avgHpLeftOnWin: wins > 0 ? hpLeftOnWin / wins : 0,
    avgPotions: potionsUsed / trials,
  };
}

// --- Report ------------------------------------------------------------

function pct(value) {
  return `${(value * 100).toFixed(0)}%`.padStart(5);
}

function main() {
  const { trials, overrides } = parseArgs(process.argv.slice(2));

  const monsters = {};
  for (const id of MATCHUPS) {
    monsters[id] = { ...MONSTERS[id], ...(overrides[id] || {}) };
  }
  const dragonBase = { ...MONSTERS.dragon, ...(overrides.dragon || {}) };
  for (const [tier, id] of BOSS_TIER_MATCHUP_IDS.entries()) {
    const tierStats = getBossTierStats(dragonBase, tier);
    monsters[id] = { ...dragonBase, ...tierStats, name: `Dragon (tier ${tier})`, ...(overrides[id] || {}) };
  }

  console.log(`Balance simulation — ${trials} trials per matchup\n`);

  console.log('Monster stats under test:');
  for (const id of [...MATCHUPS, ...BOSS_TIER_MATCHUP_IDS]) {
    const m = monsters[id];
    console.log(`  ${m.name.padEnd(22)} hp ${String(m.hp).padStart(3)}  atk ${String(m.attack).padStart(2)}  def ${String(m.defense).padStart(2)}  spd ${String(m.speed).padStart(2)}`);
  }

  console.log('\nPlayer builds under test:');
  for (const b of BUILDS) {
    console.log(`  ${b.name.padEnd(38)} hp ${String(b.maxHp).padStart(3)}  atk ${String(b.attack).padStart(2)}  def ${String(b.defense).padStart(2)}  spd ${String(b.speed).padStart(2)}  potions ${b.potions}  gear cost ${b.goldSpent}g`);
  }

  console.log('\n' + 'build'.padEnd(38) + 'monster'.padEnd(22) + '  win   HP left  potions');
  console.log('-'.repeat(88));
  for (const build of BUILDS) {
    for (const id of [...MATCHUPS, ...BOSS_TIER_MATCHUP_IDS]) {
      const r = runMatchup(build, monsters[id], trials);
      const stalemateNote = r.stalemateRate > 0 ? `  (stalemate ${pct(r.stalemateRate)})` : '';
      console.log(
        build.name.padEnd(38) +
        monsters[id].name.padEnd(22) +
        pct(r.winRate) + '   ' + pct(r.avgHpLeftOnWin) + '    ' + r.avgPotions.toFixed(1) +
        stalemateNote
      );
    }
    console.log('-'.repeat(88));
  }
}

main();
