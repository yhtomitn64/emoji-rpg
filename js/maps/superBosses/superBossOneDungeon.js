const LEGEND = { '#': 'caveWall', E: 'exit', '.': 'caveFloor', G: 'guardian' };

const ROWS = [
  '##############',
  '#E.....#.....#',
  '#......#.....#',
  '#......#.....#',
  '#............#',
  '#......#.....#',
  '#......#....G#',
  '##############',
];

export const superBossOneDungeonMap = {
  id: 'superBossOneDungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
  guardianMonsterId: 'superBossOne',
};
