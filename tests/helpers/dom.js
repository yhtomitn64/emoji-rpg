// Shared jsdom setup for tests that exercise a screen module's real mount()/
// unmount() DOM code, not just its pure helper functions. Lives in
// tests/helpers/ (not tests/) so `node --test tests/*.js` never picks this
// file up as a test file of its own - it has no `test()` calls.
//
// Why this exists: js/screens/*.js files (battleScreen.js, mapScreen.js,
// shopScreen.js, etc.) reference `document`/`window` directly inside their
// functions, but export nothing but mount/unmount - there was previously no
// way to unit test "does clicking this button call the right function with
// the right args" without spinning up a real browser. See
// docs/superpowers/BACKLOG_SHIPPED.md's "Testing infra" entry for the full
// history/tradeoffs (deferred twice before this was finally built).
//
// Scope: this covers DOM structure and event wiring (the class of bug that
// used to need a live-browser round trip). It's not a replacement for an
// occasional real-browser check of actual rendering/CSS/animation-timing -
// jsdom's layout engine is a no-op (no real box model), so anything that
// depends on actual pixel geometry still wants a live look.
import { JSDOM } from 'jsdom';

let dom = null;
// Node itself ships built-in globals for `navigator`/`performance` (as
// getter-only accessor properties for `navigator`), which jsdom's own
// Window constructor relies on internally - naively `delete`-ing them in
// teardown (rather than restoring Node's originals) broke every JSDOM()
// construction after the first. Save each property's original descriptor
// before overwriting it, restore exactly that descriptor (not just
// "delete") in teardown, and use defineProperty (not `=`) going in, since
// Node's own `navigator` is non-writable, only reconfigurable.
// Deliberately excludes `performance`: jsdom's Performance object hits an
// infinite brand-check recursion (`Performance.now -> PerformanceImpl.now ->
// Performance.now -> ...`, a jsdom cross-realm quirk) when called as a bare
// global outside its own window's direct property access. Node already
// provides its own global `performance.now()` - a perfectly good monotonic
// clock for anything a screen module needs it for - so this just leaves
// Node's own alone instead of swapping in jsdom's.
const GLOBAL_KEYS = ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'KeyboardEvent', 'MouseEvent', 'requestAnimationFrame', 'cancelAnimationFrame'];
let savedDescriptors = null;

// Call at the top of a `beforeEach` (or once per test) before importing/using
// any screen module. Installs a fresh document/window pair as Node globals -
// screen modules read `document`/`window` as ambient globals, the same way
// they do in a real page, so nothing about their own code needs to change to
// be testable this way.
export function setupDom() {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true, // gives jsdom a working requestAnimationFrame
  });
  const values = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  };
  savedDescriptors = {};
  for (const key of GLOBAL_KEYS) {
    savedDescriptors[key] = Object.getOwnPropertyDescriptor(global, key);
    Object.defineProperty(global, key, { value: values[key], configurable: true, writable: true });
  }
  return dom;
}

// Call in an `afterEach` to tear the globals back down, so one test's DOM
// state (and any window-level listeners a screen's mount() registered) can
// never leak into the next test. Restores Node's own pre-existing globals
// (navigator/performance) rather than deleting them outright.
export function teardownDom() {
  dom?.window?.close();
  dom = null;
  if (savedDescriptors) {
    for (const key of GLOBAL_KEYS) {
      const descriptor = savedDescriptors[key];
      if (descriptor) {
        Object.defineProperty(global, key, descriptor);
      } else {
        delete global[key];
      }
    }
    savedDescriptors = null;
  }
}

// Creates the #app-style root element a screen's mount(root, props) expects,
// attached to the live document so getElementById/querySelector calls made
// from inside the screen module resolve normally.
export function createRoot() {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

// Dispatches a real click through the DOM (not a bare .onclick() call), so a
// screen's actual `element.onclick = handler` wiring is what's under test,
// not a hand-picked property.
export function click(el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

// Dispatches a real keydown on window, matching how every screen module's
// own `window.addEventListener('keydown', handleKeydown)` actually receives
// keys in the browser.
export function keydown(key, extra = {}) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
}
