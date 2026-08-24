export const FLAVOR_TEXT = {
  town: "The shop and smith wait here if you'd rather gear up first — or skip it and lean on potions instead; you'll likely die a few times figuring that out, but a loss just sends you home to rest, not to ruin.",
  center: "The town's outer fields stretch quiet and safe in every direction.",
  north: 'Tall grass sways under an open sky — the road north feels calm enough.',
  south: 'A well-worn path winds south, birdsong drifting from the treeline.',
  east: 'The ground rises gently to the east, wind picking up off the open field.',
  west: 'Old stone markers dot the western field, remnants of some earlier traveler.',
  northeast: 'The trees grow thick here, and the woods hum with a far-off, unfamiliar howl.',
  northwest: 'Something skitters in the underbrush to the northwest. Best stay alert.',
  southwest: 'The ground grows uneven and the shadows deepen. Little travels through here undisturbed.',

  // The 8 screens bordering a far corner - approach text, true for whichever
  // corner actually holds this save's dungeon and merely atmospheric for the
  // other 3.
  eastNortheast: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',
  northNortheast: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',
  westNorthwest: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',
  northNorthwest: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',
  eastSoutheast: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',
  southSoutheast: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',
  westSouthwest: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',
  southSouthwest: 'We must show our strength and venture towards what we feel within us. Something draws us closer.',

  // The 4 far-corner screens themselves - same text on all 4 since only one
  // of them actually holds the dungeon each save.
  farNortheast: "Cold chilly air and hot stinky breath comes to us from somewhere. Also a feeling of a future friend. Let's check it out!",
  farNorthwest: "Cold chilly air and hot stinky breath comes to us from somewhere. Also a feeling of a future friend. Let's check it out!",
  farSoutheast: "Cold chilly air and hot stinky breath comes to us from somewhere. Also a feeling of a future friend. Let's check it out!",
  farSouthwest: "Cold chilly air and hot stinky breath comes to us from somewhere. Also a feeling of a future friend. Let's check it out!",

  // southeast: pending a rewrite - its old line ("the dungeon can't be far")
  // no longer holds now that the dungeon lives 2 screens further out, in one
  // of the 4 far corners.
};
