import { el } from './dom';

export type PanelOptions = {
  id: string;
  title: string;
  closeLabel: string;
  closeOnOutside: boolean;
  onClose?: () => void;
};

export type PanelHandle = { panel: HTMLElement; isOpen: () => boolean; close: () => void };

export const BACKDROP_CLASS = 'starledger-backdrop';

let closeCurrent: (() => void) | null = null;

//! GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3
//! AGENTS.md §1.7: the backdrop dims ads and monetization entries while open; opened by a click, closed by the player, fully removed on close
export function openPanel(doc: Document, opts: PanelOptions, content: Node[]): PanelHandle {
  closeCurrent?.();

  const panel = el(doc, 'div', { id: opts.id, className: 'starledger-dialog' });
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const backdrop = el(doc, 'div', { className: BACKDROP_CLASS }, panel);
  const closeButton = el(
    doc,
    'button',
    { type: 'button', className: 'starledger-close', title: opts.closeLabel },
    // The game's own close icon sprite; its text is hidden by the game's .ui-icon rule
    el(doc, 'span', { className: 'ui-icon ui-icon-closethick', textContent: opts.closeLabel }),
  );
  const previousFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  let open = true;

  function close() {
    if (!open) return;
    open = false;
    doc.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (closeCurrent === close) closeCurrent = null;
    previousFocus?.focus();
    opts.onClose?.();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
  closeCurrent = close;

  closeButton.addEventListener('click', close);
  doc.addEventListener('keydown', onKey);
  if (opts.closeOnOutside) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }

  panel.append(
    el(
      doc,
      'div',
      { className: 'starledger-dialog-head' },
      el(doc, 'strong', { textContent: opts.title }),
      closeButton,
    ),
    el(doc, 'div', { className: 'starledger-dialog-content' }, ...content),
  );
  doc.body.append(backdrop);
  closeButton.focus();
  return { panel, isOpen: () => open, close };
}
