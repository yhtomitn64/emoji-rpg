import { showFlavorBanner } from './flavorBanner.js';

const BURST_DURATION_MS = 1400;
const BIG_TEXT_DURATION_MS = 1400;
// Matches TOOL_SEQUENCE_MS's own hold+orbit duration below (kept as a
// literal, not a shared import, since celebration-burst-tool-sequence's
// keyframe percentages in styles.css are hand-timed against this exact
// number - changing one without the other desyncs the callout bubble from
// the orbit actually finishing).
const TOOL_SEQUENCE_MS = 1400;
const TOOL_CALLOUT_DURATION_MS = 2200;

let hideTimeoutId = null;
let hideBigTextTimeoutId = null;
let hideToolBurstTimeoutId = null;
let showToolCalloutTimeoutId = null;
let hideToolCalloutTimeoutId = null;

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

// First-time tool pickup (axe/pick/canoe) gets its own richer sequence
// instead of playCelebration's single burst+text pop - raised 2026-08-28:
// "the character should hold it over head, then it should fly around their
// body and then a message should prodouly exclaim what you can do". No
// sprite/pose system exists for a literal "hold it overhead" - this is the
// stylized substitute: the tool emoji pops up center-screen (the "hold"),
// loops most of a circle (the "fly around"), settles and fades, then a
// bordered callout bubble (not the plain floating text used for level-ups)
// states the capability the player just unlocked, timed to land right as
// the orbit finishes so it reads as the sequence's payoff, not a
// simultaneous distraction.
export function playToolCelebration(emoji, message, capabilityText) {
  showFlavorBanner(message);

  const burstEl = document.getElementById('celebration-burst');
  burstEl.textContent = emoji;
  clearTimeout(hideToolBurstTimeoutId);
  burstEl.classList.remove('celebration-burst-tool-play');
  void burstEl.offsetWidth; // force reflow so re-triggering restarts the animation
  burstEl.classList.add('celebration-burst-tool-play');
  hideToolBurstTimeoutId = setTimeout(() => {
    burstEl.classList.remove('celebration-burst-tool-play');
  }, TOOL_SEQUENCE_MS);

  const calloutEl = document.getElementById('celebration-tool-callout');
  calloutEl.textContent = capabilityText;
  clearTimeout(showToolCalloutTimeoutId);
  clearTimeout(hideToolCalloutTimeoutId);
  calloutEl.classList.remove('celebration-tool-callout-play');
  showToolCalloutTimeoutId = setTimeout(() => {
    void calloutEl.offsetWidth;
    calloutEl.classList.add('celebration-tool-callout-play');
    hideToolCalloutTimeoutId = setTimeout(() => {
      calloutEl.classList.remove('celebration-tool-callout-play');
    }, TOOL_CALLOUT_DURATION_MS);
  }, TOOL_SEQUENCE_MS - 200);
}
