const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  E: 'exit',
  G: 'guardian',
};

const ROWS = [
  '##############',
  '#E...........#',
  '#............#',
  '#....##......#',
  '#.......#....#',
  '#............#',
  '#...........G#',
  '##############',
];

export const axeDungeonMap = {
  id: 'axeDungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
  guardianMonsterId: 'axeGuardian',
};
