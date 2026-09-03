import { rollCrit, calculateDamage, applyCritMultiplier, applySpeedDamageBonus, applyKnockback, ATB_KNOCKBACK } from './combat.js';

// Powers the damage number shown next to each ability button. Deliberately
// excludes crit (rollCrit) - luck at press-time, not something the player
// can know before pressing. Buff state IS known in advance (visible from
// the buff indicator), so it's included for accuracy.

export const ROTATION_BONUS_MULTIPLIER = 1.25;

export const ABILITIES = [
  {
    id: 'stab', name: 'Impale', icon: '🗡️', unlockLevel: 2, type: 'damage',
    damageMultiplier: 0.8, cooldownMs: 4000,
    description: 'a strong, precise single-target thrust',
  },
  {
    id: 'chop', name: 'Sever', icon: '🪓', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.1, cooldownMs: 10000,
    extraTargetCount: 1,
    description: 'cuts through the target and into one random enemy beside it - still fine to use one-on-one',
  },
  {
    id: 'slash', name: 'Lacerate', icon: '⚔️', unlockLevel: 6, type: 'damage',
    damageMultiplier: 0.85, cooldownMs: 6000,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
    retrigger: { windowMs: 1200, sweetSpotStartPercent: 80, sweetSpotEndPercent: 100, buffDurationMs: 9000 },
    description: 'a cut that bleeds for extra damage a moment later - press it again right after landing to buff your other abilities for a while',
  },
  {
    id: 'sweep', name: 'Faultline', icon: '🪨', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.3, cooldownMs: 12000,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
    widenBonusTargets: 1,
    aoe: true,
    description: 'a weak hit on every living enemy that weakens their defense and widens what your other abilities can hit for a few seconds',
  },
  {
    id: 'superScream', name: 'Super Scream', icon: '📢', unlockLevel: 10, type: 'buff',
    cooldownMs: 30000, buffDurationMs: 12000,
    description: 'a roar that boosts all your damage for a while',
  },
];

export function getUnlockedAbilities(level) {
  return ABILITIES.filter((ability) => ability.unlockLevel <= level);
}

// Reuses the existing per-ability cooldown state (abilityCooldowns in
// js/screens/battleScreen.js / scripts/simulate-balance.js) as the shared
// global cooldown mechanism, rather than introducing a separate timer -
// see docs/superpowers/specs/2026-09-03-ability-gcd-rework-design.md's
// "Mechanism" section. `totals` is a parallel map of the duration that was
// actually applied to each ability's most recent cooldown (mirrors
// battleScreen.js's existing attackCooldownMs/attackCooldownTotalMs
// pattern) - needed because cooldownPct can no longer divide by a fixed
// per-ability config value once the applied duration varies per use.
export function applyAbilityGcd(cooldowns, unlockedAbilities, usedAbilityId, gcdMs, totals = {}) {
  const nextCooldowns = { ...cooldowns };
  const nextTotals = { ...totals };
  for (const ability of unlockedAbilities) {
    if (ability.type === 'buff') continue; // Super Scream stays independent
    const floor = ability.id === usedAbilityId ? (ability.overrideCooldownMs || 0) : 0;
    const target = Math.max(gcdMs, floor);
    if (target > (nextCooldowns[ability.id] || 0)) {
      nextCooldowns[ability.id] = target;
      nextTotals[ability.id] = target;
    }
  }
  return { cooldowns: nextCooldowns, totals: nextTotals };
}

// Feeds js/screens/mechanicExplainerScreen.js's combined ability-unlock
// popup (js/main.js) - explainerText is keyed by ability id, matching
// js/data/abilityExplainers.js. Falls back to '' rather than throwing so a
// not-yet-written entry renders an empty (not crashing) section instead of
// blocking the level-up flow.
export function buildAbilityExplainerSections(unlockedAbilities, explainerText) {
  return unlockedAbilities.map((ability) => ({
    icon: ability.icon,
    title: ability.name,
    text: explainerText[ability.id] || '',
  }));
}

export function canUseAbility({ locked, onCooldown, ready, alwaysReady, retriggerWindowOpen }) {
  if (locked) return false;
  // Lacerate's own self-retrigger window (see js/screens/battleScreen.js)
  // makes its button clickable again despite still being on cooldown - a
  // deliberately different input than a normal reuse.
  if (retriggerWindowOpen) return true;
  return !onCooldown && !!(ready || alwaysReady);
}

export function tickCooldowns(cooldowns, dt) {
  const next = {};
  for (const [id, remainingMs] of Object.entries(cooldowns)) {
    next[id] = Math.max(0, remainingMs - dt);
  }
  return next;
}

export function createBuffState() {
  return { active: false, remainingMs: 0 };
}

export function activateBuff(ability) {
  return { active: true, remainingMs: ability.buffDurationMs };
}

export function tickBuff(buffState, dt) {
  if (!buffState.active) return buffState;
  const remainingMs = Math.max(0, buffState.remainingMs - dt);
  return remainingMs === 0 ? createBuffState() : { ...buffState, remainingMs };
}

export function resolveTimingHit(actedAtPercent, sweetSpotStartPercent, sweetSpotEndPercent) {
  return actedAtPercent >= sweetSpotStartPercent && actedAtPercent <= sweetSpotEndPercent;
}

export function resolveAbilityUse(player, monster, ability, buffActive, rng = Math.random, critChanceBonus = 0) {
  const isCrit = rollCrit(rng, critChanceBonus);
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  damage = applyCritMultiplier(damage, isCrit);
  damage = applySpeedDamageBonus(damage, player.speed);
  return {
    damage,
    isCrit,
    monsterHp: Math.max(0, monster.hp - damage),
    monsterAtb: applyKnockback(monster.atb, ATB_KNOCKBACK),
    playerAtb: 0,
  };
}

export function estimateAbilityDamage(player, monster, ability, buffActive, rng = () => 0.5) {
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  return applySpeedDamageBonus(damage, player.speed);
}

export function resolveDelayedHit(baseDamage, ability) {
  return Math.round(baseDamage * ability.delayedHitMultiplier);
}

export function createDefenseDebuff(ability) {
  return { active: true, multiplier: ability.defenseShredMultiplier, remainingMs: ability.defenseShredDurationMs };
}

export function tickDefenseDebuff(debuff, dt) {
  if (!debuff) return null;
  const remainingMs = Math.max(0, debuff.remainingMs - dt);
  return remainingMs === 0 ? null : { ...debuff, remainingMs };
}

export function applyDefenseDebuff(monster, debuff) {
  if (!debuff || !debuff.active) return monster;
  return { ...monster, defense: Math.round(monster.defense * debuff.multiplier) };
}
