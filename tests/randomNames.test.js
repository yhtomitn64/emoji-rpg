import test from 'node:test';
import assert from 'node:assert/strict';
import { NAME_PREFIXES, NAME_SUFFIXES, generateRandomName } from '../js/data/randomNames.js';

test('generateRandomName combines a prefix and suffix from the word banks', () => {
  const name = generateRandomName(() => 0);
  assert.equal(name, `${NAME_PREFIXES[0]} ${NAME_SUFFIXES[0]}`);
});

test('generateRandomName picks the last entry when rng returns just under 1', () => {
  const name = generateRandomName(() => 0.999999);
  assert.equal(name, `${NAME_PREFIXES[NAME_PREFIXES.length - 1]} ${NAME_SUFFIXES[NAME_SUFFIXES.length - 1]}`);
});

test('generateRandomName defaults to Math.random when no rng is supplied', () => {
  const name = generateRandomName();
  assert.equal(typeof name, 'string');
  assert.ok(name.includes(' '));
});
