import { appendMessage } from '../systems/messageLog.js';

export const VISIBLE_DURATION_MS = 3500;

let hideTimeoutId = null;
let messageLog = [];
let textEl = null;
let currentDurationMs = VISIBLE_DURATION_MS;

// Builds the banner's text span + close button once, and rebuilds them if
// `banner` ever isn't the one they're currently attached to - e.g. a test
// mounting a fresh #flavor-banner element per case (index.html's real one
// never gets replaced, so this only matters for tests, but checking DOM
// connectivity instead of a one-time boolean flag makes that self-healing
// for free rather than needing a special test-only reset hook).
function ensureInitialized(banner) {
  if (textEl && textEl.parentElement === banner) return;
  banner.innerHTML = '';
  textEl = document.createElement('span');
  textEl.className = 'flavor-banner-text';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'flavor-banner-close';
  closeButton.textContent = '✕';
  closeButton.setAttribute('aria-label', 'Dismiss');
  closeButton.onclick = () => hideBanner(banner);
  banner.appendChild(textEl);
  banner.appendChild(closeButton);
  // Hovering pauses the auto-hide countdown entirely (read it, it won't
  // vanish on you); leaving restarts a fresh full duration rather than
  // resuming a remainder - simpler, and matches "stays up longer" rather
  // than "resumes counting down where it left off".
  banner.addEventListener('mouseenter', () => clearTimeout(hideTimeoutId));
  banner.addEventListener('mouseleave', () => scheduleHide(banner, currentDurationMs));
}

function hideBanner(banner) {
  clearTimeout(hideTimeoutId);
  banner.classList.remove('visible');
}

function scheduleHide(banner, durationMs) {
  clearTimeout(hideTimeoutId);
  hideTimeoutId = setTimeout(() => banner.classList.remove('visible'), durationMs);
}

export function showFlavorBanner(text, durationMs = VISIBLE_DURATION_MS) {
  messageLog = appendMessage(messageLog, text);
  const banner = document.getElementById('flavor-banner');
  if (!banner) return;
  ensureInitialized(banner);
  currentDurationMs = durationMs;
  const hud = document.getElementById('hud');
  if (hud) {
    banner.style.top = `${hud.getBoundingClientRect().bottom + 8}px`;
  }
  textEl.textContent = text;
  banner.classList.add('visible');
  scheduleHide(banner, durationMs);
}

export function getMessageLog() {
  return [...messageLog];
}
