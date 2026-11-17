import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="m-0 flex flex-col gap-5 rounded-card bg-card p-6 max-sm:gap-4 max-sm:p-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg leading-6 font-medium text-ink">{title}</h2>
        {subtitle && <p className="m-0 text-[13px] leading-5 text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
