import type { ReactNode } from 'react';
import { AlertIcon } from './icons';

/** An error that targets no single field; placed at the top of its card or form. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="m-0 flex items-start gap-3 rounded-lg border border-danger px-4 py-3 text-[13px] leading-5 text-body"
    >
      <AlertIcon className="mt-0.5 flex-none text-danger" />
      <span>{children}</span>
    </p>
  );
}
