import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWN_PORTAL_POSITION, hasPortalTool, dropPortal, markReturnPending } from '../js/systems/portal.js';

test('TOWN_PORTAL_POSITION is a fixed in-town spot', () => {
  assert.deepEqual(TOWN_PORTAL_POSITION, { x: 7, y: 4 });
});

test('hasPortalTool is false with an empty inventory', () => {
  assert.equal(hasPortalTool([]), false);
});

test('hasPortalTool is false when the inventory has other items but not the portal tool', () => {
  assert.equal(hasPortalTool([{ itemId: 'axe', quantity: 1 }]), false);
});

test('hasPortalTool is false when the inventory entry exists but has zero quantity', () => {
  assert.equal(hasPortalTool([{ itemId: 'portalCircle', quantity: 0 }]), false);
});

test('hasPortalTool is true when the inventory has the tool with quantity > 0', () => {
  assert.equal(hasPortalTool([{ itemId: 'portalCircle', quantity: 1 }]), true);
});

test('dropPortal returns a fresh portal at the given position with returnPending false', () => {
  assert.deepEqual(dropPortal('north', 5, 9), {
    originScreenId: 'north', originX: 5, originY: 9, returnPending: false,
  });
});

test('markReturnPending flips returnPending to true without touching the origin fields', () => {
  const portal = dropPortal('north', 5, 9);
  const updated = markReturnPending(portal);
  assert.deepEqual(updated, { originScreenId: 'north', originX: 5, originY: 9, returnPending: true });
});

test('markReturnPending does not mutate its input (pure function)', () => {
  const portal = dropPortal('north', 5, 9);
  markReturnPending(portal);
  assert.equal(portal.returnPending, false);
});
