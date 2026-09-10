import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_CATEGORY, DEFAULT_THEME, SOUND_THEMES, SOUND_VARIANTS, resolvePath, resolvePaths } from '../js/data/soundManifest.js';

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

// A theme entry is a bare string for single-take sounds and an array once
// the sound declares variants, so these read the first take either way
// rather than assuming one shape.
function firstTakeOf(soundId) {
  const entry = SOUND_THEMES.realistic[soundId];
  return Array.isArray(entry) ? entry[0] : entry;
}

test('resolvePath returns the theme-specific path when present', () => {
  const path = resolvePath('realistic', 'hitNormal');
  assert.equal(path, firstTakeOf('hitNormal'));
});

test('resolvePath falls back to DEFAULT_THEME when the requested theme lacks the sound', () => {
  const path = resolvePath('metal', 'hitNormal'); // 'metal' theme has no entries yet
  assert.equal(path, firstTakeOf('hitNormal'));
});

test('resolvePath returns null for an unknown sound id', () => {
  assert.equal(resolvePath('realistic', 'notARealSoundId'), null);
});

test('resolvePaths always returns an array, single-take sounds included', () => {
  const paths = resolvePaths('realistic', 'levelUp');
  assert.ok(Array.isArray(paths));
  assert.equal(paths.length, 1);
  assert.equal(paths[0], resolvePath('realistic', 'levelUp'));
});

test('resolvePaths returns one path per declared variant, first one unsuffixed', () => {
  // Driven off SOUND_VARIANTS rather than a hardcoded id so this keeps
  // testing the real behaviour as takes get added over time.
  const [soundId, count] = Object.entries(SOUND_VARIANTS)[0] ?? [];
  if (!soundId) return; // no multi-take sounds declared yet
  const paths = resolvePaths(DEFAULT_THEME, soundId);
  assert.equal(paths.length, count);
  assert.ok(paths[0].endsWith(`/${soundId}.mp3`));
  assert.ok(paths[1].endsWith(`/${soundId}-2.mp3`));
  assert.equal(new Set(paths).size, paths.length, 'variant paths must be distinct');
});

test('resolvePaths returns an empty array for an unknown sound id', () => {
  assert.deepEqual(resolvePaths('realistic', 'notARealSoundId'), []);
});

test('every path SOUND_VARIANTS promises actually exists on disk', async () => {
  // A variant count that outruns the files on disk fails silently at
  // runtime (playSfx warns once and no-ops), so the sound just goes quiet
  // for that take. Cheap to catch here instead.
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const nodePath = (await import('node:path')).default;
  const root = nodePath.dirname(nodePath.dirname(fileURLToPath(import.meta.url)));
  for (const soundId of Object.keys(SOUND_VARIANTS)) {
    for (const relPath of resolvePaths(DEFAULT_THEME, soundId)) {
      assert.ok(
        existsSync(nodePath.join(root, relPath)),
        `${soundId} declares a take with no file: ${relPath}`
      );
    }
  }
});
