import { appendMessage } from '../systems/messageLog.js';

const VISIBLE_DURATION_MS = 3500;

let hideTimeoutId = null;
let messageLog = [];

export function showFlavorBanner(text) {
  messageLog = appendMessage(messageLog, text);
  const banner = document.getElementById('flavor-banner');
  if (!banner) return;
  clearTimeout(hideTimeoutId);
  banner.textContent = text;
  banner.classList.add('visible');
  hideTimeoutId = setTimeout(() => {
    banner.classList.remove('visible');
  }, VISIBLE_DURATION_MS);
}

export function getMessageLog() {
  return [...messageLog];
}
