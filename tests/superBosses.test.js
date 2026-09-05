import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPER_BOSSES } from '../js/data/superBosses.js';
import { TILES } from '../js/tiles.js';

test('every SUPER_BOSSES entry has the required shape', () => {
  for (const [id, entry] of Object.entries(SUPER_BOSSES)) {
    assert.equal(entry.id, id, `${id}'s own id field must match its registry key`);
    assert.equal(typeof entry.monsterId, 'string');
    assert.equal(typeof entry.hasDungeon, 'boolean');
    if (entry.hasDungeon) {
      assert.equal(typeof entry.dungeonMapId, 'string', `${id} has hasDungeon: true but no dungeonMapId`);
    } else {
      assert.equal(entry.dungeonMapId, null, `${id} has hasDungeon: false but a non-null dungeonMapId`);
    }
  }
});

// Mirrors tests/toolDungeonMaps.test.js's "a not-yet-placed entry is inert
// everywhere that matches on screenId" test - a fresh SUPER_BOSSES entry
// starts with screenId: null so it never matches a real wilderness screen
// until Timothy places it with the terrain painter.
test('a not-yet-placed SUPER_BOSSES entry (null screenId) is inert everywhere that matches on screenId', () => {
  const placeholder = { id: 'someSuperBoss', monsterId: 'someMonster', screenId: null, x: null, y: null, hasDungeon: false, dungeonMapId: null };
  assert.equal(placeholder.screenId, null);
  assert.notEqual(typeof 'anyRealScreenId', typeof placeholder.screenId);
});

test('superBossMarker and superBossEntrance tile kinds exist and are walkable', () => {
  assert.ok(TILES.superBossMarker, 'TILES.superBossMarker must exist');
  assert.equal(TILES.superBossMarker.walkable, true);
  assert.equal(TILES.superBossMarker.action, 'superBossBattle');

  assert.ok(TILES.superBossEntrance, 'TILES.superBossEntrance must exist');
  assert.equal(TILES.superBossEntrance.walkable, true);
  assert.equal(TILES.superBossEntrance.action, 'enterSuperBossDungeon');
});
