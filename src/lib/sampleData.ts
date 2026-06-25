/**
 * A small, deliberately clustered corpus. Three loose themes — animals,
 * space, and cooking — so that real embeddings produce visible clusters
 * and similarity search has obvious "right answers" to demonstrate.
 */
export const SAMPLE_DOCUMENTS: string[] = [
  'The cat slept on the warm windowsill all afternoon.',
  'Dogs are loyal companions that love long walks.',
  'A lion is the apex predator of the African savanna.',
  'Astronauts aboard the space station orbit Earth every 90 minutes.',
  'The telescope captured a distant spiral galaxy in stunning detail.',
  'Rockets burn liquid fuel to escape the pull of gravity.',
  'Whisk the eggs and sugar until the batter turns pale.',
  'Slow-roast the garlic until it caramelizes into a sweet paste.',
  'A pinch of salt brightens the flavor of fresh tomatoes.',
];

export const SAMPLE_QUERY = 'How do animals behave in the wild?';
