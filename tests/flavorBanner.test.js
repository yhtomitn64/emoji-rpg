import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { getElementById: () => null };
const { showFlavorBanner, getMessageLog } = await import('../js/screens/flavorBanner.js');

test('showFlavorBanner grows the message log even when the DOM banner element is missing', () => {
  showFlavorBanner('hello');
  assert.deepEqual(getMessageLog(), ['hello']);
});

test('showFlavorBanner accumulates multiple calls in order', () => {
  showFlavorBanner('first');
  showFlavorBanner('second');
  const log = getMessageLog();
  assert.deepEqual(log.slice(-2), ['first', 'second']);
});
