#!/usr/bin/env node
/**
 * Dungeon-tier & boss balance simulation.
 *
 * Drives the REAL combat/leveling/inventory modules (`js/systems/combat.js`,
 * `js/systems/leveling.js`, `js/systems/inventory.js`) and the REAL monster and
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
 */

import { calculateDamage, tickGauge, isReady } from '../js/systems/combat.js';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';
import { getEquipmentBonuses } from '../js/systems/inventory.js';
import { applyXp, xpForLevel } from '../js/systems/leveling.js';
import { createNewGame } from '../js/state.js';

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

const MATCHUPS = ['orc', 'wraith', 'dragon'];

// --- Battle simulation -------------------------------------------------

const MAX_TICKS = 3000;
const POTION_THRESHOLD = 0.4; // drink when below 40% of max HP

/**
 * Replays battleScreen.js's tick loop:
 *   1. both gauges tick
 *   2. the monster attacks only if it is ready AND the player is not
 *   3. the player acts as soon as their gauge is full
 *
 * Step 3 models a player who acts promptly. Stalling on a full gauge freezes
 * the monster forever (step 2's `!isReady(player)` guard), so "acts promptly"
 * is the honest model of real play rather than an exploit.
 */
function simulateBattle(build, monsterStats) {
  const player = {
    hp: build.maxHp, maxHp: build.maxHp,
    attack: build.attack, defense: build.defense, speed: build.speed, atb: 0,
  };
  const monster = {
    hp: monsterStats.hp, maxHp: monsterStats.hp,
    attack: monsterStats.attack, defense: monsterStats.defense, speed: monsterStats.speed, atb: 0,
  };

  let potions = build.potions;
  let potionsUsed = 0;

  for (let ticks = 1; ticks <= MAX_TICKS; ticks++) {
    player.atb = tickGauge(player.atb, player.speed, 1);
    monster.atb = tickGauge(monster.atb, monster.speed, 1);

    if (isReady(monster.atb) && !isReady(player.atb)) {
      player.hp = Math.max(0, player.hp - calculateDamage(monster, player));
      monster.atb = 0;
      if (player.hp <= 0) return { outcome: 'lost', hpLeft: 0, potionsUsed, ticks };
    }

    if (isReady(player.atb)) {
      if (potions > 0 && player.hp < player.maxHp * POTION_THRESHOLD) {
        potions--;
        potionsUsed++;
        player.hp = Math.min(player.maxHp, player.hp + ITEMS.potion.heal);
      } else {
        monster.hp = Math.max(0, monster.hp - calculateDamage(player, monster));
        if (monster.hp <= 0) {
          return { outcome: 'won', hpLeft: player.hp / player.maxHp, potionsUsed, ticks };
        }
      }
      player.atb = 0;
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

  console.log(`Balance simulation — ${trials} trials per matchup\n`);

  console.log('Monster stats under test:');
  for (const id of MATCHUPS) {
    const m = monsters[id];
    console.log(`  ${m.name.padEnd(8)} hp ${String(m.hp).padStart(3)}  atk ${String(m.attack).padStart(2)}  def ${String(m.defense).padStart(2)}  spd ${String(m.speed).padStart(2)}`);
  }

  console.log('\nPlayer builds under test:');
  for (const b of BUILDS) {
    console.log(`  ${b.name.padEnd(38)} hp ${String(b.maxHp).padStart(3)}  atk ${String(b.attack).padStart(2)}  def ${String(b.defense).padStart(2)}  spd ${String(b.speed).padStart(2)}  potions ${b.potions}  gear cost ${b.goldSpent}g`);
  }

  console.log('\n' + 'build'.padEnd(38) + 'monster'.padEnd(10) + '  win   HP left  potions');
  console.log('-'.repeat(76));
  for (const build of BUILDS) {
    for (const id of MATCHUPS) {
      const r = runMatchup(build, monsters[id], trials);
      const stalemateNote = r.stalemateRate > 0 ? `  (stalemate ${pct(r.stalemateRate)})` : '';
      console.log(
        build.name.padEnd(38) +
        monsters[id].name.padEnd(10) +
        pct(r.winRate) + '   ' + pct(r.avgHpLeftOnWin) + '    ' + r.avgPotions.toFixed(1) +
        stalemateNote
      );
    }
    console.log('-'.repeat(76));
  }
}

main();
