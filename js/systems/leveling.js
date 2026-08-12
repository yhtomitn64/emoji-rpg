export function xpForLevel(level) {
  return Math.round(10 * Math.pow(level, 1.5));
}

export function applyXp(player, xpGained) {
  let { level, attack, defense, speed, maxHp } = player;
  let xp = player.xp + xpGained;
  let leveledUp = false;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    maxHp += 4;
    attack += 2;
    defense += 1;
    speed += 1;
    leveledUp = true;
  }

  const hp = leveledUp ? maxHp : player.hp;

  return {
    player: { ...player, level, xp, maxHp, attack, defense, speed, hp },
    leveledUp,
  };
}
