// Tests for the canvas renderer's draw list (js/systems/mapDrawList.js),
// driven through a real mapScreen mount against real maps and real game
// state - not hand-built signatures, so these exercise the same path the
// game does.
//
// This is the canvas renderer's equivalent of what tests/mapScreenDom.test.js
// asserts about DOM structure. jsdom has no canvas implementation
// (getContext('2d') returns null there), so pixels can't be asserted - but
// the draw list is plain data, and it carries strictly more than the DOM
// version could check: the DOM tests could read a font-size string off a
// span, while these can assert the actual paint ORDER, which is what makes
// obstacle overlap and the portal/guardian always-on-top rules work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { townMap } from '../js/maps/townMap.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';
import { TILES } from '../js/tiles.js';
import {
  GUARDIAN_PX, FULL_SQUARE_PX, HERO_AND_LOOT_PX, TILE_SIZE_PX,
  OBSTACLE_MAX_EXTRA, GROUND_COLOR_GRASS, GROUND_COLOR_WATER, GROUND_COLOR_DEFAULT,
} from '../js/systems/mapRenderModel.js';
import { hash01 } from '../js/systems/world.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), position: { ...townMap.startPosition }, ...overrides };
}

async function mountMap(mapConfig, maps, state) {
  const { mount, __getDrawListForTest } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  mount(root, {
    // Explicit rather than relying on the default, so this file keeps
    // testing the canvas path even if the default ever changes.
    renderer: 'canvas',
    state,
    mapConfig,
    maps,
    worldGrid: buildWorldGrid(maps),
    callbacks: { onFirstVisit: () => {}, onMove: () => {}, onAction: () => {} },
  });
  return __getDrawListForTest();
}

async function mountTown(state) {
  return mountMap(townMap, { town: townMap }, state);
}

function opsAt(drawList, gx, gy) {
  return drawList.ops.filter((op) => op.gx === gx && op.gy === gy);
}

function glyphsAt(drawList, gx, gy) {
  return opsAt(drawList, gx, gy).filter((op) => op.op === 'glyph');
}

// Town is a lone screen, so its cluster origin is (0, 0) and a map-local
// (x, y) is also its world (gx, gy) - see screenToGlobal in worldGrid.js.
function findTile(map, kind) {
  for (let y = 0; y < map.rows.length; y++) {
    for (let x = 0; x < map.rows[y].length; x++) {
      if (map.legend[map.rows[y][x]] === kind) return { x, y };
    }
  }
  throw new Error(`${map.id} has no ${kind} tile`);
}

test('mapDrawList - ground', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  // The DOM renderer's equivalent guard was "every viewport cell renders its
  // own .map-tile div, including ones outside the map itself" - a regression
  // there let CSS grid auto-flow silently pack real cells into the wrong
  // rows. The canvas equivalent is that every viewport cell paints ground,
  // including the ones that resolve to nothing.
  await t.test('every viewport cell emits exactly one ground op, including cells outside the map', async () => {
    const drawList = await mountTown(baseState());
    const ground = drawList.ops.filter((op) => op.op === 'ground');
    assert.equal(ground.length, 21 * 13, 'expected one ground op per viewport cell (DEFAULT_VIEWPORT_TILES_WIDE x TALL)');
  });

  await t.test('ground color follows the tile: grass, water, and the bare default for unresolved cells', async () => {
    const drawList = await mountTown(baseState());
    const grass = findTile(townMap, 'grass');
    assert.equal(opsAt(drawList, grass.x, grass.y)[0].color, GROUND_COLOR_GRASS);

    // Town is 20 wide; the fallback viewport is 21, so the rightmost column
    // resolves to nothing and falls back to the bare default background.
    const outside = drawList.ops.find((op) => op.op === 'ground' && op.gx >= townMap.rows[0].length);
    assert.ok(outside, 'expected at least one cell past the map edge');
    assert.equal(outside.color, GROUND_COLOR_DEFAULT);
  });

  await t.test('water tiles paint the contiguous water color', async () => {
    const maps = { pond: {
      id: 'pond', legend: { '.': 'grass', '~': 'water' },
      rows: ['...', '.~.', '...'], neighbors: {}, monsterTable: [], encounterChance: 0, cacheChance: 0,
    } };
    const drawList = await mountMap(maps.pond, maps, baseState({ position: { x: 0, y: 0 }, map: 'pond' }));
    assert.equal(opsAt(drawList, 1, 1)[0].color, GROUND_COLOR_WATER);
  });
});

test('mapDrawList - landmarks and markers', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('the hero renders at HERO_AND_LOOT_PX, flagged as the player', async () => {
    const state = baseState();
    const drawList = await mountTown(state);
    const { x, y } = state.position;
    const hero = glyphsAt(drawList, x, y).find((op) => op.isPlayer);
    assert.ok(hero, 'expected a player glyph on the hero tile');
    assert.equal(hero.emoji, state.player.emoji);
    assert.equal(hero.sizePx, HERO_AND_LOOT_PX);
    assert.equal(hero.anchor, 'center');
    assert.deepEqual(drawList.playerTile, { gx: x, gy: y });
  });

  // "Make the tool bosses take up like 4 tiles instead of 1 so they look big
  // and scary" - see GUARDIAN_PX's own comment in mapRenderModel.js. The DOM
  // test asserted the string '105.6px'; this asserts the number itself.
  await t.test('a guardian renders oversized at GUARDIAN_PX, not the plain landmark size', async () => {
    const { axeDungeonMap } = await import('../js/maps/toolDungeons/axeDungeon.js');
    const maps = { axeDungeon: axeDungeonMap };
    const drawList = await mountMap(axeDungeonMap, maps, baseState({
      position: { ...axeDungeonMap.startPosition }, map: 'axeDungeon',
    }));
    const { x, y } = findTile(axeDungeonMap, 'guardian');
    const glyph = glyphsAt(drawList, x, y).at(-1);
    assert.equal(glyph.sizePx, GUARDIAN_PX);
    assert.notEqual(glyph.sizePx, FULL_SQUARE_PX);
    assert.equal(glyph.sizePx, 2.2 * TILE_SIZE_PX);
  });

  await t.test('a guardian tile still paints grass underneath, not the bare default', async () => {
    const { axeDungeonMap } = await import('../js/maps/toolDungeons/axeDungeon.js');
    const maps = { axeDungeon: axeDungeonMap };
    const drawList = await mountMap(axeDungeonMap, maps, baseState({
      position: { ...axeDungeonMap.startPosition }, map: 'axeDungeon',
    }));
    const { x, y } = findTile(axeDungeonMap, 'guardian');
    const ground = opsAt(drawList, x, y).filter((op) => op.op === 'ground');
    assert.ok(ground.length >= 1);
    assert.ok(ground.every((op) => op.color === GROUND_COLOR_GRASS));
  });

  await t.test('all 4 town features get a signpost label, and nothing else does', async () => {
    const drawList = await mountTown(baseState());
    const labels = drawList.ops.filter((op) => op.op === 'label').map((op) => op.text).sort();
    assert.deepEqual(labels, ['Blacksmith', 'Quest Board', 'Shop', 'Well']);
  });

  await t.test('obstacles are bottom-anchored and sized 100-150% from hash01, so canopies bleed upward', async () => {
    const maps = { grove: {
      id: 'grove', legend: { '.': 'grass', 'T': 'tree' },
      rows: ['...', '.T.', '...'], neighbors: {}, monsterTable: [], encounterChance: 0, cacheChance: 0,
    } };
    const drawList = await mountMap(maps.grove, maps, baseState({ position: { x: 0, y: 0 }, map: 'grove' }));
    const glyph = glyphsAt(drawList, 1, 1)[0];
    assert.equal(glyph.anchor, 'bottom', 'bottom anchoring is what makes a tall obstacle overlap the row above');
    assert.equal(glyph.sizePx, FULL_SQUARE_PX * (1 + hash01(1, 1) * OBSTACLE_MAX_EXTRA));
    assert.ok(glyph.sizePx >= FULL_SQUARE_PX && glyph.sizePx <= FULL_SQUARE_PX * 1.5);
  });
});

test('mapDrawList - portals and the quest board glow', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('no quest glow op with no quests complete', async () => {
    const drawList = await mountTown(baseState());
    assert.equal(drawList.ops.filter((op) => op.op === 'questGlow').length, 0);
  });

  await t.test('the quest board emits a glow op once a quest is turn-in ready', async () => {
    const drawList = await mountTown(baseState({ questProgress: { boar: 3 } }));
    const glow = drawList.ops.filter((op) => op.op === 'questGlow');
    assert.equal(glow.length, 1, 'expected exactly the quest board tile to glow');
    const board = findTile(townMap, 'questBoard');
    assert.deepEqual({ gx: glow[0].gx, gy: glow[0].gy }, { gx: board.x, gy: board.y });
    assert.equal(drawList.hasContinuousAnimation, true, 'a glowing board has to keep the render loop alive');
  });

  await t.test('an origin portal emits a cropped glyph and no background op', async () => {
    // (2,2) deliberately differs from the hero's own position - a tile the
    // player stands on draws the hero instead of the tile's own emoji.
    const drawList = await mountTown(baseState({
      portal: { originScreenId: 'town', originX: 2, originY: 2, returnPending: false },
    }));
    const ops = opsAt(drawList, 2, 2);
    assert.equal(ops.some((op) => op.op === 'portalShadow'), false, 'the portal shadow was removed 2026-09-12 - emoji only, no background');
    const glyph = ops.find((op) => op.op === 'glyph');
    assert.equal(glyph.emoji, '🌌');
    assert.equal(glyph.cropped, true, 'the portal emoji is drawn oversized and clipped to crop its baked-in border');
  });

  await t.test('no portal ops anywhere when state.portal is null', async () => {
    const drawList = await mountTown(baseState({ portal: null }));
    assert.equal(drawList.ops.some((op) => op.gx === 2 && op.gy === 2 && op.cropped), false);
  });

  // The DOM renderer expressed this as z-index row + 1000. The canvas
  // equivalent is ordering: a boosted tile's content is emitted in a second
  // pass, after every ordinary cell.
  await t.test('portal content is emitted after every ordinary cell, so it always paints on top', async () => {
    const drawList = await mountTown(baseState({
      portal: { originScreenId: 'town', originX: 2, originY: 2, returnPending: false },
    }));
    const glyphIndex = drawList.ops.findIndex((op) => op.op === 'glyph' && op.cropped);
    // The last op belonging to any non-boosted cell must come before it.
    const lastOrdinary = drawList.ops.reduce((acc, op, i) => (
      op.op !== 'ground' && !(op.gx === 2 && op.gy === 2) ? i : acc
    ), -1);
    assert.ok(glyphIndex > lastOrdinary, 'portal ops must be emitted after all ordinary cell content');
  });
});

test('mapDrawList - paint order', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('within a tile: ground, then trail, then sprites', async () => {
    const maps = { plains: {
      id: 'plains', legend: { '.': 'grass' },
      rows: ['.....', '.....', '.....'], neighbors: {}, monsterTable: [], encounterChance: 0, cacheChance: 0,
    } };
    // mount() marks the starting tile visited, so the hero's own tile has a
    // trail, a possible decoration, and the hero on it - all three layers.
    const drawList = await mountMap(maps.plains, maps, baseState({ position: { x: 2, y: 1 }, map: 'plains' }));
    const kinds = opsAt(drawList, 2, 1).map((op) => op.op);
    assert.equal(kinds[0], 'ground', 'ground paints first');
    const trailIndex = kinds.indexOf('trail');
    const glyphIndex = kinds.indexOf('glyph');
    assert.ok(trailIndex > 0, 'expected a trail on the visited starting tile');
    assert.ok(glyphIndex > trailIndex, 'sprites paint over the trail, never under it');
  });

  await t.test('cells are emitted row-major, so a lower row paints over the row above it', async () => {
    const drawList = await mountTown(baseState());
    const ground = drawList.ops.filter((op) => op.op === 'ground');
    for (let i = 1; i < ground.length; i++) {
      const prev = ground[i - 1];
      const cur = ground[i];
      assert.ok(
        cur.gy > prev.gy || (cur.gy === prev.gy && cur.gx > prev.gx),
        `ground ops must be row-major; index ${i} went backwards`,
      );
    }
  });
});

test('mapDrawList - hover descriptions', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(() => teardownDom());

  await t.test('describeSignature returns the tile description, and the marker text for caches/mini-dungeons', async () => {
    const { describeSignature } = await import('../js/systems/mapDrawList.js');
    assert.equal(describeSignature({ resolved: false }), '');
    assert.equal(
      describeSignature({ resolved: true, tile: TILES.grass, hasMiniDungeon: false, hasTileCache: false }),
      TILES.grass.description,
    );
    assert.match(
      describeSignature({ resolved: true, tile: TILES.grass, hasMiniDungeon: false, hasTileCache: true }),
      /stash of gold/,
    );
    assert.match(
      describeSignature({ resolved: true, tile: TILES.grass, hasMiniDungeon: true, hasTileCache: false }),
      /mysterious opening/,
    );
  });
});
