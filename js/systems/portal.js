// The Circle of Ultimate Portaling's own state-transition rules - pure
// functions only, no DOM/state-object mutation, mirroring how
// js/systems/toolGates.js/caches.js/miniDungeons.js separate rules from
// the js/main.js orchestration layer that actually owns `state`. See
// docs/superpowers/specs/2026-09-01-portal-scroll-design.md.

// Fixed in-town spot the return portal always appears at, regardless of
// where the player dropped the origin end - town's ROWS[4] is
// '#..S.......M...#' (shop at x=3, smith at x=11), so x=7 sits centered
// between them, clear of the well (11,8) and the exit (7,10).
export const TOWN_PORTAL_POSITION = { x: 7, y: 4 };

export function hasPortalTool(inventory) {
  return inventory.some((entry) => entry.itemId === 'portalCircle' && entry.quantity > 0);
}

export function dropPortal(screenId, x, y) {
  return { originScreenId: screenId, originX: x, originY: y, returnPending: false };
}

export function markReturnPending(portal) {
  return { ...portal, returnPending: true };
}
