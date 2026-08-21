import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_LOG_CAP, appendMessage, formatBattleOutcomeMessage, describeMonsterGroup } from '../js/systems/messageLog.js';

test('MESSAGE_LOG_CAP is 50', () => {
  assert.equal(MESSAGE_LOG_CAP, 50);
});

test('appendMessage adds to the end of the log, preserving order', () => {
  const log = appendMessage(['first'], 'second');
  assert.deepEqual(log, ['first', 'second']);
});

test('appendMessage does not mutate the input array', () => {
  const original = ['first'];
  appendMessage(original, 'second');
  assert.deepEqual(original, ['first']);
});

test('appendMessage drops the oldest entry once the cap is exceeded', () => {
  const full = Array.from({ length: MESSAGE_LOG_CAP }, (_, i) => `msg${i}`);
  const next = appendMessage(full, 'newest');
  assert.equal(next.length, MESSAGE_LOG_CAP);
  assert.equal(next[0], 'msg1');
  assert.equal(next[next.length - 1], 'newest');
});

test('appendMessage keeps growing up to exactly the cap without dropping', () => {
  const almostFull = Array.from({ length: MESSAGE_LOG_CAP - 1 }, (_, i) => `msg${i}`);
  const next = appendMessage(almostFull, 'last-room');
  assert.equal(next.length, MESSAGE_LOG_CAP);
  assert.equal(next[0], 'msg0');
  assert.equal(next[next.length - 1], 'last-room');
});

test('formatBattleOutcomeMessage includes the effective stat snapshot for a win', () => {
  const snapshot = { level: 3, attack: 12, defense: 5, hp: 18, maxHp: 24 };
  const msg = formatBattleOutcomeMessage('won', 'Mean Meatball', snapshot);
  assert.equal(msg, 'Defeated Mean Meatball! (Lv.3 ATK 12 DEF 5 HP 18/24)');
});

test('formatBattleOutcomeMessage phrases a loss and a flee differently, same stat snapshot format', () => {
  const snapshot = { level: 3, attack: 12, defense: 5, hp: 0, maxHp: 24 };
  assert.equal(
    formatBattleOutcomeMessage('lost', 'Mean Meatball', snapshot),
    'Mean Meatball defeated you. (Lv.3 ATK 12 DEF 5 HP 0/24)'
  );
  assert.equal(
    formatBattleOutcomeMessage('fled', 'Mean Meatball', { ...snapshot, hp: 10 }),
    'Fled from Mean Meatball. (Lv.3 ATK 12 DEF 5 HP 10/24)'
  );
});

test('formatBattleOutcomeMessage phrases the three weak-mob-surrender outcomes distinctly, same stat snapshot format', () => {
  const snapshot = { level: 3, attack: 12, defense: 5, hp: 24, maxHp: 24 };
  assert.equal(
    formatBattleOutcomeMessage('surrender', 'Mean Meatball', snapshot),
    'Mean Meatball surrenders! (Lv.3 ATK 12 DEF 5 HP 24/24)'
  );
  assert.equal(
    formatBattleOutcomeMessage('fled-with-loot', 'Mean Meatball', snapshot),
    'Mean Meatball flees, dropping loot! (Lv.3 ATK 12 DEF 5 HP 24/24)'
  );
  assert.equal(
    formatBattleOutcomeMessage('fled-empty', 'Mean Meatball', snapshot),
    'Mean Meatball flees! (Lv.3 ATK 12 DEF 5 HP 24/24)'
  );
});

test('describeMonsterGroup names a single monster plainly', () => {
  const name = describeMonsterGroup(['boar'], () => 'Snorty McPigface');
  assert.equal(name, 'Snorty McPigface');
});

test('describeMonsterGroup pluralizes a group with a count', () => {
  const name = describeMonsterGroup(['boar', 'boar', 'boar'], () => 'Snorty McPigface');
  assert.equal(name, '3 Snorty McPigfaces');
});

test('describeMonsterGroup returns an empty string for an empty list', () => {
  const name = describeMonsterGroup([], () => 'Snorty McPigface');
  assert.equal(name, '');
});
