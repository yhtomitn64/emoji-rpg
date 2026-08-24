export const SHOP_CATALOG = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves',
  'powerRing', 'clothCap', 'clothTunic', 'clothPants', 'luckyCharm', 'potion',
  'windGreaves', 'frostCharm',
];

export const ITEMS = {
  // Weapons
  starterSword: { id: 'starterSword', name: 'Starter Sword', emoji: '🗡️', slot: 'weapon', price: 0, stats: { attack: 3 }, startingItem: true },
  ironSword: { id: 'ironSword', name: 'Iron Sword', emoji: '⚔️', slot: 'weapon', price: 30, stats: { attack: 6 } },
  goblinClub: { id: 'goblinClub', name: 'Goblin Club', emoji: '🏏', slot: 'weapon', price: 0, stats: { attack: 8 } },
  dragonFang: { id: 'dragonFang', name: 'Dragon Fang Blade', emoji: '🦷', slot: 'weapon', price: 0, stats: { attack: 14 } },
  fossilFang: { id: 'fossilFang', name: 'Fossil Fang', emoji: '🦖', slot: 'weapon', price: 0, stats: { attack: 12 } },

  // Head
  clothCap: { id: 'clothCap', name: 'Cloth Cap', emoji: '🧢', slot: 'head', price: 15, stats: { defense: 1 } },
  ironHelm: { id: 'ironHelm', name: 'Iron Helm', emoji: '⛑️', slot: 'head', price: 35, stats: { defense: 3 } },

  // Body
  clothTunic: { id: 'clothTunic', name: 'Cloth Tunic', emoji: '👕', slot: 'body', price: 20, stats: { defense: 2, maxHp: 4 } },
  ironArmor: { id: 'ironArmor', name: 'Iron Armor', emoji: '🥋', slot: 'body', price: 45, stats: { defense: 5, maxHp: 8 } },
  dragonScaleMail: { id: 'dragonScaleMail', name: 'Dragon Scale Mail', emoji: '🐲', slot: 'body', price: 0, stats: { defense: 10, maxHp: 15 } },

  // Legs
  clothPants: { id: 'clothPants', name: 'Cloth Pants', emoji: '👖', slot: 'legs', price: 15, stats: { defense: 1, speed: 1 } },
  ironGreaves: { id: 'ironGreaves', name: 'Iron Greaves', emoji: '🦵', slot: 'legs', price: 30, stats: { defense: 3 } },
  windGreaves: { id: 'windGreaves', name: 'Wind Greaves', emoji: '👢', slot: 'legs', price: 40, stats: { defense: 1, speed: 4 } },

  // Accessory
  luckyCharm: { id: 'luckyCharm', name: 'Lucky Charm', emoji: '🍀', slot: 'accessory', price: 25, stats: { speed: 2 } },
  powerRing: { id: 'powerRing', name: 'Power Ring', emoji: '💍', slot: 'accessory', price: 40, stats: { attack: 2 } },
  frostCharm: { id: 'frostCharm', name: 'Frost Charm', emoji: '❄️', slot: 'accessory', price: 40, stats: { enemySlowPercent: 15 }, description: "Slows the enemy's attack timer by 15%" },

  // Consumables
  potion: { id: 'potion', name: 'Potion', emoji: '🧪', type: 'consumable', price: 10, heal: 15 },

  // Materials
  leatherScrap: { id: 'leatherScrap', name: 'Leather Scrap', emoji: '🟫', type: 'material', upgradeSlot: 'body' },
  batWing: { id: 'batWing', name: 'Bat Wing', emoji: '🦴', type: 'material', upgradeSlot: 'accessory' },
  snakeFang: { id: 'snakeFang', name: 'Snake Fang', emoji: '🦷', type: 'material', upgradeSlot: 'weapon' },
  ironScrap: { id: 'ironScrap', name: 'Iron Scrap', emoji: '🔩', type: 'material', upgradeSlot: 'weapon' },
  wolfPelt: { id: 'wolfPelt', name: 'Wolf Pelt', emoji: '🐾', type: 'material', upgradeSlot: 'legs' },
  spiderSilk: { id: 'spiderSilk', name: 'Spider Silk', emoji: '🕸️', type: 'material', upgradeSlot: 'head' },
  orcTusk: { id: 'orcTusk', name: 'Orc Tusk', emoji: '🦷', type: 'material', upgradeSlot: 'weapon' },
  wraithEssence: { id: 'wraithEssence', name: 'Wraith Essence', emoji: '💠', type: 'material', upgradeSlot: 'accessory' },
  frogSkin: { id: 'frogSkin', name: 'Frog Skin', emoji: '🟢', type: 'material', upgradeSlot: 'body' },
  scorpionVenom: { id: 'scorpionVenom', name: 'Scorpion Venom', emoji: '💉', type: 'material', upgradeSlot: 'accessory' },
  boneFragment: { id: 'boneFragment', name: 'Bone Fragment', emoji: '🦴', type: 'material', upgradeSlot: 'head' },

  // Tools
  miningPick: { id: 'miningPick', name: 'Mining Pick', emoji: '⛏️', type: 'tool', price: 0, description: 'Clears mountain gates blocking the way' },
  axe: { id: 'axe', name: 'Axe', emoji: '🪓', type: 'tool', price: 0, description: 'Clears thicket gates blocking the way' },
  boat: { id: 'boat', name: 'Boat', emoji: '🛶', type: 'tool', price: 0, description: 'Lets you cross open water' },
};
