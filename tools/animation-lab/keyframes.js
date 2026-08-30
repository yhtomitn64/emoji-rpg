//
// Pure logic shared between the Animation Lab UI (lab.js) and the code it
// generates for js/screens/battleScreen.js. No DOM dependency - testable
// standalone with `node --test`.
//
// The transform composition below relies on how CSS transform *function
// lists* compose: each function is matrix-multiplied in the same order
// they're written, applied to the element's local box space. Writing
// `translate(anchor) rotate(deg) translate(arm)` therefore behaves like a
// nested coordinate frame (same trick as nested SVG/canvas transforms):
// move the origin to `anchor`, rotate *that frame*, then place the glyph
// `arm` pixels out from the now-rotated origin - a rigid arm swinging on a
// fixed pivot. Free mode skips the anchor entirely and matches the
// existing translate-then-rotate order already used everywhere in
// battleScreen.js's swingKeyframesFor (rotates the glyph about its own
// center while carrying it along the path).

export function resolveXY(point, dx, dy) {
  return {
    x: point.x + dx * (point.dxFactor ?? 0),
    y: point.y + dy * (point.dyFactor ?? 0),
  };
}

export function buildTransform(pinned, anchor, kf, dx, dy) {
  const { x, y } = resolveXY(kf, dx, dy);
  if (pinned) {
    const { x: ax, y: ay } = resolveXY(anchor, dx, dy);
    const armX = x - ax;
    const armY = y - ay;
    return `translate(-50%, -50%) translate(${ax}px, ${ay}px) rotate(${kf.rotate}deg) translate(${armX}px, ${armY}px) scale(${kf.scale})`;
  }
  return `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${kf.rotate}deg) scale(${kf.scale})`;
}

export function buildWaapiKeyframes(design, dx, dy) {
  return design.keyframes.map((kf) => ({
    transform: buildTransform(design.pinned, design.anchor, kf, dx, dy),
    offset: kf.offset,
  }));
}
