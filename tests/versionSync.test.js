// Guards against the version-bump drift that's bitten this repo before: the
// dev CHANGELOG.md gets a new dated version section, but js/data/playerChangelog.js
// (which drives the in-game footer/"What's New" version number) never gets a
// matching entry - so the footer keeps showing a stale version indefinitely.
// See CHANGELOG.md's own header for the versioning rules this enforces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function latestChangelogVersion() {
  const text = readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
  const match = text.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  assert.ok(match, 'CHANGELOG.md must have at least one dated "## [x.y.z]" version section');
  return match[1];
}

test('the newest dated CHANGELOG.md version has a matching PLAYER_CHANGELOG entry', async () => {
  const { PLAYER_CHANGELOG } = await import('../js/data/playerChangelog.js');
  const latestDated = latestChangelogVersion();
  assert.equal(
    PLAYER_CHANGELOG[0].version,
    latestDated,
    `PLAYER_CHANGELOG[0].version ("${PLAYER_CHANGELOG[0].version}") doesn't match ` +
      `CHANGELOG.md's newest dated version ("${latestDated}"). The in-game footer/` +
      `"What's New" screen reads PLAYER_CHANGELOG[0] directly, so a version bump in ` +
      `CHANGELOG.md needs a matching entry added to js/data/playerChangelog.js in the ` +
      `same commit.`
  );
});

test('PLAYER_CHANGELOG entries are sorted newest-first with no duplicate versions', async () => {
  const { PLAYER_CHANGELOG } = await import('../js/data/playerChangelog.js');
  const versions = PLAYER_CHANGELOG.map((e) => e.version);
  assert.equal(new Set(versions).size, versions.length, 'duplicate version entries found');

  const toParts = (v) => v.split('.').map(Number);
  for (let i = 1; i < versions.length; i++) {
    const prev = toParts(versions[i - 1]);
    const cur = toParts(versions[i]);
    const isDescending =
      prev[0] > cur[0] ||
      (prev[0] === cur[0] && prev[1] > cur[1]) ||
      (prev[0] === cur[0] && prev[1] === cur[1] && prev[2] > cur[2]);
    assert.ok(isDescending, `PLAYER_CHANGELOG isn't newest-first: ${versions[i - 1]} is not newer than ${versions[i]}`);
  }
});
