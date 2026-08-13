export const MONSTERS = {
  boar: {
    id: 'boar', name: 'Boar', emoji: '🐗',
    hp: 12, attack: 4, defense: 1, speed: 4,
    xp: 8, goldRange: [2, 5],
    dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }],
  },
  bat: {
    id: 'bat', name: 'Bat', emoji: '🦇',
    hp: 8, attack: 3, defense: 0, speed: 7,
    xp: 6, goldRange: [1, 4],
    dropTable: [{ itemId: 'batWing', chance: 0.25 }],
  },
  snake: {
    id: 'snake', name: 'Snake', emoji: '🐍',
    hp: 10, attack: 5, defense: 1, speed: 5,
    xp: 9, goldRange: [2, 6],
    dropTable: [{ itemId: 'snakeFang', chance: 0.25 }],
  },
  goblin: {
    id: 'goblin', name: 'Goblin', emoji: '👺',
    hp: 15, attack: 6, defense: 2, speed: 4,
    xp: 12, goldRange: [3, 8],
    dropTable: [
      { itemId: 'goblinClub', chance: 0.15 },
      { itemId: 'ironScrap', chance: 0.2 },
    ],
  },
  direWolf: {
    id: 'direWolf', name: 'Dire Wolf', emoji: '🐺',
    hp: 22, attack: 8, defense: 3, speed: 6,
    xp: 20, goldRange: [5, 10],
    dropTable: [{ itemId: 'wolfPelt', chance: 0.3 }],
  },
  spider: {
    id: 'spider', name: 'Giant Spider', emoji: '🕷️',
    hp: 18, attack: 7, defense: 2, speed: 5,
    xp: 18, goldRange: [4, 9],
    dropTable: [{ itemId: 'spiderSilk', chance: 0.3 }],
  },
  dragon: {
    id: 'dragon', name: 'Dragon', emoji: '🐉',
    hp: 110, attack: 35, defense: 12, speed: 11,
    xp: 150, goldRange: [50, 80],
    dropTable: [
      { itemId: 'dragonScaleMail', chance: 0.6 },
      { itemId: 'dragonFang', chance: 0.4 },
    ],
    isBoss: true,
  },
  // Dungeon tier. Attack is deliberately set well above the ~19-22 defense a
  // player reaches with the full iron shop set, so stacking cheap defense no
  // longer drops these to the calculateDamage 1-point floor. See
  // scripts/simulate-balance.js for the tuning evidence.
  orc: {
    id: 'orc', name: 'Orc', emoji: '👹',
    hp: 40, attack: 26, defense: 8, speed: 8,
    xp: 40, goldRange: [12, 20],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', emoji: '👻',
    hp: 38, attack: 26, defense: 4, speed: 11,
    xp: 42, goldRange: [12, 22],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }],
  },
};
