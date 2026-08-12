const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water' };

const ROWS = [
  '...............',
  '#..............',
  '#..............',
  '#.....~~.......',
  '#.....~~.......',
  '#..............',
  '#..............',
  '#........##....',
  '#..............',
  '#..............',
  '##############.',
];

export const southwestMap = {
  id: 'southwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: 'west', south: null, east: 'south', west: null },
};
