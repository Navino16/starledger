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

//! AGENTS.md §1.7: inserted under #links, monetization entries untouched
export function mountBox(doc: Document, box: HTMLElement): boolean {
  const links = doc.getElementById('links');
  if (!links) return false;
  doc.getElementById(PANEL_ID)?.remove();
  box.id = PANEL_ID;
  box.className = 'starledger-box';
  links.after(box);
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
