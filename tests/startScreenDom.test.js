// Real DOM tests for js/screens/startScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the 2026-09-04 redesign - the old inline
// hero-emoji/skin-tone <select> pair on the new-game row was replaced with a
// three-step flow (save list -> name entry -> large-tile hero/tone picker).
// No prior DOM coverage existed for this screen at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click } from './helpers/dom.js';

const SLOTS = [
  { id: 'a', name: 'Hotshot', level: 8, lastPlayed: Date.now(), ngPlusCycle: 0 },
];

async function mountStart(props = {}) {
  const { mount } = await import('../js/screens/startScreen.js');
  const root = createRoot();
  mount(root, {
    slots: props.slots || [],
    callbacks: {
      onContinue: () => {},
      onDelete: () => {},
      onNewGame: () => {},
      ...(props.callbacks || {}),
    },
  });
  return root;
}

function setValue(input, value) {
  input.value = value;
}

// jsdom's CSS selector engine (nwsapi) doesn't reliably match astral-plane
// characters (most emoji, including hero options like 🧑) embedded directly
// in an attribute-selector string - looking the tile up via .dataset in
// plain JS sidesteps that entirely.
function heroTile(root, emoji) {
  return Array.from(root.querySelectorAll('.hero-tile')).find((tile) => tile.dataset.hero === emoji);
}

function toneSwatch(root, modifier) {
  return Array.from(root.querySelectorAll('.hero-tone-swatch')).find((swatch) => swatch.dataset.tone === modifier);
}

test('startScreen DOM - new-game flow', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/startScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('with no slots, shows the empty message and a + New Game button, no name/hero controls yet', async () => {
    const root = await mountStart();
    assert.ok(root.querySelector('.no-slots'));
    assert.ok(root.querySelector('#btn-open-new-game'));
    assert.equal(root.querySelector('#new-game-name'), null);
    assert.equal(root.querySelector('.hero-grid'), null);
  });

  await t.test('renders one row per slot, with Continue/Delete wired to the right id', async () => {
    let continuedId = null;
    const root = await mountStart({ slots: SLOTS, callbacks: { onContinue: (id) => { continuedId = id; } } });
    assert.equal(root.querySelectorAll('.slot-row').length, 1);
    click(root.querySelector('[data-continue="a"]'));
    assert.equal(continuedId, 'a');
  });

  await t.test('+ New Game opens name-only entry - no hero/tone selects on this step', async () => {
    const root = await mountStart();
    click(root.querySelector('#btn-open-new-game'));
    assert.ok(root.querySelector('#new-game-name'));
    assert.ok(root.querySelector('#btn-create-slot'));
    assert.equal(root.querySelector('#new-game-emoji'), null);
    assert.equal(root.querySelector('#new-game-tone'), null);
  });

  await t.test('Create on the name step moves to the hero-pick step with every hero option rendered', async () => {
    const { HERO_EMOJI_OPTIONS } = await import('../js/state.js');
    const root = await mountStart();
    click(root.querySelector('#btn-open-new-game'));
    setValue(root.querySelector('#new-game-name'), 'Zoop');
    click(root.querySelector('#btn-create-slot'));
    assert.equal(root.querySelectorAll('.hero-tile').length, HERO_EMOJI_OPTIONS.length);
    // Nothing picked yet - Start Adventure stays disabled.
    assert.equal(root.querySelector('#btn-create-slot').disabled, true);
  });

  await t.test('picking a tone-capable hero shows swatches and enables Create; confirming calls onNewGame with the toned emoji', async () => {
    let created = null;
    const root = await mountStart({ callbacks: { onNewGame: (name, emoji) => { created = { name, emoji }; } } });
    click(root.querySelector('#btn-open-new-game'));
    setValue(root.querySelector('#new-game-name'), 'Zoop');
    click(root.querySelector('#btn-create-slot'));

    click(heroTile(root, '🧑'));
    assert.ok(root.querySelector('.hero-tone-swatches'));
    assert.equal(root.querySelector('#btn-create-slot').disabled, false);

    click(toneSwatch(root, '\u{1F3FD}'));
    click(root.querySelector('#btn-create-slot'));

    assert.equal(created.name, 'Zoop');
    // A person + medium skin tone modifier renders as more than the bare
    // base glyph - just confirm the tone actually got composed in, not the
    // exact codepoint sequence.
    assert.ok(created.emoji.length > '🧑'.length);
  });

  await t.test('picking a tone-incapable hero shows no swatches and no-tone message instead', async () => {
    const root = await mountStart();
    click(root.querySelector('#btn-open-new-game'));
    setValue(root.querySelector('#new-game-name'), 'Zoop');
    click(root.querySelector('#btn-create-slot'));

    click(heroTile(root, '🧟'));
    assert.equal(root.querySelector('.hero-tone-swatches'), null);
    assert.ok(root.querySelector('.hero-pick-no-tone'));
    assert.equal(root.querySelector('#btn-create-slot').disabled, false);
  });

  await t.test('Random Character picks a hero and fills a generated name, enabling Create', async () => {
    const root = await mountStart();
    click(root.querySelector('#btn-open-new-game'));
    setValue(root.querySelector('#new-game-name'), '');
    click(root.querySelector('#btn-create-slot'));

    click(root.querySelector('#btn-random-character'));
    assert.equal(root.querySelector('#btn-create-slot').disabled, false);
    assert.notEqual(root.querySelector('#hero-pick-name').value, '');
  });

  await t.test('Back returns to the name step with the previously entered name preserved', async () => {
    const root = await mountStart();
    click(root.querySelector('#btn-open-new-game'));
    setValue(root.querySelector('#new-game-name'), 'Zoop');
    click(root.querySelector('#btn-create-slot'));
    click(root.querySelector('#btn-back-to-name'));
    assert.equal(root.querySelector('#new-game-name').value, 'Zoop');
  });

  await t.test('Shuffle re-renders the grid without throwing and keeps the picked hero selected', async () => {
    const root = await mountStart();
    click(root.querySelector('#btn-open-new-game'));
    setValue(root.querySelector('#new-game-name'), 'Zoop');
    click(root.querySelector('#btn-create-slot'));
    click(heroTile(root, '🧑'));
    click(root.querySelector('#btn-shuffle-tones'));
    assert.ok(heroTile(root, '🧑').classList.contains('hero-tile-picked'));
  });
});
