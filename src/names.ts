const ADJECTIVES = [
  'Swift', 'Clever', 'Brave', 'Tiny', 'Mighty', 'Fuzzy', 'Sleepy', 'Jolly',
  'Wispy', 'Zippy', 'Cosmic', 'Pixel', 'Turbo', 'Lucky', 'Nimble', 'Spicy',
  'Chill', 'Snappy', 'Witty', 'Blazing', 'Glowy', 'Rusty', 'Sparky', 'Dapper',
];

const NOUNS = [
  'Claude', 'Opus', 'Sonnet', 'Haiku', 'Spark', 'Chip', 'Byte', 'Bean',
  'Pip', 'Dot', 'Nova', 'Flux', 'Bit', 'Hex', 'Nano', 'Cog',
  'Fizz', 'Bolt', 'Rune', 'Glyph', 'Pixel', 'Orb', 'Mote', 'Ember',
];

const nameCache = new Map<string, string>();

export function petName(sessionId: string): string {
  const cached = nameCache.get(sessionId);
  if (cached) return cached;

  // Hash the session ID to pick deterministic but random-looking names
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }

  const adj = ADJECTIVES[Math.abs(hash) % ADJECTIVES.length];
  const noun = NOUNS[Math.abs(hash >> 8) % NOUNS.length];
  const name = `${adj} ${noun}`;

  nameCache.set(sessionId, name);
  return name;
}
