const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  Q: 'questBoard',
  E: 'exit',
  W: 'well',
};

const ROWS = [
  '########',
  '#..Q...#',
  '#.S..M.#',
  '#.....W#',
  '#..E...#',
  '########',
];

export const townMap = {
  id: 'town',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 3, y: 3 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
};
