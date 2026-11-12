import { describe, expect, it } from 'vitest';
import { resourceIcon, shipIcon } from '../src/ui/icons';

const doc = document;
const defined = (...tags: string[]) => ({
  customElements: { get: (n: string) => (tags.includes(n) ? class {} : undefined) },
});

describe('resourceIcon', () => {
  it('falls back to the sprite with the metal position', () => {
    const e = resourceIcon(doc, 'metal', 'Metal');
    expect(e.title).toBe('Metal');
    expect(e.style.backgroundImage).toContain('7f14c18b15064d2604c5476f5d10b3.png');
    expect(e.style.backgroundPosition).toBe('1% 11%');
    expect(e.style.backgroundSize).toContain('302px');
  });

  it.each([
    ['crystal', '16% 11%'],
    ['deuterium', '30% 11%'],
    ['darkMatter', '57% 11%'],
  ] as const)('sprite position for %s', (kind, pos) => {
    expect(resourceIcon(doc, kind, 'x').style.backgroundPosition).toBe(pos);
  });

  it('uses the artefacts image', () => {
    const e = resourceIcon(doc, 'artefacts', 'Art');
    expect(e.style.backgroundImage).toContain('596ba85baa74145390e04f7428d93e.png');
  });

  it('uses the game component when defined on the page window', () => {
    const e = resourceIcon(doc, 'metal', 'Metal', defined('resource-icon'));
    expect(e.tagName.toLowerCase()).toBe('resource-icon');
    expect(e.classList.contains('metal')).toBe(true);
    expect(e.hasAttribute('sq16')).toBe(true);
    expect(e.title).toBe('Metal');
  });

  it('uses the dark matter component class', () => {
    const e = resourceIcon(doc, 'darkMatter', 'DM', defined('resource-icon'));
    expect(e.classList.contains('darkmatter')).toBe(true);
  });

  it('always uses lithium-icon', () => {
    for (const page of [undefined, defined('lithium-icon')]) {
      const e = resourceIcon(doc, 'lithium', 'Li', page);
      expect(e.tagName.toLowerCase()).toBe('lithium-icon');
      expect(e.hasAttribute('sq16')).toBe(true);
      expect(e.title).toBe('Li');
    }
  });
});

describe('shipIcon', () => {
  it('falls back to the static image', () => {
    const e = shipIcon(doc, '202', 'Small cargo');
    expect(e.style.backgroundImage).toContain('60555c3c87b9eb3b5ddf76780b5712.jpg');
    expect(e.title).toBe('Small cargo');
  });

  it('uses technology-icon when defined', () => {
    const e = shipIcon(doc, '202', 'Small cargo', defined('technology-icon'));
    expect(e.tagName.toLowerCase()).toBe('technology-icon');
    expect(e.hasAttribute('transportersmall')).toBe(true);
    expect(e.title).toBe('Small cargo');
  });

  it('returns an empty thumbnail for an unknown id', () => {
    const e = shipIcon(doc, '999', 'Mystery');
    expect(e.title).toBe('Mystery');
    expect(e.style.backgroundImage).toBe('');
  });
});
