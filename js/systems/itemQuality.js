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

export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20, mythic: 1.5 };

// Retuned 2026-08-31 from the original 1.35 launch value (see
// docs/superpowers/BACKLOG.md's Mythic-tier entry for the full story):
// scripts/simulate-balance.js was extended to actually model the Rung-3
// on-hit effects (crit%, extra-swing, lifesteal, elemental proc, thorns)
// that Ember Ring/Windfury Ring/Retribution Charm/etc. grant - the
// maxed-Mythic-ceiling build was silently missing both ring slots before
// that fix, understating its own real power. Measuring with rings
// equipped already closed the previously-reported NG+2 hard-tier
// shortfall at 1.35 with zero multiplier change. This 1.5 bump goes
// further, aimed at Timothy's actual stated goal (feel genuinely strong
// by the end of NG+2, not just barely surviving it): re-run at 1.5, even
// the no-rings build - the unlucky-drops floor - goes from losing/
// near-losing to a real, winnable, potion-burning fight against every
// hard-tier NG+2 monster, while the ringed ceiling build clears the same
// content with real HP margin and zero potions. A fully maxed Mythic item
// (1.5 tier x 1.75 upgrade-level-3) now tops out at 2.625x base, vs.
// Superior's 2.1x ceiling. Still not verified against real playtesting -
// re-check with the simulator again if this stops feeling right.
export const MYTHIC_TIER_CHANCE_MIN = 0.005;
export const MYTHIC_TIER_CHANCE_MAX = 0.02;

// Only reachable once ngPlusCycle >= 1 - the mythic band sits at the low end
// of the same single roll Fine/Superior already use, so ngPlusCycle=0 (the
// default) reproduces today's exact thresholds with zero behavior change.
export function rollQualityTier(toughness, rng = Math.random, ngPlusCycle = 0) {
  const mythicChance = ngPlusCycle >= 1 ? lerp(MYTHIC_TIER_CHANCE_MIN, MYTHIC_TIER_CHANCE_MAX, toughness) : 0;
  const superiorChance = lerp(0.02, 0.10, toughness);
  const fineChance = lerp(0.10, 0.25, toughness);
  const roll = rng();
  if (roll < mythicChance) return 'mythic';
  if (roll < mythicChance + superiorChance) return 'superior';
  if (roll < mythicChance + superiorChance + fineChance) return 'fine';
  return 'plain';
}

// 1% at the weakest eligible monster, 5% at the toughest - its own
// independent check, not a bucket inside rollQualityTier.
export function rollUniqueEffectChance(toughness, rng = Math.random) {
  return rng() < lerp(0.01, 0.05, toughness);
}

// Mythic Essence: the reforge material, dropped the same way as everything
// else in this file - toughness-weighted, gated to ngPlusCycle >= 1 by its
// caller (loot.js), not by this function itself.
export const MYTHIC_ESSENCE_CHANCE_MIN = 0.02;
export const MYTHIC_ESSENCE_CHANCE_MAX = 0.06;

export function rollMythicEssenceChance(toughness, rng = Math.random) {
  return rng() < lerp(MYTHIC_ESSENCE_CHANCE_MIN, MYTHIC_ESSENCE_CHANCE_MAX, toughness);
}

// A hard floor, not a weighted chance like the rolls above - below this
// toughness, no ring-slot item can drop at all, regardless of RNG. Applies
// uniformly to every ring-slot item (loot.js's eligibleUniqueEffectPool).
export const RING_TOUGHNESS_FLOOR = 0.6;

// Bosses are excluded from rollQualityTier entirely (isToughnessEligible
// returns false for isBoss) - a dragon kill's chance to tag its named drop
// Mythic is a separate, flat roll in loot.js, not toughness-weighted.
export const BOSS_MYTHIC_CHANCE = 0.25;

export function tierLabel(tier) {
  if (tier === 'fine') return 'Fine ';
  if (tier === 'superior') return 'Superior ';
  if (tier === 'mythic') return 'Mythic ';
  return '';
}
