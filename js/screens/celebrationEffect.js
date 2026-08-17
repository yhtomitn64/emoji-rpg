import { showFlavorBanner } from './flavorBanner.js';

const BURST_DURATION_MS = 1400;

let hideTimeoutId = null;

export function playCelebration(emoji, message) {
  showFlavorBanner(message);

  const burstEl = document.getElementById('celebration-burst');
  burstEl.textContent = emoji;
  clearTimeout(hideTimeoutId);
  burstEl.classList.remove('celebration-burst-play');
  void burstEl.offsetWidth; // force reflow so re-triggering restarts the animation
  burstEl.classList.add('celebration-burst-play');
  hideTimeoutId = setTimeout(() => {
    burstEl.classList.remove('celebration-burst-play');
  }, BURST_DURATION_MS);
}
