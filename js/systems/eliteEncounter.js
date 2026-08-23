import { calculateDamage } from './combat.js';

export const ELITE_ENCOUNTER_CHANCE = 0.05;
export const ELITE_MONSTER_ID = 'jurassicJerky';

export function rollEliteEncounter(rng = Math.random) {
  return rng() < ELITE_ENCOUNTER_CHANCE;
}

// A lighter in-game estimate rather than a full battle simulation (that'd be
// overkill on every appearance) - reuses the same average-damage/hits-to-kill
// technique isMonsterOutclassed already uses for the weak-mob check, just
// compared both directions into a ratio instead of a single threshold.
const OUTMATCHED_RATIO = 0.6;
const FAVORABLE_RATIO = 1.4;

export function getEliteAppearLine(player, monster) {
  const avgPlayerDamage = calculateDamage(player, monster, () => 0.5);
  const avgMonsterDamage = calculateDamage(monster, player, () => 0.5);
  const playerHitsToKill = Math.ceil(monster.hp / avgPlayerDamage);
  const monsterHitsToKill = Math.ceil(player.hp / avgMonsterDamage);
  const ratio = monsterHitsToKill / playerHitsToKill;
  if (ratio < OUTMATCHED_RATIO) {
    return `${monster.name} looms over you. There's no way you can beat this thing.`;
  }
  if (ratio < FAVORABLE_RATIO) {
    return `${monster.name} sizes you up. If you're skilled enough, you might just get it.`;
  }
  return `${monster.name} snarls, but you've got the edge here.`;
}
