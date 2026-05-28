'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export function ChartContainer({
  loading = false,
  error = false,
  errorMessage = 'Failed to load chart data',
  empty = false,
  emptyMessage = 'No data available',
  height = 280,
  className,
  children,
}: ChartContainerProps) {
  if (loading) {
    return (
      <div style={{ height }} className={cn('flex items-end gap-2 px-2', className)}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${30 + ((i * 17) % 60)}%` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ height }}
        className={cn('flex items-center justify-center text-sm text-muted-foreground', className)}
      >
        {errorMessage}
      </div>
    );
  }

  if (empty) {
    return (
      <div
        style={{ height }}
        className={cn('flex items-center justify-center text-sm text-muted-foreground', className)}
      >
        {emptyMessage}
      </div>
    );
  }

  return <div style={{ height }} className={cn('w-full', className)}>{children}</div>;
}
