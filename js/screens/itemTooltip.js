// Shared instant item-stat tooltip for shop/inventory/smith/quest board -
// replaces the native `title` attribute those screens used to rely on.
// Raised 2026-09-07: "when I hover over items in the store it doesn't show
// any stats... the store hover should be instant and no delay." Two
// separate bugs, one fix: `title` tooltips carry the browser's own
// unremovable hover delay (no CSS/JS control over it), and the shop's item
// cards specifically split the emoji into its own untitled span, so
// hovering the big icon (the natural target) showed nothing at all - only
// the small name text beneath it had a title. A single delegated listener
// here (`initItemTooltip`, called once from main.js) shows this tooltip the
// instant the pointer enters any `data-tooltip`-bearing element, anywhere
// in the document - each screen just swaps its old `title="..."` for
// `data-tooltip="..."` on whichever element should trigger it (see
// shopScreen.js's `.item-card` for the emoji-hover fix specifically).
let tooltipEl = null;

function positionNear(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  // Anchored above the target, centered - flips below if there isn't room
  // above (e.g. the shop's top row of cards), same "clamp to viewport"
  // spirit as other fixed-position UI in this game (battle explainer, item
  // pickup toast) rather than letting it run off-screen.
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const spaceAbove = rect.top;
  const showBelow = spaceAbove < tooltipRect.height + 12;
  tooltipEl.style.left = `${Math.min(Math.max(rect.left + rect.width / 2, tooltipRect.width / 2 + 4), window.innerWidth - tooltipRect.width / 2 - 4)}px`;
  tooltipEl.style.top = showBelow ? `${rect.bottom + 8}px` : `${rect.top - 8}px`;
  tooltipEl.style.transform = showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
}

function show(targetEl) {
  const text = targetEl.dataset.tooltip;
  if (!text) return;
  tooltipEl.textContent = text;
  tooltipEl.hidden = false;
  // Measure after unhiding (dimensions are 0 while [hidden]) then
  // re-position now that positionNear can read the tooltip's real size.
  positionNear(targetEl);
}

function hide() {
  if (tooltipEl) tooltipEl.hidden = true;
}

export function initItemTooltip() {
  tooltipEl = document.getElementById('item-tooltip');
  document.addEventListener('mouseover', (event) => {
    const target = event.target.closest('[data-tooltip]');
    if (target) show(target);
  });
  document.addEventListener('mouseout', (event) => {
    const target = event.target.closest('[data-tooltip]');
    // relatedTarget is where the pointer went - null (left the window) or
    // still inside the same tooltip-owning element (moved between its own
    // children) shouldn't hide it.
    if (target && !target.contains(event.relatedTarget)) hide();
  });
  // Scroll containers (.inventory-scroll-area) move their content under a
  // fixed-position pointer without firing mouseout - stale tooltip
  // otherwise stays glued to wherever it last was. `true` for capture since
  // the scrolling element itself doesn't bubble scroll events.
  document.addEventListener('scroll', hide, true);
}
