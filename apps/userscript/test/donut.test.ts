import { afterEach, describe, expect, it } from 'vitest';
import { createT } from '../src/i18n';
import { renderDonut } from '../src/ui/details/donut';

const setLang = (lang: string) => {
  document.head.innerHTML = `<meta name="ogame-language" content="${lang}">`;
};
afterEach(() => {
  document.head.innerHTML = '';
});

describe('renderDonut', () => {
  it('shows one-decimal percentages with a decimal comma in French', () => {
    setLang('fr');
    const d = renderDonut(document, createT('fr'), { resources: 19, nothing: 8, ships: 5 });
    const text = d.textContent ?? '';
    expect(text).toContain('59,4 %');
    expect(text).toContain('25,0 %');
    expect(text).toContain('15,6 %');
    expect(text).toContain('Ressources');
    expect(d.querySelectorAll('circle[data-outcome]')).toHaveLength(3);
    expect(d.querySelector('.starledger-donut-total')?.textContent).toBe('32');
  });

  it('uses a decimal point in English', () => {
    setLang('en');
    const d = renderDonut(document, createT('en'), { resources: 19, nothing: 13 });
    expect(d.textContent).toContain('59.4%');
  });

  it('draws an empty circle without percentages or NaN when the total is 0', () => {
    const cases: (Record<string, number> | undefined)[] = [{}, { resources: 0 }, undefined];
    for (const outcomes of cases) {
      const d = renderDonut(document, createT('en'), outcomes);
      expect(d.textContent).not.toContain('NaN');
      expect(d.textContent).not.toContain('%');
      expect(d.querySelectorAll('circle[data-outcome]')).toHaveLength(0);
      expect(d.querySelector('.starledger-donut-total')?.textContent).toBe('0');
    }
  });

  it('skips zero outcomes in the legend', () => {
    const d = renderDonut(document, createT('en'), { resources: 2, ships: 0 });
    expect(d.querySelectorAll('[data-legend]')).toHaveLength(1);
  });
});
