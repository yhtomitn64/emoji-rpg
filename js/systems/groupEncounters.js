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
