export const ABILITIES = [
  {
    id: 'stab', name: 'Stab', unlockLevel: 2, type: 'damage',
    damageMultiplier: 1.3, cooldownMs: 4000,
  },
  {
    id: 'chop', name: 'Chop', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.8, cooldownMs: 10000,
  },
  {
    id: 'slash', name: 'Slash', unlockLevel: 6, type: 'damage',
    damageMultiplier: 1.0, cooldownMs: 6000,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
  },
  {
    id: 'sweep', name: 'Sweep', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.5, cooldownMs: 12000,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
  },
  {
    id: 'superScream', name: 'Super Scream', unlockLevel: 10, type: 'buff',
    cooldownMs: 30000, buffDurationMs: 12000, buffMultiplier: 1.4,
  },
];

export function getUnlockedAbilities(level) {
  return ABILITIES.filter((ability) => ability.unlockLevel <= level);
}
