import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BASE =
  'inline-flex items-center justify-center gap-2 h-10 max-sm:h-11 px-4 border rounded-control font-medium text-sm leading-none whitespace-nowrap cursor-pointer transition-colors active:scale-[0.98] disabled:cursor-default disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gold border-gold text-on-gold hover:brightness-[1.08]',
  secondary: 'bg-raised border-line text-ink hover:bg-hover',
  ghost: 'bg-transparent border-transparent text-body hover:bg-raised',
  danger: 'bg-transparent border-transparent text-danger hover:border-danger',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    BASE,
    VARIANTS[variant],
    size === 'sm' ? 'h-8 max-sm:h-10 px-3 text-[13px]' : '',
    block ? 'w-full' : '',
    className,
  ];
  return <button type={type} className={classes.filter(Boolean).join(' ')} {...props} />;
}
