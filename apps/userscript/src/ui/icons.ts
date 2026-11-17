import {
  ARTEFACTS_IMAGE,
  LITHIUM_IMAGE,
  RESOURCE_SPRITE,
  RESOURCE_SPRITE_INDEX,
  SHIP_IMAGES,
} from '@app/shared';
import { el } from './dom';

export type IconKind = 'metal' | 'crystal' | 'deuterium' | 'darkMatter' | 'artefacts' | 'lithium';

// The sprite ends with a row of 48x32 icons at y=160, drawn here at 27x18
const SPRITE_INDEX: Partial<Record<IconKind, number>> = RESOURCE_SPRITE_INDEX;
const SHIP_IMAGE_URLS = new Map(Object.entries(SHIP_IMAGES));

function thumb(doc: Document, title: string, w: number, h: number): HTMLElement {
  const e = el(doc, 'span', { title, className: 'starledger-icon' });
  e.style.width = `${w}px`;
  e.style.height = `${h}px`;
  return e;
}

//! AGENTS.md §4: static Gameforge CDN images, no game request
export function resourceIcon(doc: Document, kind: IconKind, title: string): HTMLElement {
  const index = SPRITE_INDEX[kind];
  if (index !== undefined) {
    const e = thumb(doc, title, 27, 18);
    e.style.backgroundImage = `url("${RESOURCE_SPRITE}")`;
    e.style.backgroundSize = '360px 108px';
    e.style.backgroundPosition = `-${index * 27}px -90px`;
    return e;
  }
  const e = thumb(doc, title, 18, 18);
  e.style.backgroundImage = `url("${kind === 'lithium' ? LITHIUM_IMAGE : ARTEFACTS_IMAGE}")`;
  e.style.backgroundSize = 'contain';
  e.style.backgroundPosition = 'center';
  if (kind === 'lithium') e.classList.add('is-lithium');
  return e;
}

export function shipIcon(doc: Document, shipId: string, title: string): HTMLElement {
  const e = thumb(doc, title, 38, 28);
  const url = SHIP_IMAGE_URLS.get(shipId);
  if (url) {
    e.style.backgroundImage = `url("${url}")`;
    e.style.backgroundSize = 'cover';
  }
  return e;
}
