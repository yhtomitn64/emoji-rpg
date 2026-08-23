const TOAST_DURATION_MS = 1200;

let hideTimeoutId = null;

// Positioned from the HUD Inventory button's live rect rather than living inside
// #hud itself - renderHud() rebuilds that subtree from scratch on almost every
// state change, which would wipe an in-flight animation before it finishes.
export function playItemPickupToast(emoji, name) {
  const anchorButton = document.getElementById('btn-open-inventory');
  const toastEl = document.getElementById('item-pickup-toast');
  if (!anchorButton || !toastEl) return;

  const rect = anchorButton.getBoundingClientRect();
  toastEl.style.left = `${rect.left + rect.width / 2}px`;
  toastEl.style.top = `${rect.bottom}px`;
  toastEl.textContent = `${emoji} +1 ${name}`;

  clearTimeout(hideTimeoutId);
  toastEl.classList.remove('item-pickup-toast-play');
  void toastEl.offsetWidth; // force reflow so re-triggering restarts the animation
  toastEl.classList.add('item-pickup-toast-play');
  hideTimeoutId = setTimeout(() => {
    toastEl.classList.remove('item-pickup-toast-play');
  }, TOAST_DURATION_MS);
}
