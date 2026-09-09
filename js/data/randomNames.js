// Word bank for the start screen's "Random Character" button - curated
// from words already used elsewhere in the game (monster names in
// js/data/monsters.js, item names in js/data/items.js, ability names in
// js/systems/abilities.js) rather than invented fresh, so a random name
// still feels like it belongs in this game's world. Combined as
// "prefix suffix" (e.g. "Iron Impale", "Spooky Fang").
export const NAME_PREFIXES = [
  'Iron', 'Dragon', 'Spooky', 'Mega', 'Lucky', 'Wind', 'Fossil', 'Super',
  'Ghost', 'Eight-Leg', 'Fault', 'Power', 'Mean', 'Jurassic', 'Slippery',
];
export const NAME_SUFFIXES = [
  'Fang', 'Scale', 'Muffin', 'Pancake', 'Blade', 'Greaves', 'Charm',
  'Ring', 'Impale', 'Lacerate', 'Sever', 'Eggroll', 'Breadstick', 'Jerky',
];

export function generateRandomName(rng = Math.random) {
  const prefix = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)];
  const suffix = NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}
