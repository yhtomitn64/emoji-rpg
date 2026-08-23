export const MONSTERS = {
  boar: {
    id: 'boar', name: 'Snorty McPigface', emoji: '🐗',
    hp: 77, attack: 10, defense: 1, speed: 4,
    xp: 16, goldRange: [4, 8],
    dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  bat: {
    id: 'bat', name: 'Spooky Pancake', emoji: '🦇',
    hp: 55, attack: 9, defense: 0, speed: 7,
    xp: 11, goldRange: [2, 7],
    dropTable: [{ itemId: 'batWing', chance: 0.25 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  snake: {
    id: 'snake', name: 'Slippery Breadstick', emoji: '🐍',
    hp: 60, attack: 10, defense: 1, speed: 5,
    xp: 16, goldRange: [4, 9],
    dropTable: [{ itemId: 'snakeFang', chance: 0.25 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  goblin: {
    id: 'goblin', name: 'Mean Meatball', emoji: '👺',
    hp: 67, attack: 10, defense: 2, speed: 4,
    xp: 22, goldRange: [5, 13],
    dropTable: [
      { itemId: 'goblinClub', chance: 0.15 },
      { itemId: 'ironScrap', chance: 0.2 },
      { itemId: 'potion', chance: 0.1 },
    ],
    attackStyle: 'ranged', projectileEmoji: '🍙',
  },
  direWolf: {
    id: 'direWolf', name: 'Mega Muffin', emoji: '🐺',
    hp: 100, attack: 14, defense: 3, speed: 6,
    xp: 32, goldRange: [8, 15],
    dropTable: [{ itemId: 'wolfPelt', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  spider: {
    id: 'spider', name: 'Eight-Leg Eggroll', emoji: '🕷️',
    hp: 85, attack: 12, defense: 2, speed: 5,
    xp: 29, goldRange: [7, 14],
    dropTable: [{ itemId: 'spiderSilk', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'ranged', projectileEmoji: '🥟',
  },
  frog: {
    id: 'frog', name: 'Ribbity Ravioli', emoji: '🐸',
    hp: 58, attack: 9, defense: 1, speed: 6,
    xp: 13, goldRange: [3, 8],
    dropTable: [{ itemId: 'frogSkin', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  scorpion: {
    id: 'scorpion', name: 'Spicy Skewer', emoji: '🦂',
    hp: 90, attack: 13, defense: 3, speed: 6,
    xp: 30, goldRange: [7, 15],
    dropTable: [{ itemId: 'scorpionVenom', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  dragon: {
    id: 'dragon', name: 'Dragon', emoji: '🐉',
    hp: 150, attack: 34, defense: 12, speed: 11,
    xp: 200, goldRange: [65, 100],
    dropTable: [
      { itemId: 'dragonScaleMail', chance: 0.6 },
      { itemId: 'dragonFang', chance: 0.4 },
    ],
    isBoss: true,
    attackStyle: 'ranged', projectileEmoji: '🔥',
  },
  // Dungeon tier. Attack is deliberately set well above the ~19-22 defense a
  // player reaches with the full iron shop set, so stacking cheap defense no
  // longer drops these to the calculateDamage 1-point floor. See
  // scripts/simulate-balance.js for the tuning evidence.
  orc: {
    id: 'orc', name: 'Super Mean Meatloaf', emoji: '👹',
    hp: 180, attack: 32, defense: 8, speed: 8,
    xp: 60, goldRange: [18, 28],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }, { itemId: 'miningPick', chance: 0.25 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
    // Optional field: dungeon-tier only. ~35% chance to replace generic "A wild X appears!" (see pickAppearLine in js/systems/combat.js).
    flavorLines: [
      'You smell burnt garlic bread. Super Mean Meatloaf has entered the room.',
      'Super Mean Meatloaf lumbers out of the shadows, still steaming with rage.',
      'Super Mean Meatloaf glares at you like you insulted its secret recipe.',
    ],
  },
  wraith: {
    id: 'wraith', name: 'Ghost Apple Supreme', emoji: '👻',
    hp: 170, attack: 32, defense: 4, speed: 11,
    xp: 63, goldRange: [18, 30],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }, { itemId: 'axe', chance: 0.25 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'ranged', projectileEmoji: '🍎',
    flavorLines: [
      'A chill rolls in. Ghost Apple Supreme has come for seconds.',
      'Ghost Apple Supreme drifts through the wall, unnervingly translucent and smelling faintly of cinnamon.',
      'Ghost Apple Supreme rattles its core ominously.',
    ],
  },
  skeleton: {
    id: 'skeleton', name: 'Bone-in Biscuit', emoji: '💀',
    hp: 175, attack: 32, defense: 6, speed: 9,
    xp: 61, goldRange: [18, 29],
    dropTable: [{ itemId: 'boneFragment', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'ranged', projectileEmoji: '🦴',
    flavorLines: [
      'Bones rattle in the dark. Bone-in Biscuit clatters toward you.',
      'Something crunches underfoot — Bone-in Biscuit was already here.',
      'Bone-in Biscuit assembles itself from the rubble, grinning without lips.',
    ],
  },
};
