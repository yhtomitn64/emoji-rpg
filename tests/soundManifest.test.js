import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_CATEGORY, DEFAULT_THEME, SOUND_THEMES, resolvePath } from '../js/data/soundManifest.js';

test('DEFAULT_THEME is realistic and every sound has a path in it', () => {
  assert.equal(DEFAULT_THEME, 'realistic');
  for (const soundId of Object.keys(SOUND_CATEGORY)) {
    assert.ok(
      SOUND_THEMES[DEFAULT_THEME][soundId],
      `default theme is missing a path for "${soundId}"`
    );
  }
});

test('every SOUND_CATEGORY value is one of the 4 known categories', () => {
  const valid = new Set(['combat', 'ui', 'world', 'music']);
  for (const [soundId, category] of Object.entries(SOUND_CATEGORY)) {
    assert.ok(valid.has(category), `"${soundId}" has unknown category "${category}"`);
  }
});

test('resolvePath returns the theme-specific path when present', () => {
  const path = resolvePath('realistic', 'hitNormal');
  assert.equal(path, SOUND_THEMES.realistic.hitNormal);
});

test('resolvePath falls back to DEFAULT_THEME when the requested theme lacks the sound', () => {
  const path = resolvePath('metal', 'hitNormal'); // 'metal' theme has no entries yet
  assert.equal(path, SOUND_THEMES.realistic.hitNormal);
});

test('resolvePath returns null for an unknown sound id', () => {
  assert.equal(resolvePath('realistic', 'notARealSoundId'), null);
});
