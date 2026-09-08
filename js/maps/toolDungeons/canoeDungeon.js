const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  E: 'exit',
  G: 'guardian',
};

// Enlarged 14x8 -> 21x13, guardian recentered - see axeDungeon.js's own
// comment for the full rationale (2026-09-07).
const ROWS = [
  '#####################',
  '#E..................#',
  '#...................#',
  '#....##.............#',
  '#....##.............#',
  '#...................#',
  '#.........G.........#',
  '#...................#',
  '#...................#',
  '#............###....#',
  '#...................#',
  '#...................#',
  '#####################',
];

export const canoeDungeonMap = {
  id: 'canoeDungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
  guardianMonsterId: 'boatGuardian',
};
