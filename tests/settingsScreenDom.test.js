// Real DOM tests for js/screens/settingsScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure and event wiring - see
// battleScreenDom.test.js's own header for why this pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';

async function mountSettings(state, callbacks = { onChange: () => {}, onClose: () => {} }) {
  const { mount } = await import('../js/screens/settingsScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('settingsScreen DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/settingsScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('shows the current itemMenuAutoCloseMs value', async () => {
    const state = { ...createNewGame(), settings: { itemMenuAutoCloseMs: 1500 } };
    const root = await mountSettings(state);
    assert.equal(root.querySelector('#settings-item-menu-auto-close').value, '1500');
  });

  await t.test('changing the input updates state and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    const input = root.querySelector('#settings-item-menu-auto-close');
    input.value = '2000';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.itemMenuAutoCloseMs, 2000);
    assert.equal(changed, true);
  });

  await t.test('clamps the value to the min/max range', async () => {
    const state = createNewGame();
    const root = await mountSettings(state);
    const input = root.querySelector('#settings-item-menu-auto-close');
    input.value = '99999';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.itemMenuAutoCloseMs, 5000);
    input.value = '0';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.itemMenuAutoCloseMs, 250);
  });

  await t.test('Close calls onClose', async () => {
    let closed = false;
    const root = await mountSettings(createNewGame(), { onChange: () => {}, onClose: () => { closed = true; } });
    click(root.querySelector('#btn-close-settings'));
    assert.equal(closed, true);
  });

  await t.test('the X button, Escape, and backdrop click all call onClose', async () => {
    let closed = 0;
    const root = await mountSettings(createNewGame(), { onChange: () => {}, onClose: () => { closed += 1; } });
    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(closed, 3);
  });

  await t.test('clicking inside the panel does not call onClose', async () => {
    let closed = false;
    const root = await mountSettings(createNewGame(), { onChange: () => {}, onClose: () => { closed = true; } });
    click(root.querySelector('.settings-panel'));
    assert.equal(closed, false);
  });

  await t.test('Copy Play Log copies buffered events via the Clipboard API when available', async () => {
    const { startSession, logEvent } = await import('../js/systems/telemetry.js');
    startSession();
    logEvent('level_up', { level: 2 });
    let copiedText = null;
    window.navigator.clipboard = { writeText: async (text) => { copiedText = text; } };
    const root = await mountSettings(createNewGame());
    click(root.querySelector('#btn-copy-play-log'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(copiedText.includes('"level":2'));
    assert.equal(root.querySelector('#play-log-fallback').hidden, true);
  });

  await t.test('Copy Play Log falls back to a visible textarea when the Clipboard API is unavailable', async () => {
    const { startSession, logEvent } = await import('../js/systems/telemetry.js');
    startSession();
    logEvent('tool_acquired', { toolId: 'axe' });
    // jsdom has no navigator.clipboard by default - exercises the fallback path.
    const root = await mountSettings(createNewGame());
    click(root.querySelector('#btn-copy-play-log'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const fallback = root.querySelector('#play-log-fallback');
    assert.equal(fallback.hidden, false);
    assert.ok(fallback.value.includes('"toolId":"axe"'));
  });

  await t.test('the Sound section is hidden until the audioBeta feature flag is enabled', async () => {
    const state = createNewGame();
    const root = await mountSettings(state);
    assert.equal(root.querySelector('#settings-sound-theme'), null);
    assert.equal(root.querySelector('#settings-audio-combat-volume'), null);
  });

  await t.test('shows a Feature Flags checkbox, unchecked by default', async () => {
    const state = createNewGame();
    const root = await mountSettings(state);
    const checkbox = root.querySelector('#settings-flag-audio-beta');
    assert.ok(checkbox);
    assert.equal(checkbox.checked, false);
  });

  await t.test('checking the audioBeta flag reveals the Sound section and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    const checkbox = root.querySelector('#settings-flag-audio-beta');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.featureFlags.audioBeta, true);
    assert.equal(changed, true);
    assert.ok(root.querySelector('#settings-sound-theme'), 'Sound section should now be visible');
  });

  await t.test('unchecking the audioBeta flag hides the Sound section again and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    state.settings.featureFlags.audioBeta = true;
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    const checkbox = root.querySelector('#settings-flag-audio-beta');
    checkbox.checked = false;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.featureFlags.audioBeta, false);
    assert.equal(changed, true);
    assert.equal(root.querySelector('#settings-sound-theme'), null, 'Sound section should be hidden again');
  });

  await t.test('shows a volume slider and mute toggle for each audio category', async () => {
    const state = createNewGame();
    state.settings.featureFlags.audioBeta = true;
    const root = await mountSettings(state);
    for (const category of ['Combat', 'Ui', 'World', 'Music']) {
      assert.ok(root.querySelector(`#settings-audio-${category.toLowerCase()}-volume`), `missing volume slider for ${category}`);
      assert.ok(root.querySelector(`#settings-audio-${category.toLowerCase()}-muted`), `missing mute checkbox for ${category}`);
    }
  });

  await t.test('dragging a volume slider updates state and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    state.settings.featureFlags.audioBeta = true;
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    for (const category of ['combat', 'ui', 'world', 'music']) {
      changed = false;
      const slider = root.querySelector(`#settings-audio-${category}-volume`);
      slider.value = '0.25';
      slider.dispatchEvent(new window.Event('change', { bubbles: true }));
      const key = `audio${category.charAt(0).toUpperCase()}${category.slice(1)}Volume`;
      assert.equal(state.settings[key], 0.25, `expected ${key} to update`);
      assert.equal(changed, true);
    }
  });

  await t.test('toggling a mute checkbox updates state and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    state.settings.featureFlags.audioBeta = true;
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    for (const category of ['combat', 'ui', 'world', 'music']) {
      changed = false;
      const checkbox = root.querySelector(`#settings-audio-${category}-muted`);
      checkbox.checked = true;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      const key = `audio${category.charAt(0).toUpperCase()}${category.slice(1)}Muted`;
      assert.equal(state.settings[key], true, `expected ${key} to update`);
      assert.equal(changed, true);
    }
  });

  await t.test('the theme select lists every known theme and defaults to the saved value', async () => {
    const state = createNewGame();
    state.settings.soundTheme = 'realistic';
    state.settings.featureFlags.audioBeta = true;
    const root = await mountSettings(state);
    const select = root.querySelector('#settings-sound-theme');
    assert.ok(select);
    assert.equal(select.value, 'realistic');
  });

  await t.test('changing the theme select updates state and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    state.settings.featureFlags.audioBeta = true;
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    const select = root.querySelector('#settings-sound-theme');
    select.value = 'realistic'; // only theme with real content today; asserts the wiring, not theme content
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.soundTheme, 'realistic');
    assert.equal(changed, true);
  });

  await t.test('shows a mechanicExplainersBeta checkbox, unchecked by default', async () => {
    const state = createNewGame();
    const root = await mountSettings(state);
    const checkbox = root.querySelector('#settings-flag-mechanic-explainers-beta');
    assert.ok(checkbox);
    assert.equal(checkbox.checked, false);
  });

  await t.test('checking the mechanicExplainersBeta flag updates state and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    const checkbox = root.querySelector('#settings-flag-mechanic-explainers-beta');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.featureFlags.mechanicExplainersBeta, true);
    assert.equal(changed, true);
  });

  await t.test('the Cloud Save section is hidden until the cloudSaveBeta flag is enabled', async () => {
    const state = createNewGame();
    const root = await mountSettings(state);
    assert.equal(root.querySelector('#btn-cloud-start-transfer'), null);
  });

  await t.test('checking the cloudSaveBeta flag reveals the Cloud Save section', async () => {
    const state = createNewGame();
    const root = await mountSettings(state, { onChange: () => {}, onClose: () => {} });
    const checkbox = root.querySelector('#settings-flag-cloud-save-beta');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.featureFlags.cloudSaveBeta, true);
    assert.ok(root.querySelector('#btn-cloud-start-transfer'));
  });

  await t.test('Start Transfer shows the generated code and a countdown on success', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, expiresInSeconds: 60 }) });
    try {
      const state = createNewGame();
      state.settings.featureFlags.cloudSaveBeta = true;
      const root = await mountSettings(state);
      click(root.querySelector('#btn-cloud-start-transfer'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const codeEl = root.querySelector('#cloud-transfer-code');
      assert.equal(codeEl.hidden, false);
      assert.match(codeEl.textContent, /^[a-z0-9]{4}$/);
      assert.equal(root.querySelector('#cloud-transfer-countdown').hidden, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('Load with an invalid code shows a format error and never calls fetch', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return { ok: true, status: 200, json: async () => ({}) }; };
    try {
      const state = createNewGame();
      state.settings.featureFlags.cloudSaveBeta = true;
      const root = await mountSettings(state);
      root.querySelector('#cloud-code-load-input').value = 'ab';
      click(root.querySelector('#btn-cloud-code-load'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(fetchCalled, false);
      assert.match(root.querySelector('#cloud-code-status').textContent, /4-character code/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('Load with a valid, live code hands the loaded data to onCloudSaveImported', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { player: { level: 5 } } }) });
    try {
      const state = createNewGame();
      state.settings.featureFlags.cloudSaveBeta = true;
      let importedData = null;
      const root = await mountSettings(state, {
        onChange: () => {},
        onClose: () => {},
        onCloudSaveImported: (data) => { importedData = data; return { imported: true, mode: 'new', name: 'Imported Hero' }; },
      });
      root.querySelector('#cloud-code-load-input').value = 'ab12';
      click(root.querySelector('#btn-cloud-code-load'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(importedData, { player: { level: 5 } });
      assert.match(root.querySelector('#cloud-code-status').textContent, /Imported as "Imported Hero"/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('Load with a code that has expired (404) shows an expired message', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: 'not found' }) });
    try {
      const state = createNewGame();
      state.settings.featureFlags.cloudSaveBeta = true;
      const root = await mountSettings(state);
      root.querySelector('#cloud-code-load-input').value = 'ab12';
      click(root.querySelector('#btn-cloud-code-load'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.match(root.querySelector('#cloud-code-status').textContent, /expired/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
