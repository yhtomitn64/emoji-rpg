const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '.##############',
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

export const northeastMap = {
  id: 'northeast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: null, south: 'east', east: null, west: 'north' },
};
