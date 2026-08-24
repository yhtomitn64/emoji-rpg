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

export const pickDungeonMap = {
  id: 'pickDungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
  guardianMonsterId: 'pickGuardian',
};
