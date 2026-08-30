export const GROUP_SPAWN_KILL_THRESHOLD = 10;
export const GROUP_SPAWN_CHANCE_BASE = 0.3;
export const GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE = 0.1;
export const GROUP_SIZE_MIN = 2;
export const GROUP_SIZE_MAX_BASE = 4;
export const GROUP_SIZE_MAX_CAP = 6;
export const ZONE1_STEPS_PER_SIZE_ESCALATION = 300;

export function incrementKillCount(killCounts, monsterId) {
  return { ...killCounts, [monsterId]: (killCounts[monsterId] || 0) + 1 };
}

// NG+ raises how *often* a group spawns at all, not just how big one is -
// zone-1 lingering (effectiveGroupSizeMax below) only ever raises size.
export function groupSpawnChance(ngPlusCycle) {
  return GROUP_SPAWN_CHANCE_BASE + ngPlusCycle * GROUP_SPAWN_CHANCE_PER_NG_PLUS_CYCLE;
}

// Two independent, additive escalation pressures toward the same hard cap:
// NG+ cycle (persists until the next cycle) and steps taken on a zone-1
// wilderness screen this cycle (js/screens/mapScreen.js's tryMove, reset on
// NG+ transition - see js/systems/ngPlus.js's resetWorldForNgPlus). A
// player who lingers in zone-1 long enough can reach the max group size
// even at NG+ cycle 0. Despite the zone-scoped name, zone1Steps is read by
// every encounter roll that feeds into this function - including rolls
// inside the boss dungeon and mini-dungeons, not just literal zone-1
// wilderness screens - so in practice it functions as an "elapsed time
// this NG+ cycle" proxy rather than a zone-1-only effect.
export function effectiveGroupSizeMax(ngPlusCycle, zone1Steps) {
  const escalation = ngPlusCycle + Math.floor(zone1Steps / ZONE1_STEPS_PER_SIZE_ESCALATION);
  return Math.min(GROUP_SIZE_MAX_CAP, GROUP_SIZE_MAX_BASE + escalation);
}

// monsterId is the seed species (already rolled by the caller, js/screens/
// mapScreen.js's tryMove, from the same monsterTable passed in here) - it's
// always the first element of a rolled group. Every slot beyond it is
// independently rolled from monsterTable too, so a group can be a genuine
// mix of species, not always-identical copies of the seed.
export function rollEncounterGroup(monsterId, killCounts, monsterTable, ngPlusCycle, zone1Steps, rng = Math.random) {
  const kills = killCounts[monsterId] || 0;
  if (kills < GROUP_SPAWN_KILL_THRESHOLD || rng() >= groupSpawnChance(ngPlusCycle)) {
    return [monsterId];
  }
  const max = effectiveGroupSizeMax(ngPlusCycle, zone1Steps);
  const size = GROUP_SIZE_MIN + Math.floor(rng() * (max - GROUP_SIZE_MIN + 1));
  return [monsterId, ...Array.from({ length: size - 1 }, () => monsterTable[Math.floor(rng() * monsterTable.length)])];
}
