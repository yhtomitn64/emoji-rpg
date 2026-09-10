import { createNewGame, saveState, loadState, slotSaveKey, STORAGE_KEY, deserializeState, DEFAULT_HERO_EMOJI } from '../state.js';

const SLOTS_KEY = 'emoji-rpg-slots';

function readRegistry(storage) {
  const raw = storage.getItem(SLOTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeRegistry(entries, storage) {
  storage.setItem(SLOTS_KEY, JSON.stringify(entries));
}

function generateSlotId() {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listSlots(storage = globalThis.localStorage) {
  return readRegistry(storage);
}

export function createSlot(name, heroEmoji = DEFAULT_HERO_EMOJI, storage = globalThis.localStorage) {
  const id = generateSlotId();
  const state = createNewGame(heroEmoji);
  const now = Date.now();
  const entries = readRegistry(storage);
  entries.push({ id, name, createdAt: now, lastPlayed: now, level: state.player.level, ngPlusCycle: state.ngPlusCycle });
  writeRegistry(entries, storage);
  saveState(state, id, storage);
  return { id, state };
}

// Adds a brand-new slot from an already-existing character (not
// createNewGame() like createSlot) - used by cloud save (js/screens/
// settingsScreen.js) so loading a save from another device/browser adds it
// alongside whatever's already on this one, rather than overwriting
// anything. Raised 2026-09-09: "be cool to do this in a way that you can
// transfer from whatever number of other browsers you want and it just
// adds all the characters to your list."
export function importSlot(name, state, storage = globalThis.localStorage) {
  const id = generateSlotId();
  const now = Date.now();
  const entries = readRegistry(storage);
  entries.push({ id, name, createdAt: now, lastPlayed: now, level: state.player.level, ngPlusCycle: state.ngPlusCycle });
  writeRegistry(entries, storage);
  saveState(state, id, storage);
  return { id, state };
}

// Finds an existing local slot whose save carries the same characterId
// (js/state.js) as the one given, or null if none does - used by cloud-save
// import (js/main.js) to recognize "this is an update to a character
// already on this browser" instead of always creating a duplicate slot,
// which is what a plain name comparison can't reliably tell you (raised
// 2026-09-09: "what if you import characters with the same name? how do we
// know it's the same character"). O(n) full-state reads across all slots -
// fine at the scale this is ever called (Settings/Character-Select import,
// not a hot path), and only ever matches saves that already went through
// migrateCharacterId (js/state.js) - a characterId-less import (state
// exported before that migration existed) never matches anything, so it
// falls through to the normal new-slot flow untouched.
export function findSlotByCharacterId(characterId, storage = globalThis.localStorage) {
  if (!characterId) return null;
  for (const entry of readRegistry(storage)) {
    const saved = loadState(entry.id, storage);
    if (saved?.characterId === characterId) return { id: entry.id, name: entry.name, state: saved };
  }
  return null;
}

// Overwrites (not appends) any existing entry with this exact id, unlike
// createSlot's always-fresh generateSlotId() - used by
// js/systems/debugCharacters.js so revisiting the same debug URL always
// resets that slot back to its canonical hardcoded state instead of
// layering onto whatever got left over from a previous test session.
export function upsertSlot(id, name, state, storage = globalThis.localStorage) {
  const now = Date.now();
  const entries = readRegistry(storage).filter((entry) => entry.id !== id);
  entries.push({ id, name, createdAt: now, lastPlayed: now, level: state.player.level, ngPlusCycle: state.ngPlusCycle });
  writeRegistry(entries, storage);
  saveState(state, id, storage);
}

export function deleteSlot(id, storage = globalThis.localStorage) {
  const entries = readRegistry(storage).filter((entry) => entry.id !== id);
  writeRegistry(entries, storage);
  storage.removeItem(slotSaveKey(id));
}

export function touchSlot(id, summary, storage = globalThis.localStorage) {
  const entries = readRegistry(storage);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  entry.lastPlayed = Date.now();
  entry.level = summary.level;
  entry.ngPlusCycle = summary.ngPlusCycle;
  writeRegistry(entries, storage);
}

export function migrateLegacySave(storage = globalThis.localStorage) {
  if (storage.getItem(SLOTS_KEY)) return;
  const legacyRaw = storage.getItem(STORAGE_KEY);
  if (!legacyRaw) return;
  const state = deserializeState(legacyRaw);
  const id = generateSlotId();
  const now = Date.now();
  writeRegistry([{ id, name: 'Save', createdAt: now, lastPlayed: now, level: state.player.level, ngPlusCycle: state.ngPlusCycle || 0 }], storage);
  saveState(state, id, storage);
  storage.removeItem(STORAGE_KEY);
}
