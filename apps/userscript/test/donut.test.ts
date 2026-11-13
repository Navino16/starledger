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
    expect(d.querySelectorAll('[data-outcome]')).toHaveLength(3);
    expect(d.querySelector('.starledger-donut-total')?.textContent).toBe('32');
  });

  it('uses a decimal point in English', () => {
    setLang('en');
    const d = renderDonut(document, createT('en'), { resources: 19, nothing: 13 });
    expect(d.textContent).toContain('59.4%');
  });

  it('draws an empty circle without percentages or NaN when the total is 0', () => {
    const cases: Record<string, number>[] = [{}, { resources: 0 }];
    for (const outcomes of cases) {
      const d = renderDonut(document, createT('en'), outcomes);
      expect(d.textContent).not.toContain('NaN');
      expect(d.textContent).not.toContain('%');
      expect(d.querySelectorAll('[data-outcome]')).toHaveLength(0);
      expect(d.querySelector('.starledger-donut-total')?.textContent).toBe('0');
    }
  });

  it('skips zero outcomes in the legend', () => {
    const d = renderDonut(document, createT('en'), { resources: 2, ships: 0 });
    expect(d.querySelectorAll('[data-legend]')).toHaveLength(1);
  });

  it('shows ? and no legend when the server sent no outcomes', () => {
    const d = renderDonut(document, createT('en'), undefined);
    expect(d.querySelector('.starledger-donut-total')?.textContent).toBe('?');
    expect(d.querySelectorAll('[data-legend]')).toHaveLength(0);
    expect(d.querySelectorAll('[data-outcome]')).toHaveLength(0);
  });

  it('keeps 0 in the centre for an empty outcomes object', () => {
    const d = renderDonut(document, createT('en'), {});
    expect(d.querySelector('.starledger-donut-total')?.textContent).toBe('0');
  });

  it('labels the chart for assistive technology and titles each arc', () => {
    const d = renderDonut(document, createT('en'), { resources: 19, nothing: 13 });
    const svg = d.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Resources 19 (59.4%), Nothing 13 (40.6%)');
    expect(d.querySelector('path[data-outcome="nothing"] title')?.textContent).toBe(
      'Nothing 13 (40.6%)',
    );
  });

  it('uses the no-expedition text as the label of an empty chart', () => {
    const t = createT('en');
    const d = renderDonut(document, t, {});
    expect(d.querySelector('svg')?.getAttribute('aria-label')).toBe(t('noExpedition'));
  });

  it('labels the chart ? without outcomes and keeps the no-expedition text for {}', () => {
    const t = createT('en');
    const label = (o: Record<string, number> | undefined) =>
      renderDonut(document, t, o).querySelector('svg')?.getAttribute('aria-label');
    expect(label(undefined)).toBe('?');
    expect(label({})).toBe(t('noExpedition'));
  });

  describe('sector geometry', () => {
    const points = (d: string) =>
      d
        .replace(/[MZ]/g, '')
        .split('L')
        .map((p) => p.trim().split(' ').map(Number));
    const sectors = (d: HTMLElement) =>
      [...d.querySelectorAll('[data-outcome]')].map((p) => points(p.getAttribute('d') ?? ''));

    it('starts at the top and closes a single outcome on itself', () => {
      const [ring] = sectors(renderDonut(document, createT('en'), { resources: 1 }));
      expect(ring?.[0]).toEqual([50, 2]);
      expect(ring?.[ring.length / 2 - 1]?.[0]).toBeCloseTo(50, 1);
      expect(ring?.[ring.length / 2 - 1]?.[1]).toBeCloseTo(2, 1);
    });

    it('chains the sectors: each starts where the previous one ends', () => {
      const list = sectors(
        renderDonut(document, createT('en'), { resources: 19, nothing: 8, ships: 5 }),
      );
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1] ?? [];
        expect(list[i]?.[0]).toEqual(prev[prev.length / 2 - 1]);
      }
    });

    it('draws only straight segments', () => {
      const d = renderDonut(document, createT('en'), { resources: 3, nothing: 1 });
      for (const p of d.querySelectorAll('[data-outcome]')) {
        expect(p.getAttribute('d')).toMatch(/^M [\d. L-]+ Z$/);
      }
    });
  });
});
