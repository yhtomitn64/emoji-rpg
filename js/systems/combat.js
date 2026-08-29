import { applyHeal } from './inventory.js';

export const ATB_MAX = 100;

export function calculateDamage(attacker, defender, rng = Math.random) {
  const base = Math.max(1, attacker.attack - defender.defense);
  const variance = 0.85 + rng() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

export function tickGauge(currentAtb, speed, dt) {
  return Math.min(ATB_MAX, currentAtb + speed * dt);
}

export function isReady(atb) {
  return atb >= ATB_MAX;
}

export const ATB_KNOCKBACK = 15;

export function applyKnockback(atb, amount) {
  return Math.max(0, atb - amount);
}

// A player who has invested enough in speed (leveling and/or gear like Wind
// Greaves) to reach this threshold gets a small damage bonus, so speed stays
// worth chasing past the point where it's already fast enough to act often.
export const SPEED_DAMAGE_BONUS_THRESHOLD = 20;
export const SPEED_DAMAGE_BONUS_MULTIPLIER = 1.1;

export function applySpeedDamageBonus(damage, speed) {
  return speed >= SPEED_DAMAGE_BONUS_THRESHOLD ? Math.round(damage * SPEED_DAMAGE_BONUS_MULTIPLIER) : damage;
}

export function applyEnemySlow(speed, slowPercent) {
  return Math.max(1, Math.round(speed * (1 - slowPercent / 100)));
}

export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.5;

// bonusChance is a fraction (0.08 = +8 percentage points), same scale as
// CRIT_CHANCE itself - callers convert an item's critChancePercent stat
// (e.g. 8) by dividing by 100 before passing it in.
export function rollCrit(rng = Math.random, bonusChance = 0) {
  return rng() < CRIT_CHANCE + bonusChance;
}

export function applyCritMultiplier(damage, isCrit) {
  return isCrit ? Math.round(damage * CRIT_MULTIPLIER) : damage;
}

// Single source of truth for "what happens when X attacks Y" - both
// battleScreen.js (the real UI) and scripts/simulate-balance.js (the
// headless balance report) call these exact functions, so the damage/crit/
// knockback/speed-bonus/heal formulas can never drift out of sync between
// what's shipped and what's being balance-tested. Only the surrounding loop
// (whose turn it is, when to act) stays separate - that's driven by real
// user input in one and an AI policy in the other, and can't be unified the
// same way.
// (abilities added in the Phase 1 combat-abilities build are deliberately
// not modeled here — see
// docs/superpowers/specs/2026-08-17-combat-abilities-design.md)
// (the parry wind-up added in this build is also not modeled here — monsters
// still attack the instant their ATB is ready in this simulation; see
// docs/superpowers/specs/2026-08-18-parry-mechanic-design.md)

// Attack has no swing-timer gate (see battleScreen.js) and only a short flat
// cooldown (also battleScreen.js, real-time not ATB) - the actual tradeoff
// that keeps spamming it from being strictly optimal lives here: each
// consecutive press without landing an ability or letting the gauge refill
// deals less damage (down to a floor, never to nothing) AND knocks the
// enemy's gauge back less (down to nothing) - so sustained spam eventually
// stops suppressing the enemy's turn entirely, however fast it's clicked.
export const ATTACK_STREAK_DECAY = 0.35;
export const ATTACK_STREAK_FLOOR = 0.4;

// Each unlocked ability (Stab/Chop/Slash/Sweep/Super Scream) drags the floor
// down further - Attack has to stay usable at level 1 when it's the only
// option, but should matter less and less once there's a real rotation to
// lean on, bottoming out at a 0% floor once all 5 are unlocked (level 10).
export const ATTACK_STREAK_FLOOR_PER_ABILITY = ATTACK_STREAK_FLOOR / 5;

export function attackStreakMultiplier(streak, unlockedAbilityCount = 0) {
  const floor = Math.max(0, ATTACK_STREAK_FLOOR - unlockedAbilityCount * ATTACK_STREAK_FLOOR_PER_ABILITY);
  return Math.max(floor, 1 - streak * ATTACK_STREAK_DECAY);
}

// A decayed streak used to reset the instant the player's own ATB gauge
// next read as "full" - but that gauge caps at ATB_MAX (tickGauge clamps
// it), so it can't be pushed higher to represent a slower passive recharge,
// and abilities read the exact same gauge for their own readiness. Timothy's
// call: "the recharge... should be really slow" - decoupled into its own
// real-time idle timer instead (battleScreen.js/simulate-balance.js each
// track their own countdown using this shared constant), separate from the
// ATB gauge abilities still gate on. Landing an ability still resets the
// streak instantly, unaffected - only the "just wait it out" path is slow.
export const ATTACK_STREAK_RECOVERY_MS = 8000;

// Decays faster than the damage multiplier above and has no floor - reaches
// exactly 0 by streak 3, unlike damage which only ever floors at 40%. This is
// what actually closes the "attack spam locks the enemy out forever" hole:
// once knockback is fully gone, the enemy's own speed-driven gauge growth is
// uncontested and it's guaranteed to eventually wind up, regardless of click
// rate.
export const ATTACK_KNOCKBACK_DECAY = 0.34;

export function attackKnockbackMultiplier(streak) {
  return Math.max(0, 1 - streak * ATTACK_KNOCKBACK_DECAY);
}

// Damage/knockback decay alone still left sustained spam (a flat 500ms
// cooldown forever, floored at 40% damage) out-DPSing the ability rotation
// the balance pass was tuned around - real playtesting found fights still
// too easy this way. This is the actual throttle: the cooldown itself grows
// with the streak, uncapped, so continuing to spam gets slower and slower
// rather than settling into a sustainable rhythm.
export const ATTACK_COOLDOWN_BASE_MS = 500;
export const ATTACK_COOLDOWN_GROWTH_MS = 200;

export function attackCooldownMsForStreak(streak) {
  return ATTACK_COOLDOWN_BASE_MS + streak * ATTACK_COOLDOWN_GROWTH_MS;
}

export function resolvePlayerAttack(player, monster, rng = Math.random, streakMultiplier = 1, knockbackMultiplier = 1, critChanceBonus = 0) {
  const isCrit = rollCrit(rng, critChanceBonus);
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * streakMultiplier);
  damage = applyCritMultiplier(damage, isCrit);
  damage = applySpeedDamageBonus(damage, player.speed);
  return {
    damage,
    isCrit,
    monsterHp: Math.max(0, monster.hp - damage),
    monsterAtb: applyKnockback(monster.atb, ATB_KNOCKBACK * knockbackMultiplier),
    playerAtb: 0,
  };
}

export function resolveMonsterAttack(monster, player, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(monster, player, rng);
  damage = applyCritMultiplier(damage, isCrit);
  return {
    damage,
    isCrit,
    playerHp: Math.max(0, player.hp - damage),
    playerAtb: applyKnockback(player.atb, ATB_KNOCKBACK),
    monsterAtb: 0,
  };
}

export function resolvePotionUse(player, healAmount, rng = Math.random, critChanceBonus = 0) {
  const isCrit = rollCrit(rng, critChanceBonus);
  const heal = applyCritMultiplier(healAmount, isCrit);
  return {
    heal,
    isCrit,
    playerHp: applyHeal(player.hp, player.maxHp, heal),
  };
}

// A monster the player can kill within this many hits (average damage roll)
// is a candidate for surrendering/fleeing instead of fighting to the death -
// see resolveWeakMobEncounter below.
export const WEAK_MOB_HITS_TO_KILL_THRESHOLD = 3;
export const WEAK_MOB_TRIGGER_CHANCE = 0.35;

export function isMonsterOutclassed(player, monster) {
  const averageDamage = calculateDamage(player, monster, () => 0.5);
  const hitsToKill = Math.ceil(monster.hp / averageDamage);
  return hitsToKill <= WEAK_MOB_HITS_TO_KILL_THRESHOLD;
}

// Bosses never surrender/flee (they already can't be fled from), so isBoss
// short-circuits regardless of how outclassed they are. Otherwise, an
// outclassed monster has a WEAK_MOB_TRIGGER_CHANCE shot at a three-way split:
// giving up outright (full win rewards), fleeing but dropping loot on the way
// out, or fleeing with nothing.
export function resolveWeakMobEncounter(player, monster, isBoss, rng = Math.random) {
  if (isBoss) return null;
  if (!isMonsterOutclassed(player, monster)) return null;
  if (rng() >= WEAK_MOB_TRIGGER_CHANCE) return null;
  const roll = rng();
  if (roll < 1 / 3) return 'surrender';
  if (roll < 2 / 3) return 'fled-with-loot';
  return 'fled-empty';
}

export const FLAVOR_LINE_CHANCE = 0.35;

export function pickAppearLine(monster, rng = Math.random) {
  const lines = monster.flavorLines;
  if (!lines || lines.length === 0 || rng() >= FLAVOR_LINE_CHANCE) {
    return `A wild ${monster.name} appears!`;
  }
  const index = Math.floor(rng() * lines.length);
  return lines[index];
}
