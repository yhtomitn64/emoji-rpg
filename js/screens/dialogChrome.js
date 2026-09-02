// Shared close affordances for dialogs/screens - Escape key and
// click-on-backdrop - so every closeable screen behaves the same way.
// Raised as "UI consistency: universal Escape-to-close + aligned dialog
// chrome" (2026-09-01) and extended with click-outside (2026-09-02).

export function bindEscapeClose(onClose) {
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }
  window.addEventListener('keydown', handleKeydown);
  return () => window.removeEventListener('keydown', handleKeydown);
}

// rootEl is the backdrop element itself (an overlay's mounted root) - only a
// click whose target IS rootEl, not something inside it like .overlay-panel,
// counts as "outside" the dialog. Full-page screens (no backdrop) don't use
// this at all.
export function bindBackdropClose(rootEl, onClose) {
  function handleClick(event) {
    if (event.target === rootEl) onClose();
  }
  rootEl.addEventListener('click', handleClick);
  return () => rootEl.removeEventListener('click', handleClick);
}
