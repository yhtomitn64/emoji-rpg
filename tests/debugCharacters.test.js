import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDebugCharacterFromUrl } from '../js/systems/debugCharacters.js';
import { listSlots, upsertSlot } from '../js/systems/saveSlots.js';
import { loadState, createNewGame } from '../js/state.js';
import { ABILITIES } from '../js/systems/abilities.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

test('applyDebugCharacterFromUrl is a no-op with no ?debug param', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('', storage);
  assert.equal(id, null);
  assert.deepEqual(listSlots(storage), []);
});

test('applyDebugCharacterFromUrl is a no-op for an unknown ?debug value', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('?debug=nonexistentCharacter', storage);
  assert.equal(id, null);
  assert.deepEqual(listSlots(storage), []);
});

test('?debug=level10 creates a level 10 save with every ability unlocked', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('?debug=level10', storage);
  assert.ok(id);
  const state = loadState(id, storage);
  assert.equal(state.player.level, 10);
  const unlockedCount = ABILITIES.filter((a) => a.unlockLevel <= state.player.level).length;
  assert.equal(unlockedCount, ABILITIES.length, 'level 10 should unlock every ability');
  const slots = listSlots(storage);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, id);
});

test('the level10 debug character equips gear at the NG+0 upgrade cap, not past it', () => {
  const storage = createFakeStorage();
  const id = applyDebugCharacterFromUrl('?debug=level10', storage);
  const state = loadState(id, storage);
  assert.equal(state.upgrades['ironSword:plain'], 3);
});

test('revisiting the same ?debug URL resets the slot instead of creating a duplicate', () => {
  const storage = createFakeStorage();
  applyDebugCharacterFromUrl('?debug=level10', storage);
  // Simulate the player having played a bit on the debug save since.
  upsertSlot('debug-level10', '[Debug] level10', { ...createNewGame(), player: { ...createNewGame().player, level: 3, gold: 1 } }, storage);
  applyDebugCharacterFromUrl('?debug=level10', storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 1, 'revisiting the debug URL should reset the one slot, not duplicate it');
  assert.equal(loadState(slots[0].id, storage).player.level, 10);
});

test('a debug character never collides with a real player\'s save slots', () => {
  const storage = createFakeStorage();
  storage.setItem('emoji-rpg-slots', JSON.stringify([{ id: 'slot-real', name: 'My Hero', level: 5, ngPlusCycle: 0 }]));
  applyDebugCharacterFromUrl('?debug=level10', storage);
  const slots = listSlots(storage);
  assert.equal(slots.length, 2);
  assert.ok(slots.some((s) => s.id === 'slot-real' && s.name === 'My Hero'));
});

// The ?debug=stress fixture exists to push the map renderer, so it has to
// generate a world the game could actually produce. It did not at first: each
// tile picked its crossed edges from a hash independently, which let a tile
// draw a trail stroke toward a neighbour that drew nothing back, so the stroke
// stopped dead at the tile boundary. Timothy saw that on screen and read it as
// a rendering bug, reasonably - "path having square edge when dark/thick meets
// either thin/light or non-existing path" - and it cost a round of looking at
// the renderer for a fault that was in the test data.
//
// Real play cannot produce an asymmetric edge: one step calls markDirection on
// the tile being left and markVisited with the opposite direction on the tile
// being entered, both halves of the same crossing (js/systems/exploration.js).
test('the stress fixture generates a world the game could actually produce', async (t) => {
  const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };
  const DELTA = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

  const loadStress = async () => {
    const { applyDebugCharacterFromUrl } = await import('../js/systems/debugCharacters.js');
    const store = new Map();
    applyDebugCharacterFromUrl('?debug=stress', {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    });
    return JSON.parse(store.get('emoji-rpg-save-debug-stress'));
  };

  await t.test('every crossed edge is recorded from both sides', async () => {
    const state = await loadStress();
    const asymmetric = [];
    let checked = 0;
    for (const [screenId, tiles] of Object.entries(state.visited)) {
      for (const [key, entry] of Object.entries(tiles)) {
        const [x, y] = key.split(',').map(Number);
        for (const dir of entry.dirs) {
          const [dx, dy] = DELTA[dir];
          const neighbour = tiles[`${x + dx},${y + dy}`];
          if (!neighbour) continue;   // screen edge - the other side is another screen
          checked += 1;
          if (!neighbour.dirs.includes(OPPOSITE[dir])) {
            asymmetric.push(`${screenId} ${key} has '${dir}' but ${x + dx},${y + dy} has no '${OPPOSITE[dir]}'`);
          }
        }
      }
    }
    assert.ok(checked > 1000, `sanity: expected a densely walked world, only checked ${checked} edges`);
    assert.deepEqual(asymmetric.slice(0, 5), [], `${asymmetric.length} edges disagree between their two tiles`);
  });

  await t.test('it still spans every wear level, which is the point of it', async () => {
    const state = await loadStress();
    const { TRAIL_WEAR_CAP } = await import('../js/systems/trail.js');
    const counts = new Set(Object.values(state.visited.center).map((e) => e.count));
    assert.equal(counts.size, TRAIL_WEAR_CAP, 'every wear level should be represented somewhere');
  });
});
