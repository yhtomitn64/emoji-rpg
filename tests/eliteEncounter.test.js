import test from 'node:test';
import assert from 'node:assert/strict';
import { ELITE_ENCOUNTER_CHANCE, ELITE_MONSTER_ID, rollEliteEncounter, getEliteAppearLine } from '../js/systems/eliteEncounter.js';

test('ELITE_ENCOUNTER_CHANCE is 5%', () => {
  assert.equal(ELITE_ENCOUNTER_CHANCE, 0.05);
});

test('rollEliteEncounter is true only when rng() lands below the elite chance', () => {
  assert.equal(rollEliteEncounter(() => 0), true);
  assert.equal(rollEliteEncounter(() => 0.049), true);
  assert.equal(rollEliteEncounter(() => 0.05), false);
  assert.equal(rollEliteEncounter(() => 0.5), false);
  assert.equal(rollEliteEncounter(() => 0.999), false);
});

test('getEliteAppearLine reads as outmatched when the player is far weaker', () => {
  const player = { attack: 5, defense: 1, hp: 30, maxHp: 30, name: 'Jurassic Jerky' };
  const monster = { attack: 30, defense: 11, hp: 132, name: 'Jurassic Jerky' };
  const line = getEliteAppearLine(player, monster);
  assert.match(line, /no way/i);
});

test('getEliteAppearLine reads as a close fight when roughly matched', () => {
  const player = { attack: 30, defense: 11, hp: 132, maxHp: 132 };
  const monster = { attack: 30, defense: 11, hp: 132, name: 'Jurassic Jerky' };
  const line = getEliteAppearLine(player, monster);
  assert.match(line, /skilled enough/i);
});

test('getEliteAppearLine reads as favorable when the player is far stronger', () => {
  const player = { attack: 200, defense: 50, hp: 1000, maxHp: 1000 };
  const monster = { attack: 30, defense: 11, hp: 132, name: 'Jurassic Jerky' };
  const line = getEliteAppearLine(player, monster);
  assert.match(line, /edge/i);
});
