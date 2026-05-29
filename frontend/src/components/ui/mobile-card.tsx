'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reusable presentational building blocks for the mobile "card" representation
 * of a data-table row. On small screens a horizontally-scrolling table is a poor
 * experience, so each row is rendered as a self-contained card instead (see
 * `DataTable`'s `renderMobileCard` prop).
 *
 *   <MobileCard onClick={...}>
 *     <MobileCardHeader>…title / avatar / actions…</MobileCardHeader>
 *     <MobileCardField label="Price">$42.00</MobileCardField>
 *     <MobileCardField label="Status"><StatusBadge … /></MobileCardField>
 *   </MobileCard>
 */
export function MobileCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-3.5 flex flex-col gap-2.5',
        interactive && 'cursor-pointer transition-colors active:bg-muted/40 hover:bg-muted/20',
        className,
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/** Top row of a card — typically the primary identity + an actions slot. */
export function MobileCardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      {children}
    </div>
  );
}

/** A label/value row. Value is right-aligned and allowed to shrink/truncate. */
export function MobileCardField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 text-sm', className)}>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 text-right font-medium text-foreground">{children}</div>
    </div>
  );
}

/** Footer row for actions; stacks/wraps and aligns to the end. */
export function MobileCardActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 pt-1 mt-0.5 border-t border-border/60',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
