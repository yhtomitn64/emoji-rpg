export const COMEBACK_POTION_CAP = 5;

export function incrementLossStreak(lossStreak) {
  return lossStreak + 1;
}

export function potionsForStreak(lossStreak) {
  return Math.min(lossStreak, COMEBACK_POTION_CAP);
}

export function getComebackMessage(potionsGranted) {
  if (potionsGranted === 1) {
    return 'Something takes pity on you — +1 potion to keep you going.';
  }
  return `Another rough one... +${potionsGranted} potions this time.`;
}
