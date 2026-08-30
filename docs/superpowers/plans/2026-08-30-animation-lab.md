# Animation Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `tools/animation-lab/` — a dev-only visual keyframe editor for the battle screen's weapon-swing animations — and refactor `js/screens/battleScreen.js` so the tool can read and write real animation values, without changing any gameplay-visible behavior yet.

**Architecture:** A pure-logic module (`tools/animation-lab/keyframes.js`) implements the shared transform math and code generation, tested standalone with `node --test`. A DOM-heavy UI module (`tools/animation-lab/lab.js`) drives a live (non-canvas) preview built from the game's real CSS/DOM, using the same `Element.animate()` call the game itself uses, so what you see in the tool is what ships. `battleScreen.js` gains a small shared `buildTransform()` helper plus marker-comment-wrapped blocks the tool can safely regenerate — same one-block-at-a-time patch guarantee `tools/terrain-painter/` gives for map files.

**Tech Stack:** Plain HTML/JS/CSS, ES modules, no build step (matches `tools/terrain-painter/`). File System Access API for direct-to-disk export, with a copy/paste fallback for Firefox/Safari. `node:test` + `node:assert/strict` for the pure-logic module (matches `tests/battleScreenDom.test.js`'s existing convention).

**Spec:** `docs/superpowers/specs/2026-08-30-animation-lab-design.md`

## Global Constraints

- `tools/` is never deployed — `.github/workflows/deploy.yml` stages an explicit copy allowlist (`index.html`, `robots.txt`, `sitemap.xml`, `ads.txt`, `_headers`, `css/`, `js/`, `assets/`) that doesn't include `tools/`. No workflow change needed.
- **This plan is a behavior-preserving refactor, not a redesign.** Every seed value ported from today's `swingKeyframesFor`/`playPlayerSweepSwing` must reproduce the current visual result as closely as the new data model allows (noted per-task where an exact port isn't possible). Redesigning Attack/Chop/Sweep-3 happens afterward, by Timothy, using the finished tool — not guessed at here.
- Existing tests in `tests/battleScreenDom.test.js` (DOM structure / emoji / class / hit-sequence assertions — jsdom has no `Element.animate`, so no test asserts actual transform/keyframe values) must keep passing unmodified after the `battleScreen.js` refactor tasks.
- Run `npm run test` (never `npm test`/`npx jest` directly — this project's `package.json` defines `test` as `node --test tests/*.js`) after every task.
- CHANGELOG.md needs an `## [Unreleased]` entry before this can deploy (CI-enforced) — added in the final task. This is a dev-tool + non-visible refactor, so no `js/data/playerChangelog.js` entry is needed (repo's own versioning checklist explicitly exempts internal-only/tooling changes). Before actually pushing, follow this repo's CLAUDE.md versioning checklist (bump `Unreleased` into a dated version section).
- The transform composition (derived and confirmed correct during brainstorming, not restated per-task): `translate(-50%, -50%) translate(anchor.x, anchor.y) rotate(deg) translate(x-anchor.x, y-anchor.y) scale(s)` when pinned (rotates around the fixed `anchor`, with the glyph riding a rotating "arm"); `translate(-50%, -50%) translate(x, y) rotate(deg) scale(s)` when free (matches today's exact behavior, glyph rotates about its own center while translating). `x`/`y`/anchor coordinates are always resolved as `base + dx * dxFactor` / `base + dy * dyFactor` first — this is a direct generalization of the `dx * 0.15 + 40` pattern already used throughout today's `swingKeyframesFor`.

---

### Task 1: `keyframes.js` core transform math

**Files:**
- Create: `tools/animation-lab/keyframes.js`
- Test: `tests/animationLabKeyframes.test.js`

**Interfaces:**
- Produces: `resolveXY(kf, dx, dy) -> { x, y }`, `buildTransform(pinned, anchor, kf, dx, dy) -> string`, `buildWaapiKeyframes(design, dx, dy) -> Array<{ transform: string, offset: number }>`. `kf`/`anchor` shape: `{ x: number, y: number, dxFactor?: number, dyFactor?: number, rotate?: number, scale?: number }` (`rotate`/`scale` only required on real keyframes, not on `anchor`). `design` shape: `{ pinned: boolean, anchor: {x,y,dxFactor?,dyFactor?}, keyframes: Array<{offset,x,y,dxFactor?,dyFactor?,rotate,scale}> }`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/animationLabKeyframes.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveXY, buildTransform, buildWaapiKeyframes } from '../tools/animation-lab/keyframes.js';

test('resolveXY', async (t) => {
  await t.test('resolves a plain offset with no dx/dy contribution', () => {
    assert.deepEqual(resolveXY({ x: 10, y: -5 }, 999, 999), { x: 10, y: -5 });
  });

  await t.test('adds dx/dy scaled by dxFactor/dyFactor, matching the dx * 0.15 + 40 pattern already used in battleScreen.js', () => {
    assert.deepEqual(resolveXY({ x: 40, y: -50, dxFactor: 0.15, dyFactor: 0.15 }, 100, 200), { x: 55, y: -20 });
  });
});

test('buildTransform', async (t) => {
  await t.test('free mode matches today\'s exact translate-then-rotate-then-scale composition', () => {
    const kf = { x: 10, y: 20, rotate: 45, scale: 1 };
    const result = buildTransform(false, { x: 0, y: 0 }, kf, 0, 0);
    assert.equal(result, 'translate(-50%, -50%) translate(10px, 20px) rotate(45deg) scale(1)');
  });

  await t.test('pinned mode rotates around the fixed anchor, riding an arm out to the keyframe position', () => {
    const anchor = { x: 5, y: 5 };
    const kf = { x: 25, y: 5, rotate: 90, scale: 1 };
    const result = buildTransform(true, anchor, kf, 0, 0);
    // arm = kf - anchor = (20, 0)
    assert.equal(result, 'translate(-50%, -50%) translate(5px, 5px) rotate(90deg) translate(20px, 0px) scale(1)');
  });

  await t.test('pinned mode anchor itself can track dx/dy via dxFactor/dyFactor', () => {
    const anchor = { x: 0, y: 0, dxFactor: 0.2, dyFactor: 0 };
    const kf = { x: 0, y: 0, rotate: 0, scale: 2 };
    const result = buildTransform(true, anchor, kf, 100, 0);
    // anchor resolves to (20, 0); arm = (0,0) - (20,0) = (-20, 0)
    assert.equal(result, 'translate(-50%, -50%) translate(20px, 0px) rotate(0deg) translate(-20px, 0px) scale(2)');
  });
});

test('buildWaapiKeyframes', async (t) => {
  await t.test('maps every design keyframe through buildTransform, carrying offset through unchanged', () => {
    const design = {
      pinned: false,
      anchor: { x: 0, y: 0 },
      keyframes: [
        { offset: 0, x: 0, y: 0, rotate: 0, scale: 1 },
        { offset: 1, x: 10, y: 10, rotate: 90, scale: 1.5 },
      ],
    };
    const result = buildWaapiKeyframes(design, 50, 50);
    assert.equal(result.length, 2);
    assert.equal(result[0].offset, 0);
    assert.equal(result[1].offset, 1);
    assert.equal(result[1].transform, 'translate(-50%, -50%) translate(10px, 10px) rotate(90deg) scale(1.5)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `tools/animation-lab/keyframes.js` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```js
// tools/animation-lab/keyframes.js
//
// Pure logic shared between the Animation Lab UI (lab.js) and the code it
// generates for js/screens/battleScreen.js. No DOM dependency - testable
// standalone with `node --test`.
//
// The transform composition below relies on how CSS transform *function
// lists* compose: each function is matrix-multiplied in the same order
// they're written, applied to the element's local box space. Writing
// `translate(anchor) rotate(deg) translate(arm)` therefore behaves like a
// nested coordinate frame (same trick as nested SVG/canvas transforms):
// move the origin to `anchor`, rotate *that frame*, then place the glyph
// `arm` pixels out from the now-rotated origin - a rigid arm swinging on a
// fixed pivot. Free mode skips the anchor entirely and matches the
// existing translate-then-rotate order already used everywhere in
// battleScreen.js's swingKeyframesFor (rotates the glyph about its own
// center while carrying it along the path).

export function resolveXY(point, dx, dy) {
  return {
    x: point.x + dx * (point.dxFactor ?? 0),
    y: point.y + dy * (point.dyFactor ?? 0),
  };
}

export function buildTransform(pinned, anchor, kf, dx, dy) {
  const { x, y } = resolveXY(kf, dx, dy);
  if (pinned) {
    const { x: ax, y: ay } = resolveXY(anchor, dx, dy);
    const armX = x - ax;
    const armY = y - ay;
    return `translate(-50%, -50%) translate(${ax}px, ${ay}px) rotate(${kf.rotate}deg) translate(${armX}px, ${armY}px) scale(${kf.scale})`;
  }
  return `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${kf.rotate}deg) scale(${kf.scale})`;
}

export function buildWaapiKeyframes(design, dx, dy) {
  return design.keyframes.map((kf) => ({
    transform: buildTransform(design.pinned, design.anchor, kf, dx, dy),
    offset: kf.offset,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tools/animation-lab/keyframes.js tests/animationLabKeyframes.test.js
git commit -m "feat: add Animation Lab's core transform math (keyframes.js)"
```

---

### Task 2: `keyframes.js` code generation + file patching

**Files:**
- Modify: `tools/animation-lab/keyframes.js`
- Test: `tests/animationLabKeyframes.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 directly (pure string generation), but the generated code calls a `buildTransform` function that Task 4 adds to `battleScreen.js` with the exact same signature/behavior as this module's own `buildTransform`.
- Produces: `generateKeyframesCaseCode(abilityId, design) -> string`, `generateDurationEntryCode(abilityId, design) -> string`, `generateSweepProfilesCode(sweepProfiles) -> string`, `patchMarkedBlock(fileText, markerId, newBlockText) -> string`.

- [ ] **Step 1: Write the failing tests**

```js
// append to tests/animationLabKeyframes.test.js
import { generateKeyframesCaseCode, generateDurationEntryCode, generateSweepProfilesCode, patchMarkedBlock } from '../tools/animation-lab/keyframes.js';

test('generateKeyframesCaseCode', async (t) => {
  await t.test('emits a switch case that embeds the design as data and calls the shared buildTransform helper', () => {
    const design = {
      pinned: true,
      anchor: { x: 5, y: 5 },
      keyframes: [{ offset: 0, x: 0, y: 0, rotate: 0, scale: 1 }],
    };
    const code = generateKeyframesCaseCode('chop', design);
    assert.match(code, /^case 'chop': \{/);
    assert.match(code, /const ANIMATION = \{"pinned":true,"anchor":\{"x":5,"y":5\},"keyframes":\[\{"offset":0,"x":0,"y":0,"rotate":0,"scale":1\}\]\};/);
    assert.match(code, /buildTransform\(ANIMATION\.pinned, ANIMATION\.anchor, kf, dx, dy\)/);
  });
});

test('generateDurationEntryCode', async (t) => {
  await t.test('emits one object-literal entry', () => {
    assert.equal(generateDurationEntryCode('chop', { durationMs: 1500 }), 'chop: 1500,');
  });
});

test('generateSweepProfilesCode', async (t) => {
  await t.test('emits a const declaration holding the whole profiles table', () => {
    const profiles = { default: { pinned: false, anchor: { x: 0, y: 0 }, leadIn: { rotate: 0, scale: 1 }, perWaypoint: { rotateStep: 120, scale: 1 } } };
    const code = generateSweepProfilesCode(profiles);
    assert.match(code, /^const SWEEP_PROFILES = \{"default":/);
  });
});

test('patchMarkedBlock', async (t) => {
  await t.test('replaces only the text between matching markers', () => {
    const original = 'before\n// ANIMATION-DESIGNER:chop:START\nold content\n// ANIMATION-DESIGNER:chop:END\nafter';
    const result = patchMarkedBlock(original, 'chop', 'new content');
    assert.equal(result, 'before\n// ANIMATION-DESIGNER:chop:START\n  new content\n  // ANIMATION-DESIGNER:chop:END\nafter');
  });

  await t.test('leaves unrelated markers and surrounding text untouched', () => {
    const original = '// ANIMATION-DESIGNER:attack:START\nkeep me\n// ANIMATION-DESIGNER:attack:END\n// ANIMATION-DESIGNER:chop:START\nold\n// ANIMATION-DESIGNER:chop:END';
    const result = patchMarkedBlock(original, 'chop', 'new');
    assert.match(result, /keep me/);
    assert.doesNotMatch(result, /old/);
  });

  await t.test('throws a clear error when the markers are missing', () => {
    assert.throws(() => patchMarkedBlock('no markers here', 'chop', 'x'), /Markers for "chop" not found/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — the four new exports don't exist yet.

- [ ] **Step 3: Write the implementation**

```js
// append to tools/animation-lab/keyframes.js

// Generated code embeds the design as a literal object rather than
// individually-typed-out keyframe expressions - keeps codegen to a single
// JSON.stringify, and keeps the generated block byte-for-byte reproducible
// from the same design JSON the tool round-trips through designs/*.json.
export function generateKeyframesCaseCode(abilityId, design) {
  const json = JSON.stringify({ pinned: design.pinned, anchor: design.anchor, keyframes: design.keyframes });
  return `case '${abilityId}': {\n    const ANIMATION = ${json};\n    return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));\n  }`;
}

export function generateDurationEntryCode(abilityId, design) {
  return `${abilityId}: ${design.durationMs},`;
}

export function generateSweepProfilesCode(sweepProfiles) {
  return `const SWEEP_PROFILES = ${JSON.stringify(sweepProfiles)};`;
}

// Replaces only the text strictly between a `// ANIMATION-DESIGNER:<id>:START`
// and `// ANIMATION-DESIGNER:<id>:END` comment pair - same one-block-at-a-time
// guarantee tools/terrain-painter/painter.js gives for LEGEND/ROWS via regex
// against a known declaration shape, adapted here with explicit markers
// since a switch case's braces aren't safely bracket-matchable by regex.
export function patchMarkedBlock(fileText, markerId, newBlockText) {
  const startMarker = `// ANIMATION-DESIGNER:${markerId}:START`;
  const endMarker = `// ANIMATION-DESIGNER:${markerId}:END`;
  const startIdx = fileText.indexOf(startMarker);
  const endIdx = fileText.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Markers for "${markerId}" not found in file`);
  }
  const before = fileText.slice(0, startIdx + startMarker.length);
  const after = fileText.slice(endIdx);
  return `${before}\n  ${newBlockText}\n  ${after}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tools/animation-lab/keyframes.js tests/animationLabKeyframes.test.js
git commit -m "feat: add Animation Lab's codegen and marker-block file patching"
```

---

### Task 3: Design validation + seed JSON files

**Files:**
- Modify: `tools/animation-lab/keyframes.js`
- Create: `tools/animation-lab/designs/attack.json`
- Create: `tools/animation-lab/designs/stab.json`
- Create: `tools/animation-lab/designs/chop.json`
- Create: `tools/animation-lab/designs/slash.json`
- Create: `tools/animation-lab/designs/sweep.json`
- Test: `tests/animationLabKeyframes.test.js`

**Interfaces:**
- Produces: `validateDesign(design) -> string[]` (empty array = valid). The five JSON files are the source of truth Task 4/5 hand-port into `battleScreen.js`, and what `lab.js` (Task 6) loads on open.

- [ ] **Step 1: Write the failing tests**

```js
// append to tests/animationLabKeyframes.test.js
import { readFileSync } from 'node:fs';
import { validateDesign } from '../tools/animation-lab/keyframes.js';

test('validateDesign', async (t) => {
  const validDesign = {
    pinned: false,
    anchor: { x: 0, y: 0 },
    durationMs: 1500,
    keyframes: [
      { offset: 0, x: 0, y: 0, rotate: 0, scale: 1 },
      { offset: 1, x: 10, y: 10, rotate: 90, scale: 1 },
    ],
  };

  await t.test('accepts a well-formed design', () => {
    assert.deepEqual(validateDesign(validDesign), []);
  });

  await t.test('flags a non-boolean pinned, a missing anchor field, too few keyframes, and a bad scale', () => {
    const errors = validateDesign({
      pinned: 'yes',
      anchor: { x: 0 },
      durationMs: 1500,
      keyframes: [{ offset: 0, x: 0, y: 0, rotate: 0, scale: -1 }],
    });
    assert.ok(errors.some((e) => e.includes('pinned')));
    assert.ok(errors.some((e) => e.includes('anchor')));
    assert.ok(errors.some((e) => e.includes('keyframes')));
    assert.ok(errors.some((e) => e.includes('scale')));
  });
});

test('seed design files', async (t) => {
  const abilityIds = ['attack', 'stab', 'chop', 'slash'];
  for (const id of abilityIds) {
    await t.test(`designs/${id}.json is valid`, () => {
      const design = JSON.parse(readFileSync(new URL(`../tools/animation-lab/designs/${id}.json`, import.meta.url)));
      assert.deepEqual(validateDesign(design), []);
    });
  }

  await t.test('designs/sweep.json has a default profile with at least one override', () => {
    const sweep = JSON.parse(readFileSync(new URL('../tools/animation-lab/designs/sweep.json', import.meta.url)));
    assert.ok(sweep.default);
    assert.ok(sweep.default.perWaypoint);
    assert.ok(typeof sweep.default.perWaypoint.rotateStep === 'number');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `validateDesign` and the JSON files don't exist yet.

- [ ] **Step 3: Write `validateDesign`**

```js
// append to tools/animation-lab/keyframes.js

export function validateDesign(design) {
  const errors = [];
  if (typeof design.pinned !== 'boolean') errors.push('pinned must be a boolean');
  if (!design.anchor || typeof design.anchor.x !== 'number' || typeof design.anchor.y !== 'number') {
    errors.push('anchor.x/anchor.y must be numbers');
  }
  if (typeof design.durationMs !== 'number' || design.durationMs <= 0) errors.push('durationMs must be a positive number');
  if (!Array.isArray(design.keyframes) || design.keyframes.length < 2) {
    errors.push('keyframes must be an array of at least 2 entries');
  } else {
    design.keyframes.forEach((kf, i) => {
      if (typeof kf.offset !== 'number' || kf.offset < 0 || kf.offset > 1) errors.push(`keyframes[${i}].offset must be a number between 0 and 1`);
      if (typeof kf.x !== 'number' || typeof kf.y !== 'number') errors.push(`keyframes[${i}].x/y must be numbers`);
      if (typeof kf.rotate !== 'number') errors.push(`keyframes[${i}].rotate must be a number`);
      if (typeof kf.scale !== 'number' || kf.scale <= 0) errors.push(`keyframes[${i}].scale must be a positive number`);
    });
  }
  return errors;
}
```

- [ ] **Step 4: Write the seed JSON files**

These hand-port today's real `swingKeyframesFor`/`SWING_DURATION_MS` values (`js/screens/battleScreen.js:598-686`) into the new model. Every ability here is a straight port using only the existing `dx * factor + offset` pattern, **except `attack.json`**, whose current formula also blends a small perpendicular `dy * 0.08` term into `x` (and `dx * 0.08` into `y`) to bow the path — a genuine 2D cross-term the approved data model doesn't carry. That cross term is dropped (an approximation, not a bug): Attack is the animation Timothy already flagged as broken and is the first one he'll redesign in the finished tool, so exact fidelity to the current (unwanted) full-spin behavior isn't worth a model change for.

`tools/animation-lab/designs/attack.json`:
```json
{
  "pinned": false,
  "anchor": { "x": 0, "y": 0 },
  "durationMs": 1500,
  "keyframes": [
    { "offset": 0, "x": 0, "y": 0, "dxFactor": 0, "dyFactor": 0, "rotate": 0, "scale": 1 },
    { "offset": 0.5, "x": -15, "y": -20, "dxFactor": 0.1, "dyFactor": 0.1, "rotate": 180, "scale": 1 },
    { "offset": 1, "x": 25, "y": -25, "dxFactor": 0.15, "dyFactor": 0.15, "rotate": 360, "scale": 1 }
  ]
}
```

`tools/animation-lab/designs/stab.json`:
```json
{
  "pinned": false,
  "anchor": { "x": 0, "y": 0 },
  "durationMs": 1500,
  "keyframes": [
    { "offset": 0, "x": 0, "y": 0, "dxFactor": 0, "dyFactor": 0, "rotate": 135, "scale": 1 },
    { "offset": 0.5, "x": 0, "y": 0, "dxFactor": 0.7, "dyFactor": 0.7, "rotate": 135, "scale": 1 },
    { "offset": 1, "x": 0, "y": 0, "dxFactor": 0, "dyFactor": 0, "rotate": 135, "scale": 1 }
  ]
}
```

`tools/animation-lab/designs/chop.json`:
```json
{
  "pinned": false,
  "anchor": { "x": 0, "y": 0 },
  "durationMs": 1500,
  "keyframes": [
    { "offset": 0, "x": 40, "y": -50, "dxFactor": 0.15, "dyFactor": 0.15, "rotate": -30, "scale": 1 },
    { "offset": 1, "x": -10, "y": 10, "dxFactor": 0.15, "dyFactor": 0.15, "rotate": 10, "scale": 1 }
  ]
}
```

`tools/animation-lab/designs/slash.json`:
```json
{
  "pinned": false,
  "anchor": { "x": 0, "y": 0 },
  "durationMs": 1500,
  "keyframes": [
    { "offset": 0, "x": -24, "y": -24, "dxFactor": 1, "dyFactor": 1, "rotate": -45, "scale": 1 },
    { "offset": 1, "x": 24, "y": 24, "dxFactor": 1, "dyFactor": 1, "rotate": 45, "scale": 1 }
  ]
}
```

`tools/animation-lab/designs/sweep.json` — shaped differently from the single-target abilities, since `playPlayerSweepSwing` builds one keyframe per *live target* at cast time, not a fixed list. `default` reproduces today's exact `(i + 1) * 120deg` per-waypoint rotation with no resize, applied to every target count; `overrides` lets a specific count (starting with none — Task 5 wires the mechanism, an actual "3" override is Timothy's to add later in the tool) diverge:
```json
{
  "default": {
    "pinned": false,
    "anchor": { "x": 0, "y": 0 },
    "durationMs": 1500,
    "leadIn": { "x": 0, "y": 0, "dxFactor": 0, "dyFactor": 0, "rotate": 0, "scale": 1 },
    "perWaypoint": { "x": 0, "y": 0, "dxFactor": 1, "dyFactor": 1, "rotateStep": 120, "scale": 1 }
  },
  "overrides": {}
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tools/animation-lab/keyframes.js tools/animation-lab/designs tests/animationLabKeyframes.test.js
git commit -m "feat: add Animation Lab design validation and seed data ported from today's swing values"
```

---

### Task 4: `battleScreen.js` — shared `buildTransform` helper + marker-wrapped Attack/Stab/Chop/Slash

**Files:**
- Modify: `js/screens/battleScreen.js:598-686` (the `SWING_DURATION_MS` constant and `swingKeyframesFor`)
- Test: `tests/battleScreenDom.test.js` (existing tests must keep passing, no new ones required — this task changes internal values, not observable DOM/emoji/class behavior)

**Interfaces:**
- Consumes: the seed values from `tools/animation-lab/designs/attack.json` / `stab.json` / `chop.json` / `slash.json` (Task 3), embedded here as literal `ANIMATION` objects — this task hand-transcribes them, it doesn't read the JSON files at runtime (the real game has no build step to inline JSON, and doesn't need one: the JSON files are Animation Lab's source of truth for *design*, this file's embedded literals are what actually ships).
- Produces: `buildTransform(pinned, anchor, kf, dx, dy)` at module scope in `battleScreen.js`, callable by every generated `case`.

- [ ] **Step 1: Add the shared `buildTransform` helper**

Add directly above `swingKeyframesFor` (replacing the existing `at()` local helper, which every case below stops using):

```js
// Shared by every ability's generated case inside swingKeyframesFor below -
// kept here as hand-written plumbing (not inside any ANIMATION-DESIGNER
// marker block) since it's identical logic for every ability, not
// per-ability data. Mirrors tools/animation-lab/keyframes.js's own
// buildTransform() byte-for-byte - if one changes, change the other by
// hand and add a matching case to tests/animationLabKeyframesParity.test.js
// (see that file's own header comment).
//
// Pinned: rotates around the fixed `anchor` with the glyph riding a
// rotating arm out to its keyframe position - the CSS transform function
// list composes like nested coordinate frames, so `translate(anchor)
// rotate(deg) translate(arm)` moves the origin to anchor, rotates that
// frame, then places the glyph arm-px out from the rotated origin.
// Free: matches every existing swing's prior behavior exactly - rotates
// the glyph about its own center while translating it along the path.
function resolveXY(point, dx, dy) {
  return {
    x: point.x + dx * (point.dxFactor ?? 0),
    y: point.y + dy * (point.dyFactor ?? 0),
  };
}

function buildTransform(pinned, anchor, kf, dx, dy) {
  const { x, y } = resolveXY(kf, dx, dy);
  if (pinned) {
    const { x: ax, y: ay } = resolveXY(anchor, dx, dy);
    const armX = x - ax;
    const armY = y - ay;
    return `translate(-50%, -50%) translate(${ax}px, ${ay}px) rotate(${kf.rotate}deg) translate(${armX}px, ${armY}px) scale(${kf.scale})`;
  }
  return `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${kf.rotate}deg) scale(${kf.scale})`;
}
```

- [ ] **Step 2: Restructure `SWING_DURATION_MS` with per-ability markers**

Replace:
```js
const SWING_DURATION_MS = { attack: 1500, stab: 1500, chop: 1500, slash: 1500 };
```
with:
```js
const SWING_DURATION_MS = {
  // ANIMATION-DESIGNER:attack:DURATION:START
  attack: 1500,
  // ANIMATION-DESIGNER:attack:DURATION:END
  // ANIMATION-DESIGNER:stab:DURATION:START
  stab: 1500,
  // ANIMATION-DESIGNER:stab:DURATION:END
  // ANIMATION-DESIGNER:chop:DURATION:START
  chop: 1500,
  // ANIMATION-DESIGNER:chop:DURATION:END
  // ANIMATION-DESIGNER:slash:DURATION:START
  slash: 1500,
  // ANIMATION-DESIGNER:slash:DURATION:END
};
```

- [ ] **Step 3: Replace `swingKeyframesFor`'s cases with marker-wrapped, data-driven versions**

Replace the whole function body (keep the function signature and the `at()`-based helper removed) with:

```js
function swingKeyframesFor(abilityId, dx, dy) {
  switch (abilityId) {
    // ANIMATION-DESIGNER:stab:KEYFRAMES:START
    case 'stab': {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":135,"scale":1},{"offset":0.5,"x":0,"y":0,"dxFactor":0.7,"dyFactor":0.7,"rotate":135,"scale":1},{"offset":1,"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":135,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:stab:KEYFRAMES:END
    // ANIMATION-DESIGNER:chop:KEYFRAMES:START
    case 'chop': {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":40,"y":-50,"dxFactor":0.15,"dyFactor":0.15,"rotate":-30,"scale":1},{"offset":1,"x":-10,"y":10,"dxFactor":0.15,"dyFactor":0.15,"rotate":10,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:chop:KEYFRAMES:END
    // ANIMATION-DESIGNER:slash:KEYFRAMES:START
    case 'slash': {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":-24,"y":-24,"dxFactor":1,"dyFactor":1,"rotate":-45,"scale":1},{"offset":1,"x":24,"y":24,"dxFactor":1,"dyFactor":1,"rotate":45,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:slash:KEYFRAMES:END
    // ANIMATION-DESIGNER:attack:KEYFRAMES:START
    default: {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":0,"scale":1},{"offset":0.5,"x":-15,"y":-20,"dxFactor":0.1,"dyFactor":0.1,"rotate":180,"scale":1},{"offset":1,"x":25,"y":-25,"dxFactor":0.15,"dyFactor":0.15,"rotate":360,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:attack:KEYFRAMES:END
  }
}
```

Note `default` (Attack, no ability icon) keeps its position as the switch's fallback arm exactly as today — the marker comments sit around it the same as any other case, `generateKeyframesCaseCode('attack', design)` from Task 2 still emits `case 'attack': { ... }` text, so exporting Attack from the tool will need the exporter to special-case writing that generated block into the `default:` arm rather than a literal `case 'attack':` — call this out explicitly as a one-line special case in Task 10's export step, not solved here.

- [ ] **Step 4: Run the existing test suite to confirm nothing broke**

Run: `npm run test`
Expected: PASS — `tests/battleScreenDom.test.js`'s Attack/Chop/Sweep swing tests (lines 196-253) check DOM structure, emoji, and class presence only, none of which changed.

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "refactor: make swingKeyframesFor data-driven and Animation-Lab-patchable, behavior-preserving"
```

---

### Task 5: `battleScreen.js` — `SWEEP_PROFILES` table + `playPlayerSweepSwing` rewrite

**Files:**
- Modify: `js/screens/battleScreen.js:764-799` (`SWEEP_STAGGER_MS` and `playPlayerSweepSwing`)
- Test: `tests/battleScreenDom.test.js` (existing Sweep test at line 233 must keep passing)

**Interfaces:**
- Consumes: `buildTransform`/`resolveXY` from Task 4.
- Produces: nothing new consumed elsewhere — `playPlayerSweepSwing`'s external signature (`(ability, targetZoneEls)`) is unchanged.

- [ ] **Step 1: Add the marker-wrapped `SWEEP_PROFILES` table**

Add above `playPlayerSweepSwing`:

```js
// ANIMATION-DESIGNER:sweep:PROFILES:START
const SWEEP_PROFILES = {"default":{"pinned":false,"anchor":{"x":0,"y":0},"leadIn":{"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":0,"scale":1},"perWaypoint":{"x":0,"y":0,"dxFactor":1,"dyFactor":1,"rotateStep":120,"scale":1}},"overrides":{}};
// ANIMATION-DESIGNER:sweep:PROFILES:END

function sweepProfileFor(targetCount) {
  return SWEEP_PROFILES.overrides[String(targetCount)] || SWEEP_PROFILES.default;
}
```

- [ ] **Step 2: Rewrite `playPlayerSweepSwing` to read the profile instead of a hardcoded `120deg`**

Replace:
```js
function playPlayerSweepSwing(ability, targetZoneEls) {
  playHeroAttackLunge();
  const emoji = swingSpriteEmoji(ability);
  const totalDurationMs = targetZoneEls.length * SWEEP_STAGGER_MS;
  const startRect = elements.heroZone.getBoundingClientRect();
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const waypoints = targetZoneEls.map((zoneEl) => {
    const rect = zoneEl.getBoundingClientRect();
    return {
      dx: (rect.left + rect.width / 2) - startX,
      dy: (rect.top + rect.height / 2) - startY,
    };
  });
  const keyframesFn = () => [
    { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg)', offset: 0 },
    ...waypoints.map((p, i) => ({
      transform: `translate(-50%, -50%) translate(${p.dx}px, ${p.dy}px) rotate(${(i + 1) * 120}deg)`,
      offset: (i + 1) / waypoints.length,
    })),
  ];
  spawnSwingSprite(emoji, 'battle-swing-sprite battle-swing-sprite-large', elements.heroZone, elements.heroZone, keyframesFn, totalDurationMs);
  spawnSwingTrail(emoji, 'battle-swing-sprite battle-swing-sprite-large', elements.heroZone, elements.heroZone, keyframesFn, totalDurationMs);
}
```
with:
```js
function playPlayerSweepSwing(ability, targetZoneEls) {
  playHeroAttackLunge();
  const emoji = swingSpriteEmoji(ability);
  const profile = sweepProfileFor(targetZoneEls.length);
  const totalDurationMs = targetZoneEls.length * SWEEP_STAGGER_MS;
  const startRect = elements.heroZone.getBoundingClientRect();
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const waypoints = targetZoneEls.map((zoneEl) => {
    const rect = zoneEl.getBoundingClientRect();
    return {
      dx: (rect.left + rect.width / 2) - startX,
      dy: (rect.top + rect.height / 2) - startY,
    };
  });
  const keyframesFn = () => [
    { transform: buildTransform(profile.pinned, profile.anchor, { ...profile.leadIn }, 0, 0), offset: 0 },
    ...waypoints.map((p, i) => {
      const kf = {
        x: profile.perWaypoint.x,
        y: profile.perWaypoint.y,
        dxFactor: profile.perWaypoint.dxFactor,
        dyFactor: profile.perWaypoint.dyFactor,
        rotate: (i + 1) * profile.perWaypoint.rotateStep,
        scale: profile.perWaypoint.scale,
      };
      return {
        transform: buildTransform(profile.pinned, profile.anchor, kf, p.dx, p.dy),
        offset: (i + 1) / waypoints.length,
      };
    }),
  ];
  spawnSwingSprite(emoji, 'battle-swing-sprite battle-swing-sprite-large', elements.heroZone, elements.heroZone, keyframesFn, totalDurationMs);
  spawnSwingTrail(emoji, 'battle-swing-sprite battle-swing-sprite-large', elements.heroZone, elements.heroZone, keyframesFn, totalDurationMs);
}
```

This reproduces today's math exactly: `default.perWaypoint.dxFactor/dyFactor = 1` with `x=0,y=0` means `resolveXY` returns `(p.dx, p.dy)` unchanged (today's literal `p.dx`/`p.dy`), `rotateStep: 120` reproduces `(i+1)*120`, `pinned: false` reproduces the plain translate-then-rotate composition, and `scale: 1` is a no-op (today's code has no scale at all).

- [ ] **Step 3: Run the existing test suite to confirm nothing broke**

Run: `npm run test`
Expected: PASS — `tests/battleScreenDom.test.js`'s Sweep test (line 233) only checks sprite count and hit-sequence timing, both unchanged.

- [ ] **Step 4: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "refactor: make Sweep's swing profile data-driven and Animation-Lab-patchable, behavior-preserving"
```

---

### Task 6: Animation Lab page shell + WYSIWYG preview area

**Files:**
- Create: `tools/animation-lab/index.html`
- Create: `tools/animation-lab/lab.js`

**Interfaces:**
- Consumes: real `css/styles.css` (loaded via `<link>`), `ITEMS` from `js/data/items.js` (for the weapon-emoji preview picker). `keyframes.js`'s `buildWaapiKeyframes` isn't used until Task 8 — not imported here.
- Produces: a `#labStage` DOM area containing real `battle-combatant`/`battle-monster-slot`/`battle-hero-zone` markup, an ability/weapon picker, and a target-count preset selector. No editing interactions yet (Task 7) and no playback yet (Task 8) — this task only gets the accurate static preview on screen.

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Animation Lab</title>
<link rel="stylesheet" href="../../css/styles.css">
<style>
  body { background: #111; color: #eee; font-family: monospace; margin: 0; padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  details#helpDetails summary { cursor: pointer; font-size: 12px; color: #ddd; padding: 4px 0; }
  details#helpDetails p { font-size: 12px; color: #aaa; max-width: 900px; }
  #topControls { margin-top: 12px; display: flex; align-items: center; gap: 16px; font-size: 12px; }
  #topControls select { background: #222; color: #eee; border: 2px solid #444; font-family: monospace; padding: 4px; }
  #labStage {
    position: relative; margin-top: 16px; min-height: 260px; background: #1a1a1a;
    border: 1px solid #444; display: flex; align-items: center; justify-content: space-between; padding: 24px;
  }
  #labStage .battle-monster-row { display: flex; gap: 12px; }
  #anchorHandle {
    position: absolute; width: 12px; height: 12px; border-radius: 50%;
    background: #e07b39; border: 2px solid #fff; cursor: grab; transform: translate(-50%, -50%);
  }
</style>
</head>
<body>
<h1>Animation Lab</h1>
<details id="helpDetails">
<summary>❓ Help — what everything does (click to expand)</summary>
<p>
  Dev-only tool for designing the battle screen's weapon-swing animations
  (Attack/Stab/Chop/Slash/Sweep). Pick an ability and a target-count preset,
  drag the orange anchor dot to where the weapon should pivot from, then add
  keyframes on the timeline and drag each one's position/rotation/scale.
  Play previews using the exact same animation call the real game uses.
  Export writes straight into <code>js/screens/battleScreen.js</code> and
  <code>tools/animation-lab/designs/*.json</code> - see this tool's own
  README.md for the full save/export workflow.
</p>
</details>
<div id="topControls">
  <label for="abilitySelect">Ability:</label>
  <select id="abilitySelect">
    <option value="attack">Attack</option>
    <option value="stab">Stab</option>
    <option value="chop">Chop</option>
    <option value="slash">Slash</option>
    <option value="sweep">Sweep</option>
  </select>
  <label for="weaponSelect">Weapon (preview only):</label>
  <select id="weaponSelect"></select>
  <label for="targetCountSelect">Targets:</label>
  <select id="targetCountSelect">
    <option value="1">1</option>
    <option value="3">3</option>
    <option value="4">4</option>
  </select>
</div>
<div id="labStage">
  <div class="battle-monster-row" id="labMonsterRow"></div>
  <div class="battle-divider">⚔️</div>
  <div class="battle-combatant" id="labHeroZone">
    <div class="battle-emoji" id="labHeroEmoji">🧑</div>
    <div class="battle-name">You</div>
  </div>
  <div id="anchorHandle" title="Drag to set the pin/pivot point"></div>
</div>
<script type="module" src="lab.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write the static preview portion of `lab.js`**

```js
// tools/animation-lab/lab.js
//
// Dev-only UI for designing weapon-swing animations. Reuses the real battle
// screen's CSS/DOM classes (via index.html's <link> to css/styles.css) so
// the preview is what the game will actually render, not a lookalike.
import { ITEMS } from '../../js/data/items.js';

const ABILITY_ICONS = { attack: null, stab: '🥊', chop: '🪓', slash: '⚔️', sweep: '🌪️' };

const abilitySelect = document.getElementById('abilitySelect');
const weaponSelect = document.getElementById('weaponSelect');
const targetCountSelect = document.getElementById('targetCountSelect');
const stage = document.getElementById('labStage');
const monsterRow = document.getElementById('labMonsterRow');
const heroZone = document.getElementById('labHeroZone');
const anchorHandle = document.getElementById('anchorHandle');

function populateWeaponSelect() {
  Object.values(ITEMS)
    .filter((item) => item.slot === 'weapon')
    .forEach((weapon) => {
      const option = document.createElement('option');
      option.value = weapon.id;
      option.textContent = `${weapon.swingEmoji || weapon.emoji} ${weapon.name}`;
      weaponSelect.appendChild(option);
    });
}

function currentSwingEmoji() {
  const abilityId = abilitySelect.value;
  if (ABILITY_ICONS[abilityId]) return ABILITY_ICONS[abilityId];
  const weapon = ITEMS[weaponSelect.value];
  return weapon?.swingEmoji || weapon?.emoji || '👊';
}

function renderTargets() {
  const count = Number(targetCountSelect.value);
  monsterRow.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'battle-combatant battle-monster-slot';
    slot.id = `labMonsterZone${i}`;
    slot.innerHTML = '<div class="battle-emoji battle-monster-emoji">👹</div><div class="battle-name">Target</div>';
    monsterRow.appendChild(slot);
  }
}

populateWeaponSelect();
renderTargets();
abilitySelect.addEventListener('change', renderTargets);
targetCountSelect.addEventListener('change', renderTargets);
weaponSelect.addEventListener('change', renderTargets);
```

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000` from repo root, open `http://localhost:8000/tools/animation-lab/index.html`.
Expected: page loads with real battle-screen styling (dark panel, hero/monster boxes matching the actual game's look), switching the target-count dropdown changes how many monster boxes render, switching the ability/weapon dropdown is wired (no visible change yet — the swing emoji isn't drawn until Task 8).

- [ ] **Step 4: Commit**

```bash
git add tools/animation-lab/index.html tools/animation-lab/lab.js
git commit -m "feat: add Animation Lab page shell with WYSIWYG battle-screen preview"
```

---

### Task 7: Anchor + keyframe timeline editing

**Files:**
- Modify: `tools/animation-lab/index.html` (add timeline markup)
- Modify: `tools/animation-lab/lab.js`

**Interfaces:**
- Consumes: the DOM/state from Task 6.
- Produces: a mutable in-memory `currentDesign` object (same shape `keyframes.js` validates), a `#timeline` UI to add/remove/select keyframe stops, and drag handles that mutate the selected keyframe's `x`/`y`/`rotate`/`scale`. Task 8 reads `currentDesign` to preview; Task 9 persists it.

- [ ] **Step 1: Add timeline markup to `index.html`**

Insert before `<script type="module" src="lab.js">`:
```html
<div id="timelineControls" style="margin-top: 16px; font-size: 12px;">
  <button id="addKeyframeBtn">+ Add keyframe</button>
  <button id="removeKeyframeBtn">Remove selected</button>
  <label>Pinned: <input type="checkbox" id="pinnedToggle"></label>
</div>
<div id="timeline" style="margin-top: 8px; display: flex; gap: 4px;"></div>
<div id="keyframeInspector" style="margin-top: 8px; font-size: 12px; display: flex; gap: 12px; align-items: center;">
  <label>x <input type="number" id="kfX" style="width: 60px;"></label>
  <label>y <input type="number" id="kfY" style="width: 60px;"></label>
  <label>rotate <input type="number" id="kfRotate" style="width: 60px;"></label>
  <label>scale <input type="number" id="kfScale" step="0.1" style="width: 60px;"></label>
</div>
```

- [ ] **Step 2: Add design state, timeline rendering, and the inspector wiring to `lab.js`**

```js
// append to tools/animation-lab/lab.js
const DEFAULT_KEYFRAME = { offset: 0, x: 0, y: 0, dxFactor: 0, dyFactor: 0, rotate: 0, scale: 1 };

let currentDesign = { pinned: false, anchor: { x: 0, y: 0 }, durationMs: 1500, keyframes: [{ ...DEFAULT_KEYFRAME }, { ...DEFAULT_KEYFRAME, offset: 1 }] };
let selectedKeyframeIndex = 0;

const addKeyframeBtn = document.getElementById('addKeyframeBtn');
const removeKeyframeBtn = document.getElementById('removeKeyframeBtn');
const pinnedToggle = document.getElementById('pinnedToggle');
const timelineEl = document.getElementById('timeline');
const kfXInput = document.getElementById('kfX');
const kfYInput = document.getElementById('kfY');
const kfRotateInput = document.getElementById('kfRotate');
const kfScaleInput = document.getElementById('kfScale');

function renderTimeline() {
  timelineEl.innerHTML = '';
  currentDesign.keyframes.forEach((kf, i) => {
    const stop = document.createElement('button');
    stop.textContent = `${Math.round(kf.offset * 100)}%`;
    stop.style.border = i === selectedKeyframeIndex ? '2px solid #fff' : '2px solid #444';
    stop.addEventListener('click', () => selectKeyframe(i));
    timelineEl.appendChild(stop);
  });
  updateAnchorHandlePosition();
}

function selectKeyframe(i) {
  selectedKeyframeIndex = i;
  const kf = currentDesign.keyframes[i];
  kfXInput.value = kf.x;
  kfYInput.value = kf.y;
  kfRotateInput.value = kf.rotate;
  kfScaleInput.value = kf.scale;
  renderTimeline();
}

function updateAnchorHandlePosition() {
  const stageRect = stage.getBoundingClientRect();
  const heroRect = heroZone.getBoundingClientRect();
  const heroCenterX = heroRect.left + heroRect.width / 2 - stageRect.left;
  const heroCenterY = heroRect.top + heroRect.height / 2 - stageRect.top;
  anchorHandle.style.left = `${heroCenterX + currentDesign.anchor.x}px`;
  anchorHandle.style.top = `${heroCenterY + currentDesign.anchor.y}px`;
}

addKeyframeBtn.addEventListener('click', () => {
  currentDesign.keyframes.push({ ...DEFAULT_KEYFRAME, offset: 1 });
  currentDesign.keyframes.sort((a, b) => a.offset - b.offset);
  renderTimeline();
});

removeKeyframeBtn.addEventListener('click', () => {
  if (currentDesign.keyframes.length <= 2) return;
  currentDesign.keyframes.splice(selectedKeyframeIndex, 1);
  selectedKeyframeIndex = 0;
  renderTimeline();
  selectKeyframe(0);
});

pinnedToggle.addEventListener('change', () => {
  currentDesign.pinned = pinnedToggle.checked;
});

[kfXInput, kfYInput, kfRotateInput, kfScaleInput].forEach((input) => {
  input.addEventListener('input', () => {
    const kf = currentDesign.keyframes[selectedKeyframeIndex];
    kf.x = Number(kfXInput.value);
    kf.y = Number(kfYInput.value);
    kf.rotate = Number(kfRotateInput.value);
    kf.scale = Number(kfScaleInput.value);
  });
});

let draggingAnchor = false;
anchorHandle.addEventListener('mousedown', () => { draggingAnchor = true; });
window.addEventListener('mouseup', () => { draggingAnchor = false; });
window.addEventListener('mousemove', (e) => {
  if (!draggingAnchor) return;
  const stageRect = stage.getBoundingClientRect();
  const heroRect = heroZone.getBoundingClientRect();
  const heroCenterX = heroRect.left + heroRect.width / 2;
  const heroCenterY = heroRect.top + heroRect.height / 2;
  currentDesign.anchor.x = e.clientX - heroCenterX;
  currentDesign.anchor.y = e.clientY - heroCenterY;
  updateAnchorHandlePosition();
});

renderTimeline();
selectKeyframe(0);
```

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000`, open the tool.
Expected: timeline shows two stops (0%, 100%), clicking one loads its x/y/rotate/scale into the inspector fields, editing a field updates `currentDesign` (confirm via browser devtools console: `import('./lab.js')` isn't needed — just eyeball the inspector fields round-tripping after re-selecting a stop), dragging the orange anchor dot moves it and updates `currentDesign.anchor`.

- [ ] **Step 4: Commit**

```bash
git add tools/animation-lab/index.html tools/animation-lab/lab.js
git commit -m "feat: add Animation Lab timeline/keyframe editing and anchor dragging"
```

---

### Task 8: Play/scrub preview using the real animation call

**Files:**
- Modify: `tools/animation-lab/index.html` (add Play button)
- Modify: `tools/animation-lab/lab.js`

**Interfaces:**
- Consumes: `buildWaapiKeyframes` from `keyframes.js` (Task 1), `currentDesign` (Task 7).
- Produces: a `playPreview()` function wired to a Play button, spawning a real emoji sprite and animating it with `Element.animate()` exactly like `spawnSwingSprite` in `battleScreen.js` does.

- [ ] **Step 1: Add the Play button to `index.html`**

Insert inside `#timelineControls`, after the existing buttons:
```html
<button id="playBtn">▶ Play</button>
```

- [ ] **Step 2: Add preview playback to `lab.js`**

```js
// append to tools/animation-lab/lab.js
import { buildWaapiKeyframes } from './keyframes.js';

const playBtn = document.getElementById('playBtn');

function firstTargetZone() {
  return monsterRow.firstElementChild;
}

function playPreview() {
  const targetZone = firstTargetZone();
  if (!targetZone) return;
  const heroRect = heroZone.getBoundingClientRect();
  const targetRect = targetZone.getBoundingClientRect();
  const dx = (targetRect.left + targetRect.width / 2) - (heroRect.left + heroRect.width / 2);
  const dy = (targetRect.top + targetRect.height / 2) - (heroRect.top + heroRect.height / 2);

  const sprite = document.createElement('div');
  sprite.textContent = currentSwingEmoji();
  sprite.className = 'battle-swing-sprite';
  sprite.style.position = 'fixed';
  sprite.style.left = `${heroRect.left + heroRect.width / 2}px`;
  sprite.style.top = `${heroRect.top + heroRect.height / 2}px`;
  document.body.appendChild(sprite);

  const waapiKeyframes = buildWaapiKeyframes(currentDesign, dx, dy);
  const animation = sprite.animate(waapiKeyframes, { duration: currentDesign.durationMs, easing: 'ease-out', fill: 'forwards' });
  animation.onfinish = () => sprite.remove();
}

playBtn.addEventListener('click', playPreview);
```

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000`, open the tool, select Chop, click Play.
Expected: the swing emoji animates from the hero toward the first target zone using the keyframe values currently in the inspector; editing a keyframe's rotate/scale and clicking Play again visibly reflects the change.

- [ ] **Step 4: Commit**

```bash
git add tools/animation-lab/index.html tools/animation-lab/lab.js
git commit -m "feat: add Animation Lab preview playback via the real Element.animate call"
```

---

### Task 9: Persistence — localStorage autosave + loading real designs

**Files:**
- Modify: `tools/animation-lab/lab.js`

**Interfaces:**
- Consumes: `tools/animation-lab/designs/*.json` (Task 3, fetched over the dev server — no File System Access needed for reading), `validateDesign` (Task 3).
- Produces: `AUTOSAVE_KEY` in `localStorage`, a `loadDesignForAbility(abilityId)` function called whenever the ability dropdown changes.

- [ ] **Step 1: Add autosave + load-on-switch to `lab.js`**

```js
// append to tools/animation-lab/lab.js
import { validateDesign } from './keyframes.js';

const AUTOSAVE_KEY = 'animation-lab-autosave-v1';

function autosave() {
  try {
    const all = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || '{}');
    all[abilitySelect.value] = currentDesign;
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(all));
  } catch {
    // localStorage may be unavailable (private browsing, quota) - editing
    // still works for the current session, just without the safety net.
  }
}

async function loadDesignForAbility(abilityId) {
  try {
    const all = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || '{}');
    if (all[abilityId] && validateDesign(all[abilityId]).length === 0) {
      currentDesign = all[abilityId];
      return;
    }
  } catch {
    // fall through to loading from the real file below
  }
  const response = await fetch(`./designs/${abilityId}.json`);
  currentDesign = await response.json();
}

abilitySelect.addEventListener('change', async () => {
  await loadDesignForAbility(abilitySelect.value);
  selectedKeyframeIndex = 0;
  pinnedToggle.checked = currentDesign.pinned;
  renderTimeline();
  selectKeyframe(0);
});

[kfXInput, kfYInput, kfRotateInput, kfScaleInput, pinnedToggle].forEach((input) => {
  input.addEventListener('input', autosave);
});
addKeyframeBtn.addEventListener('click', autosave);
removeKeyframeBtn.addEventListener('click', autosave);

loadDesignForAbility(abilitySelect.value).then(() => {
  pinnedToggle.checked = currentDesign.pinned;
  renderTimeline();
  selectKeyframe(0);
});
```

`sweep` is a Sweep-shaped file (`{ default, overrides }`, no `pinned`/`keyframes` at top level per Task 3's `sweep.json`), so `validateDesign`/`currentDesign` as written here only apply to the four single-target abilities. Note this explicitly rather than silently mishandling it: for this task, wire the ability dropdown's Sweep option to skip `loadDesignForAbility` and instead just disable the timeline/inspector with a short "Sweep profile editing isn't wired into the timeline UI yet" message — Task 10 also does not add Sweep export. Leaving full Sweep-profile editing UI (per-target-count switching, `leadIn`/`perWaypoint` fields instead of a flat keyframe list) as clearly-flagged future work keeps this plan's scope to what's concretely specified, rather than guessing at a second UI shape.

- [ ] **Step 2: Add the Sweep guard**

```js
// append to tools/animation-lab/lab.js
function updateSweepGuard() {
  const isSweep = abilitySelect.value === 'sweep';
  timelineEl.style.display = isSweep ? 'none' : 'flex';
  document.getElementById('keyframeInspector').style.display = isSweep ? 'none' : 'flex';
  playBtn.disabled = isSweep;
  let notice = document.getElementById('sweepNotice');
  if (isSweep && !notice) {
    notice = document.createElement('p');
    notice.id = 'sweepNotice';
    notice.style.fontSize = '12px';
    notice.style.color = '#e0a539';
    notice.textContent = 'Sweep profile editing (per-target-count leadIn/perWaypoint fields) isn\'t wired into this UI yet - edit tools/animation-lab/designs/sweep.json by hand for now.';
    timelineEl.after(notice);
  }
  if (notice) notice.style.display = isSweep ? 'block' : 'none';
}

abilitySelect.addEventListener('change', updateSweepGuard);
updateSweepGuard();
```

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000`, open the tool.
Expected: on load, Chop's timeline shows the two real ported keyframes from `designs/chop.json` (not the two-zero defaults from Task 7); editing a value, then switching to another ability and back restores the edited value (autosave round-trip); selecting Sweep hides the timeline/inspector and shows the notice.

- [ ] **Step 4: Commit**

```bash
git add tools/animation-lab/lab.js
git commit -m "feat: add Animation Lab autosave and real-design loading"
```

---

### Task 10: Export — direct file write + copy/paste fallback

**Files:**
- Modify: `tools/animation-lab/index.html` (add export controls)
- Modify: `tools/animation-lab/lab.js`

**Interfaces:**
- Consumes: `generateKeyframesCaseCode`, `generateDurationEntryCode`, `patchMarkedBlock` (Task 2), `currentDesign` (Task 7/9).
- Produces: writes `tools/animation-lab/designs/<abilityId>.json` and patches the two marker blocks for that ability in `js/screens/battleScreen.js`, via the same "Choose Repo Folder" File System Access flow `tools/terrain-painter/painter.js` already uses; a Firefox/Safari fallback that copies the generated JSON/code to the clipboard.

- [ ] **Step 1: Add export controls to `index.html`**

Insert before `<script type="module" src="lab.js">`:
```html
<div id="exportControls" style="margin-top: 16px; font-size: 12px; display: flex; align-items: center; gap: 8px;">
  <button id="chooseRepoBtn">Choose Repo Folder</button>
  <span id="repoStatus">No folder chosen - writes straight to disk once you pick your repo's root folder.</span>
</div>
<div id="exportControls2" style="margin-top: 8px; font-size: 12px; display: flex; align-items: center; gap: 8px;">
  <button id="exportBtn">Export to Files</button>
  <button id="copyJsonBtn">Copy JSON</button>
  <button id="copyCodeBtn">Copy generated code</button>
  <span id="exportStatus"></span>
</div>
<textarea id="exportOutput" readonly style="width: 100%; max-width: 900px; height: 100px; margin-top: 8px; background: #000; color: #0f0; font-family: monospace; font-size: 12px;" placeholder="Copied output also appears here, in case clipboard access is blocked."></textarea>
```

- [ ] **Step 2: Add File System Access export to `lab.js`**

```js
// append to tools/animation-lab/lab.js
import { generateKeyframesCaseCode, generateDurationEntryCode, patchMarkedBlock } from './keyframes.js';

const chooseRepoBtn = document.getElementById('chooseRepoBtn');
const repoStatus = document.getElementById('repoStatus');
const exportBtn = document.getElementById('exportBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const exportStatus = document.getElementById('exportStatus');
const exportOutput = document.getElementById('exportOutput');

let repoHandle = null;

chooseRepoBtn.addEventListener('click', async () => {
  repoHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  repoStatus.textContent = `Writing to: ${repoHandle.name}`;
});

async function writeFile(relativePath, contents) {
  const parts = relativePath.split('/');
  let dir = repoHandle;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  const fh = await dir.getFileHandle(parts[parts.length - 1]);
  const writable = await fh.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function readFile(relativePath) {
  const parts = relativePath.split('/');
  let dir = repoHandle;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  const fh = await dir.getFileHandle(parts[parts.length - 1]);
  return (await fh.getFile()).text();
}

// swingKeyframesFor's Attack case is the switch's `default:` arm, not a
// literal `case 'attack':` (js/screens/battleScreen.js, see Task 4's own
// note on this) - the generated case-header text is swapped for that one
// ability only, the marker comments and everything else about the patch
// are identical to every other ability.
function keyframesCodeFor(abilityId, design) {
  const code = generateKeyframesCaseCode(abilityId, design);
  if (abilityId === 'attack') return code.replace(/^case 'attack':/, 'default:');
  return code;
}

async function exportToFiles() {
  const abilityId = abilitySelect.value;
  if (abilityId === 'sweep') {
    exportStatus.textContent = 'Sweep export not wired up yet - edit designs/sweep.json by hand.';
    return;
  }
  if (!repoHandle) {
    exportStatus.textContent = 'Choose a repo folder first.';
    return;
  }
  await writeFile(`tools/animation-lab/designs/${abilityId}.json`, JSON.stringify(currentDesign, null, 2));

  let battleScreenText = await readFile('js/screens/battleScreen.js');
  battleScreenText = patchMarkedBlock(battleScreenText, `${abilityId}:KEYFRAMES`, keyframesCodeFor(abilityId, currentDesign));
  battleScreenText = patchMarkedBlock(battleScreenText, `${abilityId}:DURATION`, generateDurationEntryCode(abilityId, currentDesign));
  await writeFile('js/screens/battleScreen.js', battleScreenText);

  exportStatus.textContent = `Exported ${abilityId} to designs/${abilityId}.json and battleScreen.js.`;
}

exportBtn.addEventListener('click', exportToFiles);

copyJsonBtn.addEventListener('click', async () => {
  const text = JSON.stringify(currentDesign, null, 2);
  exportOutput.value = text;
  try { await navigator.clipboard.writeText(text); exportStatus.textContent = 'JSON copied to clipboard.'; }
  catch { exportStatus.textContent = 'Clipboard blocked - copy from the box below.'; }
});

copyCodeBtn.addEventListener('click', async () => {
  const abilityId = abilitySelect.value;
  const text = `${keyframesCodeFor(abilityId, currentDesign)}\n\n${generateDurationEntryCode(abilityId, currentDesign)}`;
  exportOutput.value = text;
  try { await navigator.clipboard.writeText(text); exportStatus.textContent = 'Generated code copied to clipboard.'; }
  catch { exportStatus.textContent = 'Clipboard blocked - copy from the box below.'; }
});

if (!window.showDirectoryPicker) {
  chooseRepoBtn.disabled = true;
  exportBtn.disabled = true;
  repoStatus.textContent = 'File System Access API unavailable in this browser (Firefox/Safari) - use Copy JSON / Copy generated code instead.';
}
```

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000`, open the tool in Chrome, select Chop, nudge a keyframe's rotate value, click "Choose Repo Folder" and pick the repo root, click "Export to Files".
Expected: `tools/animation-lab/designs/chop.json` and the `chop` blocks in `js/screens/battleScreen.js` update on disk with the new rotate value; run `npm run test` afterward — still passes (only the embedded `ANIMATION` literal's numbers changed, not the surrounding code shape).
Then test the fallback: in a browser without File System Access (or by leaving no repo folder chosen), click "Copy generated code" and confirm the textarea fills with valid-looking `case 'chop': { ... }` text.

- [ ] **Step 4: Commit**

```bash
git add tools/animation-lab/index.html tools/animation-lab/lab.js
git commit -m "feat: add Animation Lab direct-to-disk export and copy/paste fallback"
```

---

### Task 11: README + CHANGELOG

**Files:**
- Create: `tools/animation-lab/README.md`
- Modify: `CHANGELOG.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Write `tools/animation-lab/README.md`**

```markdown
# Animation Lab

A browser-based, dev-only tool for designing the battle screen's
weapon-swing animations (Attack/Stab/Chop/Slash/Sweep). Reuses the real
`css/styles.css` and battle-screen markup so the preview is what the game
actually renders, and previews using the exact same `Element.animate()`
call `js/screens/battleScreen.js` uses in the real game.

It is never deployed - `.github/workflows/deploy.yml` stages an explicit
allowlist of files/dirs into the live build, and `tools/` isn't on it. It
only exists locally.

## Run it

```bash
python3 -m http.server 8000
```
from the repo root, then open http://localhost:8000/tools/animation-lab/index.html.

## The animation model

Every single-target ability (`attack`/`stab`/`chop`/`slash`) is a list of
keyframes on a 0-1 timeline, each with `x`/`y`/`rotate`/`scale`, plus one
`anchor` point and a `pinned` toggle:

- **Pinned** (Attack/Chop should be this): the glyph rotates around the
  fixed `anchor` point, riding a rigid arm out to each keyframe's position -
  like a weapon actually held at a fixed point in the hero's hand.
- **Free** (a thrown/flying weapon): the glyph rotates about its own center
  while translating along the keyframe path - the anchor is ignored.

Every `x`/`y` (and the anchor's own `x`/`y`) is `base + dx * dxFactor`
where `dx`/`dy` are the live distance to whatever target is actually being
hit that battle - matching the `dx * 0.15 + 40` pattern already used
throughout `battleScreen.js` before this tool existed.

Sweep is shaped differently (`designs/sweep.json`'s `default`/`overrides`
by target count) since it plays through several live targets in sequence
rather than one fixed keyframe list - not yet editable in this tool's UI
(no export path either). Hand-edit `designs/sweep.json`, then hand-edit
the matching `SWEEP_PROFILES` value between the
`// ANIMATION-DESIGNER:sweep:PROFILES:...` markers in
`js/screens/battleScreen.js` to match - there's no automated patcher for
Sweep yet, both files have to be kept in sync by hand until the UI catches
up.

## How saving actually works

Same shape as `tools/terrain-painter/`'s workflow:

- Autosaves to `localStorage` (key `animation-lab-autosave-v1`) as you
  edit. If you clear your browser's site data before exporting,
  unexported changes are gone - the tool falls back to loading straight
  from `designs/<ability>.json` on the next open.
- **Export to Files** (Chrome/Edge): click "Choose Repo Folder" once per
  session, pick the repo's root folder, then "Export to Files" writes the
  design JSON and patches the matching marker-commented block in
  `js/screens/battleScreen.js` - only that block, nothing else in the file
  is touched.
- **Firefox/Safari**: "Choose Repo Folder"/"Export to Files" are disabled
  (no File System Access API) - use "Copy JSON" and "Copy generated code"
  and paste them in by hand: the JSON into
  `tools/animation-lab/designs/<ability>.json`, the code between the
  matching `// ANIMATION-DESIGNER:<ability>:...` marker comments in
  `js/screens/battleScreen.js`.
- Always run `npm run test` after exporting, then commit.

## Known gaps (not built yet)

- Sweep has no timeline/inspector UI - its `leadIn`/`perWaypoint` fields
  are hand-edited JSON only.
- No keyframing of the hero's own position/motion (it keeps its existing
  fixed lunge-and-snap-back) - out of scope by design, see
  `docs/superpowers/specs/2026-08-30-animation-lab-design.md`.
```

- [ ] **Step 2: Add the CHANGELOG entry**

Add under `## [Unreleased]` in `CHANGELOG.md` (create the section if the top of the file doesn't currently have one open):

```markdown
### Added
- Animation Lab (`tools/animation-lab/`): a dev-only visual tool for
  designing weapon-swing animations, following the same never-deployed,
  no-build-step pattern as `tools/terrain-painter/`.

### Changed
- Weapon-swing keyframes (Attack/Stab/Chop/Slash/Sweep) are now
  data-driven inside `js/screens/battleScreen.js`, so Animation Lab can
  regenerate them - no visible gameplay change from this alone.
```

- [ ] **Step 3: Run the full test suite one more time**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tools/animation-lab/README.md CHANGELOG.md
git commit -m "docs: add Animation Lab README and CHANGELOG entry"
```
