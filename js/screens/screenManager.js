let activeScreen = null;
let activeOverlay = null;

export function mountScreen(screen, props) {
  if (activeOverlay) {
    unmountOverlay();
  }
  const root = document.getElementById('app');
  if (activeScreen && activeScreen.unmount) {
    activeScreen.unmount();
  }
  root.innerHTML = '';
  activeScreen = screen;
  screen.mount(root, props);
}

export function mountOverlay(overlay, props) {
  if (activeOverlay) {
    unmountOverlay();
  }
  if (activeScreen && activeScreen.pause) {
    activeScreen.pause();
  }
  const root = document.getElementById('overlay');
  root.classList.add('open');
  document.getElementById('app').classList.add('dimmed');
  activeOverlay = overlay;
  overlay.mount(root, props);
}

export function unmountOverlay() {
  if (!activeOverlay) return;
  if (activeOverlay.unmount) {
    activeOverlay.unmount();
  }
  const root = document.getElementById('overlay');
  root.innerHTML = '';
  root.classList.remove('open');
  document.getElementById('app').classList.remove('dimmed');
  activeOverlay = null;
  if (activeScreen && activeScreen.resume) {
    activeScreen.resume();
  }
}
