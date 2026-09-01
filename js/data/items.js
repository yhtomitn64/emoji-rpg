export const SHOP_CATALOG = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves',
  'powerRing', 'clothCap', 'clothTunic', 'clothPants', 'luckyCharm', 'potion',
  'windGreaves', 'frostCharm',
  'strengthDraught', 'ironSkinTonic', 'swiftElixir', 'vampiricTonic', 'momentumElixir',
  'emberVial', 'thornbarkDraught', 'focusTonic', 'berserkerTonic', 'secondWind',
];

export const ITEMS = {
  // Weapons
  starterSword: { id: 'starterSword', name: 'Starter Sword', emoji: '🗡️', slot: 'weapon', price: 0, stats: { attack: 3 }, startingItem: true },
  ironSword: { id: 'ironSword', name: 'Iron Sword', emoji: '⚔️', slot: 'weapon', price: 30, stats: { attack: 6 } },
  goblinClub: { id: 'goblinClub', name: 'Goblin Club', emoji: '🏏', slot: 'weapon', price: 0, stats: { attack: 8 } },
  // swingEmoji: these two weapons' own inventory emoji is a body-part-flavor
  // pun (a literal tooth/dinosaur), not a weapon shape - fine in an
  // inventory row, but battleScreen.js's Attack swing (js/screens/
  // battleScreen.js's swingSpriteEmoji) should swing something blade-shaped
  // instead. Weapons without a swingEmoji override just swing their own
  // emoji, same as before.
  dragonFang: { id: 'dragonFang', name: 'Dragon Fang Blade', emoji: '🦷', swingEmoji: '🗡️', slot: 'weapon', price: 0, stats: { attack: 16 } },
  fossilFang: { id: 'fossilFang', name: 'Fossil Fang', emoji: '🦖', swingEmoji: '🗡️', slot: 'weapon', price: 0, stats: { attack: 14 } },

  // Head
  clothCap: { id: 'clothCap', name: 'Cloth Cap', emoji: '🧢', slot: 'head', price: 15, stats: { defense: 1 } },
  ironHelm: { id: 'ironHelm', name: 'Iron Helm', emoji: '⛑️', slot: 'head', price: 35, stats: { defense: 3 } },

  // Body
  clothTunic: { id: 'clothTunic', name: 'Cloth Tunic', emoji: '👕', slot: 'body', price: 20, stats: { defense: 2, maxHp: 4 } },
  ironArmor: { id: 'ironArmor', name: 'Iron Armor', emoji: '🥋', slot: 'body', price: 45, stats: { defense: 5, maxHp: 8 } },
  dragonScaleMail: { id: 'dragonScaleMail', name: 'Dragon Scale Mail', emoji: '🐲', slot: 'body', price: 0, stats: { defense: 12, maxHp: 18 } },

  // Legs
  clothPants: { id: 'clothPants', name: 'Cloth Pants', emoji: '👖', slot: 'legs', price: 15, stats: { defense: 1, speed: 1 } },
  ironGreaves: { id: 'ironGreaves', name: 'Iron Greaves', emoji: '🦵', slot: 'legs', price: 30, stats: { defense: 3 } },
  windGreaves: { id: 'windGreaves', name: 'Wind Greaves', emoji: '👢', slot: 'legs', price: 40, stats: { defense: 1, speed: 4 } },

  // Accessory
  luckyCharm: { id: 'luckyCharm', name: 'Lucky Charm', emoji: '🍀', slot: 'accessory', price: 25, stats: { speed: 2 } },
  powerRing: { id: 'powerRing', name: 'Power Ring', emoji: '💍', slot: 'accessory', price: 40, stats: { attack: 2 } },
  frostCharm: { id: 'frostCharm', name: 'Frost Charm', emoji: '❄️', slot: 'accessory', price: 40, stats: { enemySlowPercent: 15 }, description: "Slows the enemy's attack timer by 15%" },

  // Unique-effect drops (found only, never sold - see js/systems/loot.js's
  // UNIQUE_EFFECT_ITEM_IDS)
  // swingEmoji: same reasoning as dragonFang/fossilFang above - its own
  // emoji is a bone pun, not a weapon shape.
  vampiricFang: { id: 'vampiricFang', name: 'Vampiric Fang', emoji: '🦴', swingEmoji: '🗡️', slot: 'weapon', price: 0,
    stats: { attack: 7, lifestealPercent: 15 } },
  swiftStrikeCharm: { id: 'swiftStrikeCharm', name: 'Swift Strike Charm', emoji: '🔮', slot: 'accessory', price: 0,
    stats: { extraSwingChance: 10 } },
  emberRing: { id: 'emberRing', name: 'Ember Ring', emoji: '🔥', slot: 'ring', price: 0,
    stats: { elementalProcChance: 20, elementalProcDamage: 6 } },
  keenEye: { id: 'keenEye', name: 'Keen Eye', emoji: '👁️', slot: 'accessory', price: 0,
    stats: { critChancePercent: 8 } },
  // NG+-exclusive - see js/systems/loot.js's eligibleUniqueEffectPool,
  // gated on ngPlusOnly + (for windfuryRing) the ring toughness floor.
  retributionCharm: { id: 'retributionCharm', name: 'Retribution Charm', emoji: '🪞', slot: 'accessory', price: 0,
    stats: { thornsPercent: 20 }, ngPlusOnly: true },
  windfuryRing: { id: 'windfuryRing', name: 'Windfury Ring', emoji: '💍', slot: 'ring', price: 0,
    stats: { extraSwingChance: 10, critChancePercent: 8 }, ngPlusOnly: true },

  // Consumables
  potion: { id: 'potion', name: 'Potion', emoji: '🧪', type: 'consumable', price: 10, heal: 15 },

  // Buff potions - see docs/superpowers/specs/2026-08-31-buff-potions-design.md.
  // buffDurationMs marks the 8 timed ones; js/systems/buffPotions.js reads
  // it (plus `stats`, same shape/source of truth as equipped gear) to know
  // which consumables are timed buffs vs. the 2 one-shots below, which have
  // no stats/duration at all - their effect is a flag battleScreen.js sets
  // directly (see drinkPotion()/consumeGuaranteedCritBonus()/monsterAttack()).
  strengthDraught: { id: 'strengthDraught', name: 'Strength Draught', emoji: '💥', type: 'consumable', price: 35, stats: { attack: 6 }, buffDurationMs: 12000 },
  ironSkinTonic: { id: 'ironSkinTonic', name: 'Iron Skin Tonic', emoji: '🛡️', type: 'consumable', price: 35, stats: { defense: 4 }, buffDurationMs: 12000 },
  swiftElixir: { id: 'swiftElixir', name: 'Swift Elixir', emoji: '💨', type: 'consumable', price: 30, stats: { speed: 4 }, buffDurationMs: 12000 },
  vampiricTonic: { id: 'vampiricTonic', name: 'Vampiric Tonic', emoji: '🩸', type: 'consumable', price: 35, stats: { lifestealPercent: 15 }, buffDurationMs: 12000 },
  momentumElixir: { id: 'momentumElixir', name: 'Momentum Elixir', emoji: '🌀', type: 'consumable', price: 40, stats: { extraSwingChance: 12 }, buffDurationMs: 12000 },
  emberVial: { id: 'emberVial', name: 'Ember Vial', emoji: '🔥', type: 'consumable', price: 40, stats: { elementalProcChance: 20, elementalProcDamage: 5 }, buffDurationMs: 12000 },
  thornbarkDraught: { id: 'thornbarkDraught', name: 'Thornbark Draught', emoji: '🪵', type: 'consumable', price: 30, stats: { thornsPercent: 20 }, buffDurationMs: 12000 },
  focusTonic: { id: 'focusTonic', name: 'Focus Tonic', emoji: '🎯', type: 'consumable', price: 35, stats: { critChancePercent: 10 }, buffDurationMs: 12000 },
  berserkerTonic: { id: 'berserkerTonic', name: 'Berserker Tonic', emoji: '💢', type: 'consumable', price: 60, description: 'Your next hit is a guaranteed critical' },
  secondWind: { id: 'secondWind', name: 'Second Wind', emoji: '🕊️', type: 'consumable', price: 120, description: 'Survive one lethal hit at 1 HP this battle' },

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
  // Reforge material for the Mythic tier (js/systems/inventory.js's
  // reforgeToMythic) - no upgradeSlot, since it's collected generically
  // rather than per-slot like the other materials above.
  mythicEssence: { id: 'mythicEssence', name: 'Mythic Essence', emoji: '💎', type: 'material' },

  // Tools
  miningPick: { id: 'miningPick', name: 'Mining Pick', emoji: '⛏️', type: 'tool', price: 0, description: 'Clears mountain gates blocking the way' },
  axe: { id: 'axe', name: 'Axe', emoji: '🪓', type: 'tool', price: 0, description: 'Clears thicket gates blocking the way' },
  boat: { id: 'boat', name: 'Boat', emoji: '🛶', type: 'tool', price: 0, description: 'Lets you cross open water' },
};
