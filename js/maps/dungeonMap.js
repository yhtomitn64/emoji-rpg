const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  E: 'exit',
  B: 'boss',
};

const ROWS = [
  '####################',
  '#E.................#',
  '#..................#',
  '#..#####...#####...#',
  '#..#.......#...#...#',
  '#..#..######...#...#',
  '#..#........#..#...#',
  '#...........#..#...#',
  '#............#.#...#',
  '#.............##..B#',
  '####################',
];

export const dungeonMap = {
  id: 'dungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.2,
  monsterTable: ['direWolf', 'spider'],
  bossMonsterId: 'dragon',
};
