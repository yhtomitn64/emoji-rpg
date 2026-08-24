import { createNewGame, saveState, slotSaveKey, STORAGE_KEY, deserializeState, DEFAULT_HERO_EMOJI } from '../state.js';
import { pickRandomEntrancePosition } from './dungeonEntrance.js';
import { farNortheastMap } from '../maps/wilderness/farNortheast.js';
import { farNorthwestMap } from '../maps/wilderness/farNorthwest.js';
import { farSoutheastMap } from '../maps/wilderness/farSoutheast.js';
import { farSouthwestMap } from '../maps/wilderness/farSouthwest.js';

const CORNER_MAPS = { farNortheast: farNortheastMap, farNorthwest: farNorthwestMap, farSoutheast: farSoutheastMap, farSouthwest: farSouthwestMap };

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
  const state = createNewGame(heroEmoji, pickRandomEntrancePosition(CORNER_MAPS));
  const now = Date.now();
  const entries = readRegistry(storage);
  entries.push({ id, name, createdAt: now, lastPlayed: now, level: state.player.level, ngPlusCycle: state.ngPlusCycle });
  writeRegistry(entries, storage);
  saveState(state, id, storage);
  return { id, state };
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
