import type { Gm } from '../gm';

const STYLE_ID = 'starledger-hide-oglight';

//! AGENTS.md §1.7: hides another tolerated tool's box only; ToolDev answer 2026-11-18 (forum thread 598): not Origin's concern
export function setOglightHidden(gm: Gm, doc: Document, hidden: boolean): void {
  const existing = doc.getElementById(STYLE_ID);
  if (hidden && !existing) {
    gm.addStyle('.ogl_miniStats{display:none!important}').id = STYLE_ID;
  } else if (!hidden) {
    existing?.remove();
  }
}
