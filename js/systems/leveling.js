export const LATE_GAME_LEVEL_THRESHOLD = 10;
export const LATE_GAME_XP_RAMP_PER_LEVEL = 0.08;
export const LEVEL_UP_PARTIAL_HEAL_FRACTION = 0.5;

export function xpForLevel(level) {
  const base = Math.round(12 * Math.pow(level, 1.5));
  if (level < LATE_GAME_LEVEL_THRESHOLD) return base;
  return Math.round(base * (1 + (level - (LATE_GAME_LEVEL_THRESHOLD - 1)) * LATE_GAME_XP_RAMP_PER_LEVEL));
}

function statGainsForLevel(newLevel) {
  if (newLevel < LATE_GAME_LEVEL_THRESHOLD) {
    return { maxHp: 4, attack: newLevel % 2 === 0 ? 2 : 1, defense: 1, speed: 1 };
  }
  return { maxHp: 2, attack: 1, defense: 1, speed: newLevel % 2 === 0 ? 1 : 0 };
}

export function applyXp(player, xpGained) {
  let { level, attack, defense, speed, maxHp } = player;
  let xp = player.xp + xpGained;
  let leveledUp = false;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    const gains = statGainsForLevel(level);
    maxHp += gains.maxHp;
    attack += gains.attack;
    defense += gains.defense;
    speed += gains.speed;
    leveledUp = true;
  }

  let hp = player.hp;
  if (leveledUp) {
    hp = level >= LATE_GAME_LEVEL_THRESHOLD
      ? Math.round(player.hp + (maxHp - player.hp) * LEVEL_UP_PARTIAL_HEAL_FRACTION)
      : maxHp;
  }

  return {
    player: { ...player, level, xp, maxHp, attack, defense, speed, hp },
    leveledUp,
  };
}

export function hasEverKilledSomething(player) {
  return player.level > 1 || player.xp > 0;
}
