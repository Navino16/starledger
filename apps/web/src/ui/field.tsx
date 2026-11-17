import { type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { AlertIcon } from './icons';

export const CONTROL_CLASSES =
  'h-10 max-sm:h-11 px-3 bg-page border border-control rounded-control text-ink text-sm leading-5 tabular-nums placeholder:text-muted aria-invalid:border-danger';
export const INPUT_CLASSES = `w-full ${CONTROL_CLASSES}`;

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="m-0 flex items-start gap-2 text-[13px] leading-5 text-body">
      <AlertIcon className="mt-0.5 flex-none text-danger" />
      <span>{children}</span>
    </p>
  );
}

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Label above, hint or error below and linked by aria-describedby (docs/web-design.md, Champ). */
export function Field({ label, hint, error, id, className = '', ...props }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label className="text-[13px] leading-5 text-body" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={INPUT_CLASSES}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...props}
      />
      {error ? (
        <FieldError id={noteId}>{error}</FieldError>
      ) : hint ? (
        <p id={noteId} className="m-0 text-xs leading-4 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
