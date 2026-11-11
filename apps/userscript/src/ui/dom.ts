import type { Gm } from '../gm';
import type { T } from '../i18n';
import type { createQueue } from '../sync/queue';

export type UiContext = {
  gm: Gm;
  doc: Document;
  t: T;
  queue: ReturnType<typeof createQueue>;
  refreshBox?: () => void;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

export function configureBoxContent(doc: Document, t: T, onConfigure: () => void): HTMLElement {
  const button = el(doc, 'button', {
    type: 'button',
    className: 'starledger-cta',
    textContent: t('configureSync'),
  });
  button.addEventListener('click', onConfigure);
  return el(
    doc,
    'div',
    {},
    el(
      doc,
      'div',
      { className: 'starledger-head' },
      el(doc, 'strong', { textContent: t('boxTitle') }),
    ),
    button,
  );
}

export const PANEL_ID = 'starledger-box';

const OGLIGHT_BOX = '.ogl_miniStats';
const observedLinks = new WeakSet<Element>();

function lastOglightBox(links: Element): Element | undefined {
  return [...links.querySelectorAll(OGLIGHT_BOX)].pop();
}

//! AGENTS.md §1.7: stacked under OGLight's box, monetization entries untouched
function placeBox(links: Element, box: Element): void {
  const ogl = lastOglightBox(links);
  if (!ogl) links.after(box);
  else if (ogl.nextElementSibling !== box) ogl.after(box);
}

function followOglight(doc: Document, links: Element): void {
  if (observedLinks.has(links)) return;
  observedLinks.add(links);
  //! AGENTS.md §1.3: reacts to DOM changes only, no timer
  new MutationObserver((records) => {
    try {
      const box = doc.getElementById(PANEL_ID);
      if (!box) return;
      const added = records.some((r) =>
        [...r.addedNodes].some((n) => n instanceof Element && n.matches(OGLIGHT_BOX)),
      );
      if (added) placeBox(links, box);
    } catch {
      // swallowed: our errors must never break the page
    }
  }).observe(links, { childList: true });
}

export function mountBox(doc: Document, box: HTMLElement): boolean {
  const links = doc.getElementById('links');
  if (!links) return false;
  doc.getElementById(PANEL_ID)?.remove();
  box.id = PANEL_ID;
  box.className = 'starledger-box';
  placeBox(links, box);
  followOglight(doc, links);
  return true;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    //! AGENTS.md §4: never a request to the game
    const host = u.hostname.replace(/\.$/, '').toLowerCase();
    return host !== 'gameforge.com' && !host.endsWith('.gameforge.com');
  } catch {
    return false;
  }
}

export function isInsecureUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith('http://');
}
