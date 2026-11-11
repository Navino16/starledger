import type { Gm } from '../gm';

let style: HTMLStyleElement | null = null;

// GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3
export function setOglightHidden(gm: Gm, hidden: boolean): void {
  if (hidden && !style) {
    style = gm.addStyle('.ogl_miniStats{display:none!important}');
  } else if (!hidden && style) {
    style.remove();
    style = null;
  }
}
