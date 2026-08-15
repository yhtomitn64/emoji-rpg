export const MAX_NG_PLUS_CYCLE = 2;
export const NG_PLUS_HP_MULTIPLIER = 2;
export const NG_PLUS_COMBAT_MULTIPLIER = 1.25;
export const NG_PLUS_REWARD_MULTIPLIER = 1.5;
export const NG_PLUS_DROP_CHANCE_MULTIPLIER = 1.5;
export const NG_PLUS_DROP_CHANCE_CAP = 0.9;

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
  return dropTable.map((entry) => ({
    ...entry,
    chance: Math.min(NG_PLUS_DROP_CHANCE_CAP, entry.chance * multiplier),
  }));
}

export function resetWorldForNgPlus(state) {
  return {
    ...state,
    flags: { ...state.flags, dungeonBossDefeated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
    map: 'center',
    position: null,
    ngPlusCycle: Math.min(state.ngPlusCycle + 1, MAX_NG_PLUS_CYCLE),
  };
}
