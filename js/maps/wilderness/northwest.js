const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '##############.',
  '#..............',
  '#..............',
  '#.....~~.......',
  '#.....~~.......',
  '#..............',
  '#..............',
  '#........##....',
  '#..............',
  '#..............',
  '...............',
];

export const northwestMap = {
  id: 'northwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: null, south: 'west', east: 'north', west: null },
};
