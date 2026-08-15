export const STORAGE_KEY = 'emoji-rpg-save';

export function createNewGame() {
  return {
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20 },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null },
    upgrades: {},
    inventory: [{ itemId: 'potion', quantity: 2 }],
    map: 'center',
    position: null,
    flags: { dungeonBossDefeated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
  };
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(json) {
  return JSON.parse(json);
}

export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, serializeState(state));
}

export function loadState(storage = globalThis.localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return deserializeState(raw);
}
