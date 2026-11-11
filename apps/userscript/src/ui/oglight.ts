import type { Gm } from '../gm';

const STYLE_ID = 'starledger-hide-oglight';

// GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3
export function setOglightHidden(gm: Gm, doc: Document, hidden: boolean): void {
  const existing = doc.getElementById(STYLE_ID);
  if (hidden && !existing) {
    gm.addStyle('.ogl_miniStats{display:none!important}').id = STYLE_ID;
  } else if (!hidden) {
    existing?.remove();
  }
}
