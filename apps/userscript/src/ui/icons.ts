import { SHIP_TECH_NAMES } from '@app/shared';
import { el } from './dom';

export type IconKind = 'metal' | 'crystal' | 'deuterium' | 'darkMatter' | 'artefacts' | 'lithium';

export type IconPage = { customElements?: { get(name: string): unknown } };

const SPRITE = 'https://gf3.geo.gfsrv.net/cdned/7f14c18b15064d2604c5476f5d10b3.png';
const ARTEFACTS_IMAGE = 'https://gf1.geo.gfsrv.net/cdn65/596ba85baa74145390e04f7428d93e.png';

const SPRITE_POSITIONS: Partial<Record<IconKind, string>> = {
  metal: '1% 11%',
  crystal: '16% 11%',
  deuterium: '30% 11%',
  darkMatter: '57% 11%',
};

const SHIP_IMAGES = new Map(
  Object.entries({
    '202': 'https://gf2.geo.gfsrv.net/cdnd9/60555c3c87b9eb3b5ddf76780b5712.jpg',
    '203': 'https://gf1.geo.gfsrv.net/cdn34/fdbcc505474e3e108d10a3ed4a19f4.jpg',
    '204': 'https://gf2.geo.gfsrv.net/cdnd2/9ed5c1b6aea28fa51f84cdb8cb1e7e.jpg',
    '205': 'https://gf1.geo.gfsrv.net/cdnf1/8266a2cbae5ad630c5fedbdf270f3e.jpg',
    '206': 'https://gf2.geo.gfsrv.net/cdn45/b7ee4f9d556a0f39dae8d2133e05b7.jpg',
    '207': 'https://gf1.geo.gfsrv.net/cdn32/3f4a081f4d15662bed33473db53d5b.jpg',
    '208': 'https://gf1.geo.gfsrv.net/cdn6f/41a21e4253d2231f8937ddef1ba43e.jpg',
    '209': 'https://gf1.geo.gfsrv.net/cdn07/6246eb3d7fa67414f6b818fa79dd9b.jpg',
    '210': 'https://gf3.geo.gfsrv.net/cdnb5/347821e80cafc52aec04f27c3a2a4d.jpg',
    '211': 'https://gf1.geo.gfsrv.net/cdnca/4d55a520aed09d0c43e7b962f33e27.jpg',
    '212': 'https://gf2.geo.gfsrv.net/cdnda/665c65072887153d44a6684ec276e9.jpg',
    '213': 'https://gf3.geo.gfsrv.net/cdn2a/c2b9fedc9c93ef22f2739c49fbac52.jpg',
    '214': 'https://gf3.geo.gfsrv.net/cdn84/155e9e24fc1d34ed4660de8d428f45.jpg',
    '215': 'https://gf3.geo.gfsrv.net/cdn5a/24f511ec14a71e2d83fd750aa0dee2.jpg',
    '217': 'https://gf3.geo.gfsrv.net/cdn26/28e8d79a5b489dc795cc47f3adf165.jpg',
    '218': 'https://gf1.geo.gfsrv.net/cdn39/12d016c8bb0d71e053b901560c17cc.jpg',
    '219': 'https://gf3.geo.gfsrv.net/cdne2/b8d8d18f2baf674acedb7504c7cc83.jpg',
  }),
);

const TECH_NAME_BY_ID = new Map(Object.entries(SHIP_TECH_NAMES).map(([n, id]) => [id, n] as const));

const GAME_COMPONENT_KINDS = new Set<IconKind>(['metal', 'crystal', 'deuterium']);

const isDefined = (page: IconPage | undefined, tag: string): boolean =>
  page?.customElements?.get(tag) !== undefined;

function thumb(doc: Document, title: string, w: number, h: number): HTMLElement {
  const e = el(doc, 'span', { title });
  e.style.display = 'inline-block';
  e.style.width = `${w}px`;
  e.style.height = `${h}px`;
  e.style.backgroundRepeat = 'no-repeat';
  return e;
}

//! AGENTS.md §4: game components or static Gameforge CDN images, no game request
export function resourceIcon(
  doc: Document,
  kind: IconKind,
  title: string,
  page?: IconPage,
): HTMLElement {
  if (kind === 'lithium' || (GAME_COMPONENT_KINDS.has(kind) && isDefined(page, 'resource-icon'))) {
    const tag = kind === 'lithium' ? 'lithium-icon' : 'resource-icon';
    const e = doc.createElement(tag);
    if (kind !== 'lithium') e.className = kind.toLowerCase();
    e.setAttribute('sq16', '');
    e.title = title;
    return e;
  }
  const sprite = SPRITE_POSITIONS[kind];
  if (sprite) {
    const e = thumb(doc, title, 28, 18);
    e.style.backgroundImage = `url("${SPRITE}")`;
    e.style.backgroundSize = '302px';
    e.style.backgroundPosition = sprite;
    return e;
  }
  const e = thumb(doc, title, 18, 18);
  e.style.backgroundImage = `url("${ARTEFACTS_IMAGE}")`;
  e.style.backgroundSize = 'contain';
  return e;
}

export function shipIcon(
  doc: Document,
  shipId: string,
  title: string,
  page?: IconPage,
): HTMLElement {
  const tech = TECH_NAME_BY_ID.get(shipId);
  if (tech && isDefined(page, 'technology-icon')) {
    const e = doc.createElement('technology-icon');
    e.setAttribute(tech, '');
    e.title = title;
    return e;
  }
  const e = thumb(doc, title, 28, 28);
  const url = SHIP_IMAGES.get(shipId);
  if (url) {
    e.style.backgroundImage = `url("${url}")`;
    e.style.backgroundSize = 'contain';
  }
  return e;
}
