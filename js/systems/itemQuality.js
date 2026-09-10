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
//
// New top tier for guaranteed super-boss drops, above mythic - name and
// multiplier are both first-pass placeholders (Timothy writes the real
// name; the multiplier is tuned via the simulator alongside each
// superboss's own stat block, same as every number in this pass).
// `rollQualityTier` structurally never returns `'apex'` - its own if-chain
// only ever produces plain/fine/superior/mythic - so this tier is only ever
// assigned via an explicit `tier` field on a dropTable entry (see loot.js's
// rollDrop), regardless of what rolls a superboss's named drop otherwise
// goes through.
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
// Growth starts at NG+2 (MYTHIC_TIER_NG_PLUS_GROWTH ** (cycle - 1)), so
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
//
// Lowered 2026-09-09 from the original 0.6 launch value: at 0.6, only the
// dungeon-tier roster (orc/wraith/skeleton, toughness 0.94-1.0) ever cleared
// the floor, so a real ring (Ember Ring/Windfury Ring - Power Ring isn't
// gated by this at all) was unreachable until deep into the game, and even
// then only via the separate 1-5% rollUniqueEffectChance roll - "you can
// only get really weak rings" was an accurate complaint. 0.3 opens the
// floor up to the far-corner roster too (direWolf/spider/scorpion,
// toughness ~0.35-0.40), so a real ring becomes farmable well before the
// dungeon, while near-town monsters (boar/bat/snake/frog/goblin, toughness
// <0.3) still can't drop one.
export const RING_TOUGHNESS_FLOOR = 0.3;

export function tierLabel(tier) {
  if (tier === 'fine') return 'Fine ';
  if (tier === 'superior') return 'Superior ';
  if (tier === 'mythic') return 'Mythic ';
  if (tier === 'apex') return 'Apex ';
  return '';
}
