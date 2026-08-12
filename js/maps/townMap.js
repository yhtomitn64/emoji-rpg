const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  E: 'exit',
};

const ROWS = [
  '########',
  '#......#',
  '#.S..M.#',
  '#......#',
  '#..E...#',
  '########',
];

export const townMap = {
  id: 'town',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 3, y: 3 },
  encounterChance: 0,
  monsterTable: [],
};
