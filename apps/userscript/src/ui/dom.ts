import type { Gm } from '../gm';
import type { Lang, T } from '../i18n';
import type { createQueue } from '../sync/queue';

export type UiContext = {
  gm: Gm;
  doc: Document;
  lang: Lang;
  t: T;
  queue: ReturnType<typeof createQueue>;
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

export const PANEL_ID = 'starledger-box';

// AGENTS.md §1.7: inserted under #links, monetization entries untouched
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
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
