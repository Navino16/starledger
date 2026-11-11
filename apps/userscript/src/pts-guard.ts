// AGENTS.md §5: PTS only until toleration, removed in scope 14
export const PTS_UNIVERSES = ['s808-en.ogame.gameforge.com'];

export function isAllowedUniverse(doc: Document): boolean {
  const universe = doc.querySelector('meta[name="ogame-universe"]')?.getAttribute('content');
  return !!universe && PTS_UNIVERSES.includes(universe);
}
