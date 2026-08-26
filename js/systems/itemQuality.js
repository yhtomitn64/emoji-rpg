import { MONSTERS } from '../data/monsters.js';

export function isToughnessEligible(monster) {
  return !monster.isBoss && !monster.isElite && !monster.forceFullBattle;
}

const ELIGIBLE_MONSTERS = Object.values(MONSTERS).filter(isToughnessEligible);
const XP_MIN = Math.min(...ELIGIBLE_MONSTERS.map((m) => m.xp));
const XP_MAX = Math.max(...ELIGIBLE_MONSTERS.map((m) => m.xp));

export function monsterToughness(monster) {
  if (XP_MAX === XP_MIN) return 0; // guards a future roster of exactly one eligible monster
  const clamped = Math.min(Math.max(monster.xp, XP_MIN), XP_MAX);
  return (clamped - XP_MIN) / (XP_MAX - XP_MIN);
}

function lerp(min, max, t) { return min + (max - min) * t; }

export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20 };

// Returns 'plain' | 'fine' | 'superior'. Deciding whether something is a
// Unique-effect item at all happens earlier, via rollUniqueEffectChance -
// this function is scoped to just the three ordinary tiers so its odds are
// the same whether it's called for the new generic drop roll or for an
// existing named drop like goblinClub (see js/systems/loot.js).
export function rollQualityTier(toughness, rng = Math.random) {
  const superiorChance = lerp(0.02, 0.10, toughness);
  const fineChance = lerp(0.10, 0.25, toughness);
  const roll = rng();
  if (roll < superiorChance) return 'superior';
  if (roll < superiorChance + fineChance) return 'fine';
  return 'plain';
}

// 1% at the weakest eligible monster, 5% at the toughest - its own
// independent check, not a bucket inside rollQualityTier.
export function rollUniqueEffectChance(toughness, rng = Math.random) {
  return rng() < lerp(0.01, 0.05, toughness);
}

export function tierLabel(tier) {
  if (tier === 'fine') return 'Fine ';
  if (tier === 'superior') return 'Superior ';
  return '';
}
