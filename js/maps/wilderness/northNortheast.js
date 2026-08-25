const LEGEND = { '#': 'tree', '.': 'grass', M: 'mountain' };

const ROWS = [
  '##########....................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '.........MMMMMMMMMMMM.........',
  '........MMMMMMMMMMMMM.........',
  '.......MMMMMMMMMMMMMM.........',
  '.......MMMMM#########.........',
  '......MMMMM##########.........',
  '...MMMMMMM#######.............',
  'MMMMMMMMMM#####...............',
  'MMMMMMMMM######............###',
  'MMMMMMMMM######............##.',
  'MMMMMMMMMM#####...............',
  '......MMMMMM###...............',
  '......MMMMMM########..........',
  '......MMMMMMM#######..........',
  '.........MMMMMM######.........',
  '.........MMMMMMMMM###.........',
  '..........MMMMMMMM###.........',
  '............MMMMMMM##.........',
];

export const northNortheastMap = {
  id: 'northNortheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: null, south: 'northeast', east: 'farNortheast', west: 'farNorth' },
};
