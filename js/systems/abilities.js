import { rollCrit, calculateDamage, applyCritMultiplier, applySpeedDamageBonus, rollKnockback, ATB_KNOCKBACK } from './combat.js';

// Powers the damage number shown next to each ability button. Deliberately
// excludes crit (rollCrit) - luck at press-time, not something the player
// can know before pressing. Buff state IS known in advance (visible from
// the buff indicator), so it's included for accuracy.

export const ROTATION_BONUS_MULTIPLIER = 1.25;

// Per-ability cooldowns layered on top of the shared GCD (applyAbilityGcd's
// overrideCooldownMs floor), added 2026-09-03. Before this, all four
// abilities shared the same ~1s GCD with nothing else distinguishing them,
// so spamming just Impale (the earliest/cheapest) the instant it unlocked at
// level 2 was exactly as fast as rotating through all four - confirmed with
// the balance simulator: a level-2 character in just a starter sword + cloth
// tunic won 100% of fights (100% HP left) against every near-town monster
// and several NG+2-scaled ones. These numbers (graduated by unlock level,
// Impale's damage also cut roughly in half) came from comparing a flat 5s
// cooldown on all four against this graduated version - the flat version
// fixed the early stomp equally well but also crushed L4/L5 win rates
// against Dragon tier 0 and Jurassic Jerky much harder than the graduated
// version did for the same early-game fix. Re-check against real play and
// retune if it reads as too easy or too punishing, same as the parry
// window's own commentary in js/systems/parry.js.
export const ABILITIES = [
  {
    id: 'stab', name: 'Impale', icon: '🗡️', unlockLevel: 2, type: 'damage',
    damageMultiplier: 0.55,
    overrideCooldownMs: 3000,
    description: 'a strong, precise single-target thrust',
  },
  {
    id: 'chop', name: 'Sever', icon: '🪓', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.1,
    extraTargetCount: 1,
    overrideCooldownMs: 4000,
    description: 'cuts through the target and into one random enemy beside it - still fine to use one-on-one',
  },
  {
    id: 'slash', name: 'Lacerate', icon: '⚔️', unlockLevel: 6, type: 'damage',
    damageMultiplier: 0.85,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
    retrigger: { windowMs: 1200, sweetSpotStartPercent: 80, sweetSpotEndPercent: 100, buffDurationMs: 9000 },
    overrideCooldownMs: 4500,
    description: 'a cut that bleeds for extra damage a moment later - press it again right after landing to buff your other abilities for a while',
  },
  {
    id: 'sweep', name: 'Faultline', icon: '🪨', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.3,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
    widenBonusTargets: 1,
    aoe: true,
    overrideCooldownMs: 5000,
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

export function canUseAbility({ locked, onCooldown, retriggerWindowOpen }) {
  if (locked) return false;
  // Lacerate's own self-retrigger window (see js/screens/battleScreen.js)
  // makes its button clickable again despite still being on cooldown - a
  // deliberately different input than a normal reuse.
  if (retriggerWindowOpen) return true;
  return !onCooldown;
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
    monsterAtb: rollKnockback(monster.atb, ATB_KNOCKBACK, rng),
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
