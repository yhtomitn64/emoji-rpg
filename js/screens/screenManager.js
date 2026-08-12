let activeScreen = null;

export function mountScreen(screen, props) {
  const root = document.getElementById('app');
  if (activeScreen && activeScreen.unmount) {
    activeScreen.unmount();
  }
  root.innerHTML = '';
  activeScreen = screen;
  screen.mount(root, props);
}
