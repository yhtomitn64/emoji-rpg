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
  '...............',
];

export const westMap = {
  id: 'west',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.1,
  monsterTable: ['boar', 'bat', 'snake', 'goblin'],
  neighbors: { north: 'northwest', south: 'southwest', east: 'center', west: null },
};
