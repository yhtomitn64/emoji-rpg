import { ITEMS } from '../data/items.js';

export const MAX_NG_PLUS_CYCLE = 2;
export const NG_PLUS_HP_MULTIPLIER = 2;
export const NG_PLUS_COMBAT_MULTIPLIER = 1.25;
export const NG_PLUS_REWARD_MULTIPLIER = 1.5;
export const NG_PLUS_DROP_CHANCE_MULTIPLIER = 1.5;

export function canStartNgPlus(state) {
  return Boolean(state.flags.dungeonBossDefeated) && state.ngPlusCycle < MAX_NG_PLUS_CYCLE;
}

export function getNgPlusCombatOverrides(baseMonster, cycle) {
  const hpMultiplier = NG_PLUS_HP_MULTIPLIER ** cycle;
  const combatMultiplier = NG_PLUS_COMBAT_MULTIPLIER ** cycle;
  return {
    hp: Math.round(baseMonster.hp * hpMultiplier),
    attack: Math.round(baseMonster.attack * combatMultiplier),
    defense: Math.round(baseMonster.defense * combatMultiplier),
    speed: baseMonster.speed,
  };
}

export function getNgPlusRewardMultiplier(cycle) {
  const multiplier = NG_PLUS_REWARD_MULTIPLIER ** cycle;
  return { gold: multiplier, xp: multiplier };
}

export function scaleDropTable(dropTable, cycle) {
  const multiplier = NG_PLUS_DROP_CHANCE_MULTIPLIER ** cycle;
  const isTool = (entry) => ITEMS[entry.itemId] && ITEMS[entry.itemId].type === 'tool';

  const scaled = dropTable.map((entry) => (
    isTool(entry) ? entry : { ...entry, chance: entry.chance * multiplier }
  ));

  const total = scaled.reduce((sum, entry) => (isTool(entry) ? sum : sum + entry.chance), 0);
  if (total <= 1) return scaled;

  return scaled.map((entry) => (
    isTool(entry) ? entry : { ...entry, chance: entry.chance / total }
  ));
}

export function resetWorldForNgPlus(state) {
  return {
    ...state,
    flags: { ...state.flags, dungeonBossDefeated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    gateRewards: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
    map: 'center',
    position: null,
    ngPlusCycle: Math.min(state.ngPlusCycle + 1, MAX_NG_PLUS_CYCLE),
  };
}
