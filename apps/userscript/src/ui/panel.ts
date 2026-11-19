import { el, PANEL_ID } from './dom';

export type PanelPosition = 'above' | 'below';

export type PanelOptions = {
  id: string;
  position: PanelPosition;
  title: string;
  closeLabel: string;
  closeOnOutside: boolean;
  onClose?: () => void;
};

export type PanelHandle = { panel: HTMLElement; isOpen: () => boolean; close: () => void };

let closeCurrent: (() => void) | null = null;

function mount(doc: Document, panel: HTMLElement, position: PanelPosition): void {
  const host = doc.getElementById('contentWrapper') ?? doc.getElementById('middle');
  if (!host) {
    const box = doc.getElementById(PANEL_ID);
    if (box) box.after(panel);
    else doc.body.prepend(panel);
  } else if (position === 'below') host.append(panel);
  else host.prepend(panel);
}

//! AGENTS.md §1.7: in normal flow inside the game content area, covers no ad, menu entry or footer; opened by a click, fully removed on close
export function openPanel(doc: Document, opts: PanelOptions, content: Node[]): PanelHandle {
  closeCurrent?.();

  const panel = el(doc, 'div', { id: opts.id, className: 'starledger-dialog' });
  panel.setAttribute('role', 'dialog');
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
    doc.removeEventListener('pointerdown', onOutside);
    panel.remove();
    if (closeCurrent === close) closeCurrent = null;
    previousFocus?.focus();
    opts.onClose?.();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
  function onOutside(e: Event) {
    const target = e.target;
    if (target instanceof Node && target.isConnected && !panel.contains(target)) close();
  }
  closeCurrent = close;

  closeButton.addEventListener('click', close);
  doc.addEventListener('keydown', onKey);
  if (opts.closeOnOutside) {
    // pointerdown: the opening click's own pointerdown is already past, so it cannot close the panel
    doc.addEventListener('pointerdown', onOutside);
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
  mount(doc, panel, opts.position);
  if (typeof panel.scrollIntoView === 'function') panel.scrollIntoView({ block: 'nearest' });
  closeButton.focus();
  return { panel, isOpen: () => open, close };
}
