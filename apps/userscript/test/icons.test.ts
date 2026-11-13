import { describe, expect, it } from 'vitest';
import { resourceIcon, shipIcon } from '../src/ui/icons';

const doc = document;

describe('resourceIcon', () => {
  it.each([
    ['metal', '0px -90px'],
    ['crystal', '-27px -90px'],
    ['deuterium', '-54px -90px'],
    ['darkMatter', '-108px -90px'],
  ] as const)('takes %s from the small-icon row of the sprite', (kind, pos) => {
    const e = resourceIcon(doc, kind, 'x');
    expect(e.style.backgroundImage).toContain('7f14c18b15064d2604c5476f5d10b3.png');
    expect(e.style.backgroundSize).toBe('360px 108px');
    expect(e.style.backgroundPosition).toBe(pos);
    expect(e.style.width).toBe('27px');
    expect(e.style.height).toBe('18px');
  });

  it('uses the game artefact image', () => {
    expect(resourceIcon(doc, 'artefacts', 'Art').style.backgroundImage).toBe(
      'url("https://gf3.geo.gfsrv.net/cdn2b/0e2244125e97c0d38bab285e057e44.png")',
    );
  });

  it('uses the game lithium image, tinted by its class', () => {
    const e = resourceIcon(doc, 'lithium', 'Lithium');
    expect(e.style.backgroundImage).toBe(
      'url("https://gf2.geo.gfsrv.net/cdna5/ab5e3b93021d20163984bc9bdc3f93.png")',
    );
    expect(e.classList.contains('is-lithium')).toBe(true);
  });

  it.each(['metal', 'artefacts', 'lithium'] as const)('titles the %s icon', (kind) => {
    expect(resourceIcon(doc, kind, 'Label').title).toBe('Label');
  });
});

describe('shipIcon', () => {
  it('uses the static image', () => {
    const e = shipIcon(doc, '202', 'Small cargo');
    expect(e.style.backgroundImage).toContain('60555c3c87b9eb3b5ddf76780b5712.jpg');
    expect(e.title).toBe('Small cargo');
  });

  it('ignores inherited keys', () => {
    for (const id of ['constructor', 'toString']) {
      const e = shipIcon(doc, id, 'Mystery');
      expect(e.title).toBe('Mystery');
      expect(e.style.backgroundImage).toBe('');
    }
  });

  it('returns an empty thumbnail for an unknown id', () => {
    const e = shipIcon(doc, '999', 'Mystery');
    expect(e.title).toBe('Mystery');
    expect(e.style.backgroundImage).toBe('');
  });
});
