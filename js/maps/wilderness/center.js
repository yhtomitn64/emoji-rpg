const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  '~': 'water',
  T: 'townEntrance',
};

const ROWS = [
  '...............',
  '...............',
  '...............',
  '......~~.......',
  '......~~.......',
  '.......T.......',
  '...............',
  '.........##....',
  '...............',
  '...............',
  '...............',
];

export const centerMap = {
  id: 'center',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 6 },
  encounterChance: 0,
  monsterTable: [],
  neighbors: { north: 'north', south: 'south', east: 'east', west: 'west' },
};
