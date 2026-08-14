export function markScreenSeen(seenScreens, screenId) {
  return { ...seenScreens, [screenId]: true };
}

export function hasSeenScreen(seenScreens, screenId) {
  return Boolean(seenScreens[screenId]);
}
