// Real DOM tests for js/screens/itemTooltip.js - the shared instant item-
// stat tooltip that replaced the native `title` attribute on shop/
// inventory/smith/quest board item rows. Raised 2026-09-07: "when I hover
// over items in the store it doesn't show any stats... the store hover
// should be instant and no delay." Covers the delegation/positioning logic
// itself (mouseover/mouseout/scroll), not any one screen's markup - each
// screen's own DOM test suite covers that its rows carry the right
// data-tooltip text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, mouseover, mouseout } from './helpers/dom.js';

async function setup() {
  setupDom();
  const tooltipEl = document.createElement('div');
  tooltipEl.id = 'item-tooltip';
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  const { initItemTooltip } = await import('../js/screens/itemTooltip.js');
  initItemTooltip();
  return tooltipEl;
}

test('itemTooltip', async (t) => {
  t.beforeEach(setup);
  t.afterEach(teardownDom);

  await t.test('shows the tooltip text immediately on mouseover, no delay to wait out', async () => {
    const tooltipEl = document.getElementById('item-tooltip');
    const card = document.createElement('div');
    card.dataset.tooltip = 'Iron Sword: Attack +6';
    document.body.appendChild(card);

    mouseover(card);

    assert.equal(tooltipEl.hidden, false);
    assert.equal(tooltipEl.textContent, 'Iron Sword: Attack +6');
  });

  await t.test('hides on mouseout once the pointer actually leaves the tooltip-owning element', async () => {
    const tooltipEl = document.getElementById('item-tooltip');
    const card = document.createElement('div');
    card.dataset.tooltip = 'Iron Sword: Attack +6';
    document.body.appendChild(card);
    mouseover(card);

    mouseout(card, document.body);

    assert.equal(tooltipEl.hidden, true);
  });

  await t.test('stays open when the pointer moves between the tooltip-owning element\'s own children', async () => {
    // The shop's item-card fix: data-tooltip lives on the card, with an
    // emoji span and a name span inside it - moving from one child to the
    // other shouldn't flicker the tooltip closed and back open.
    const tooltipEl = document.getElementById('item-tooltip');
    const card = document.createElement('div');
    card.dataset.tooltip = 'Iron Sword: Attack +6';
    const emoji = document.createElement('span');
    const name = document.createElement('span');
    card.append(emoji, name);
    document.body.appendChild(card);
    mouseover(emoji);

    mouseout(emoji, name);

    assert.equal(tooltipEl.hidden, false);
  });

  await t.test('a hover on an element with no data-tooltip is a no-op, not an error', async () => {
    const tooltipEl = document.getElementById('item-tooltip');
    const plain = document.createElement('div');
    document.body.appendChild(plain);

    mouseover(plain);

    assert.equal(tooltipEl.hidden, true);
  });

  await t.test('hides on scroll - a scrolled list can move its content without ever firing mouseout', async () => {
    const tooltipEl = document.getElementById('item-tooltip');
    const card = document.createElement('div');
    card.dataset.tooltip = 'Iron Sword: Attack +6';
    document.body.appendChild(card);
    mouseover(card);
    assert.equal(tooltipEl.hidden, false);

    document.dispatchEvent(new window.Event('scroll'));

    assert.equal(tooltipEl.hidden, true);
  });
});
