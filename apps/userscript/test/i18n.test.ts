import { afterEach, describe, expect, it } from 'vitest';
import { detectLang } from '../src/i18n';

const metas = (tags: Record<string, string>) => {
  document.head.innerHTML = Object.entries(tags)
    .map(([name, content]) => `<meta name="${name}" content="${content}">`)
    .join('');
};

describe('detectLang', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it("follows the player's interface language over the server's", () => {
    metas({ 'ogame-language': 'en', 'ogame-ui-language': 'fr' });
    expect(detectLang(document)).toBe('fr');
    metas({ 'ogame-language': 'fr', 'ogame-ui-language': 'en' });
    expect(detectLang(document)).toBe('en');
  });

  it('falls back to the server language without an interface language', () => {
    metas({ 'ogame-language': 'fr' });
    expect(detectLang(document)).toBe('fr');
  });

  it('uses English for a language without translation', () => {
    metas({ 'ogame-language': 'fr', 'ogame-ui-language': 'de' });
    expect(detectLang(document)).toBe('en');
    metas({});
    expect(detectLang(document)).toBe('en');
  });
});
