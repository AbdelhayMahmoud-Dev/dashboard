'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  placeholder: string;
  className?: string;
  allLabel?: string;
}

export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  allLabel = `All ${placeholder}`,
}: FilterSelectProps) {
  return (
    <Select
      value={value || 'all'}
      onValueChange={(v) => onValueChange(!v || v === 'all' ? '' : v)}
    >
      <SelectTrigger className={cn('w-[160px]', className)}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onClearAll?: () => void;
  className?: string;
}

export function ActiveFilters({ filters, onClearAll, className }: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('flex items-center flex-wrap gap-2', className)}>
      <span className="text-xs text-muted-foreground">Filters:</span>
      {filters.map((f) => (
        <Badge key={f.key} variant="secondary" className="gap-1 pl-2 pr-1 h-6 text-xs">
          {f.label}
          <button
            onClick={f.onRemove}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
            aria-label={`Remove ${f.label} filter`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </Badge>
      ))}
      {onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
