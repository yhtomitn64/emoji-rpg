import { showFlavorBanner } from './flavorBanner.js';

const BURST_DURATION_MS = 1400;
const BIG_TEXT_DURATION_MS = 1400;

let hideTimeoutId = null;
let hideBigTextTimeoutId = null;

export function playCelebration(emoji, message, options = {}) {
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

  if (options.bigText) {
    const bigTextEl = document.getElementById('celebration-big-text');
    bigTextEl.textContent = options.bigText;
    clearTimeout(hideBigTextTimeoutId);
    bigTextEl.classList.remove('celebration-big-text-play');
    void bigTextEl.offsetWidth;
    bigTextEl.classList.add('celebration-big-text-play');
    hideBigTextTimeoutId = setTimeout(() => {
      bigTextEl.classList.remove('celebration-big-text-play');
    }, BIG_TEXT_DURATION_MS);
  }
}
