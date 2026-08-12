const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '...............',
  '..............#',
  '..............#',
  '......~~......#',
  '......~~......#',
  '..............#',
  '..............#',
  '.........##...#',
  '..............#',
  '..............#',
  '...............',
];

export const eastMap = {
  id: 'east',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.1,
  monsterTable: ['boar', 'bat', 'snake', 'goblin'],
  neighbors: { north: 'northeast', south: 'southeast', east: null, west: 'center' },
};
