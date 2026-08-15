export const MAX_BOSS_TIER = 2;
export const BOSS_TIER_HP_MULTIPLIER = 2;
export const BOSS_TIER_ATTACK_MULTIPLIER = 1.25;
export const BOSS_TIER_DEFENSE_MULTIPLIER = 1.25;

export const BOSS_TIER_FLAVOR_LINES = [
  "The dragon's scales gleam differently now — it's been sparring with things you haven't met yet.",
  'You catch its eye. It almost looks... pleased to see you again.',
  "Word is the dragon's been picking fights all over the mountain since your last visit.",
  'It stretches its wings, sizing you up. Ready for round two?',
  'The dragon rumbles low — something between a growl and a laugh. It remembers you.',
];

export function getBossTierStats(baseMonster, tier) {
  const hpMultiplier = BOSS_TIER_HP_MULTIPLIER ** tier;
  const attackMultiplier = BOSS_TIER_ATTACK_MULTIPLIER ** tier;
  const defenseMultiplier = BOSS_TIER_DEFENSE_MULTIPLIER ** tier;
  return {
    hp: Math.round(baseMonster.hp * hpMultiplier),
    attack: Math.round(baseMonster.attack * attackMultiplier),
    defense: Math.round(baseMonster.defense * defenseMultiplier),
    speed: baseMonster.speed,
    xp: Math.round(baseMonster.xp * hpMultiplier),
  };
}

export function pickBossReturnFlavor(rng = Math.random) {
  return BOSS_TIER_FLAVOR_LINES[Math.floor(rng() * BOSS_TIER_FLAVOR_LINES.length)];
}
