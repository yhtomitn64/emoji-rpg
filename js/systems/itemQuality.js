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

// New top tier for guaranteed super-boss drops, above mythic - name and
// multiplier are both first-pass placeholders (Timothy writes the real
// name; the multiplier is tuned via the simulator alongside each
// superboss's own stat block, same as every number in this pass). Never
// reachable via rollQualityTier's random roll (superbosses are
// forceFullBattle, so isToughnessEligible excludes them) - only assigned
// via an explicit `tier` field on a dropTable entry (see loot.js's
// rollDrop).
export const QUALITY_TIER_MULTIPLIERS = { fine: 1.10, superior: 1.20, mythic: 1.5, apex: 1.9 };

// Very small but nonzero pre-NG+ Mythic band, and per-cycle growth for
// NG+1 and beyond, replacing the old flat 0%-before-NG+1-then-forever-
// fixed shape. First-pass placeholder numbers, same spirit as the
// ability-GCD constants that shipped as "a starting point, not final
// tuning" - this is drop-rarity feel, not combat difficulty, so it isn't
// gated on simulator validation like the combat numbers elsewhere in this
// pass.
export const PRE_NG_PLUS_MYTHIC_CHANCE_MIN = 0.001;
export const PRE_NG_PLUS_MYTHIC_CHANCE_MAX = 0.004;
export const MYTHIC_TIER_CHANCE_MIN = 0.005;
export const MYTHIC_TIER_CHANCE_MAX = 0.02;
// Matches the exponential-uncapped style ngPlus.js's own
// NG_PLUS_DROP_CHANCE_MULTIPLIER/NG_PLUS_COMBAT_MULTIPLIER already use.
// Growth starts at NG+2 (NG_PLUS_MYTHIC_TIER_GROWTH ** (cycle - 1)), so
// NG+1 reproduces today's exact band unchanged.
export const MYTHIC_TIER_NG_PLUS_GROWTH = 1.5;

export function rollQualityTier(toughness, rng = Math.random, ngPlusCycle = 0) {
  const mythicChance = ngPlusCycle >= 1
    ? lerp(MYTHIC_TIER_CHANCE_MIN, MYTHIC_TIER_CHANCE_MAX, toughness) * (MYTHIC_TIER_NG_PLUS_GROWTH ** (ngPlusCycle - 1))
    : lerp(PRE_NG_PLUS_MYTHIC_CHANCE_MIN, PRE_NG_PLUS_MYTHIC_CHANCE_MAX, toughness);
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
  if (tier === 'apex') return 'Apex ';
  return '';
}
