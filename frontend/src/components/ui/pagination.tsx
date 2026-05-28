'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export function Pagination({
  page,
  pages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start}–{end}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span> results
      </p>

      <div className="flex items-center gap-3">
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per page</span>
            <Select value={String(limit)} onValueChange={(v) => v && onLimitChange(Number(v))}>
              <SelectTrigger className="w-[70px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            let p: number;
            if (pages <= 5) {
              p = i + 1;
            } else if (page <= 3) {
              p = i + 1;
            } else if (page >= pages - 2) {
              p = pages - 4 + i;
            } else {
              p = page - 2 + i;
            }
            return (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="icon"
                className="w-8 h-8 text-xs"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            );
          })}

          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
