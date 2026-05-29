'use client';

import { memo, useState, useCallback, useMemo, type ReactNode } from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown, Inbox, MoreHorizontal,
  Settings2, Check, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ── Public types ──────────────────────────────────────────────────────────────
export type Density = 'compact' | 'default' | 'comfortable';
type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key:              string;
  header:           string;
  cell:             (row: T) => React.ReactNode;
  /** If present, clicking the header cycles asc → desc → null */
  sortFn?:          (a: T, b: T) => number;
  className?:       string;
  headerClassName?: string;
  /** Right-aligned numeric column */
  numeric?:         boolean;
  /** Set to false to prevent the user from hiding this column via the view menu (e.g. an "Actions" column). Default true. */
  hideable?:        boolean;
}

export interface SelectionState {
  /** IDs of currently selected rows (as returned by getRowKey). */
  selected:  ReadonlySet<string>;
  /** Called whenever the selected set changes. */
  onChange:  (next: Set<string>) => void;
}

export interface ColumnVisibilityState {
  /** Keys of columns that should be hidden. */
  hidden:    ReadonlySet<string>;
  onChange:  (next: Set<string>) => void;
}

interface DataTableProps<T> {
  columns:       Column<T>[];
  data:          T[];
  loading?:      boolean;
  emptyMessage?: string;
  emptyIcon?:    React.ReactNode;
  skeletonRows?: number;
  getRowKey:     (row: T) => string;
  onRowClick?:   (row: T) => void;
  caption?:      string;
  /** CSS max-height for the scrollable area; enables sticky header + body scroll. */
  maxHeight?:    string;
  /** Highlight rows matching the predicate (subtle background). */
  isHighlighted?: (row: T) => boolean;
  /** Spacing density. Defaults to `default` to preserve existing visuals. */
  density?:       Density;
  /** Enables bulk-selection mode (adds a leading checkbox column). */
  selection?:     SelectionState;
  /** Enables hide/show of columns. */
  columnVisibility?: ColumnVisibilityState;
  /** Rendered above the table inside the same bordered shell — search, filters, view menu, etc. */
  toolbar?:       ReactNode;
  /**
   * When provided, the horizontally-scrolling table is hidden below the `md`
   * breakpoint and each row is rendered as a card instead — eliminating mobile
   * horizontal overflow. Sorting/selection still apply to the same `displayData`.
   */
  renderMobileCard?: (row: T) => ReactNode;
}

// ── Density tokens ────────────────────────────────────────────────────────────
const DENSITY_CELL: Record<Density, string> = {
  compact:     'px-3 py-1.5 text-[13px]',
  default:     'px-4 py-3   text-sm',
  comfortable: 'px-4 py-4   text-sm',
};
const DENSITY_HEAD: Record<Density, string> = {
  compact:     'px-3 py-2',
  default:     'px-4 py-3',
  comfortable: 'px-4 py-3.5',
};

// ── Memoised row ──────────────────────────────────────────────────────────────
const TableRow = memo(function TableRow<T>({
  row,
  rowKey,
  columns,
  density,
  onRowClick,
  highlighted,
  selection,
}: {
  row:          T;
  rowKey:       string;
  columns:      Column<T>[];
  density:      Density;
  onRowClick?:  (row: T) => void;
  highlighted?: boolean;
  selection?:   SelectionState;
}) {
  const isSelected = selection?.selected.has(rowKey) ?? false;

  const toggle = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(rowKey)) next.delete(rowKey);
    else next.add(rowKey);
    selection.onChange(next);
  };

  return (
    <tr
      data-state={isSelected ? 'selected' : undefined}
      className={cn(
        'border-b border-border/60 last:border-0 transition-colors',
        onRowClick
          ? 'cursor-pointer hover:bg-muted/30 focus-within:bg-muted/20 active:bg-muted/40'
          : 'hover:bg-muted/15',
        highlighted && 'bg-primary/5 hover:bg-primary/8',
        isSelected && 'bg-primary/[0.04] hover:bg-primary/[0.06]',
      )}
      onClick={() => onRowClick?.(row)}
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onRowClick(row);
        }
      }}
      role={onRowClick ? 'button' : undefined}
    >
      {selection && (
        <td
          className={cn(DENSITY_CELL[density], 'w-10 pr-0')}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={toggle}
            aria-label={`Select row ${rowKey}`}
          />
        </td>
      )}
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            DENSITY_CELL[density],
            col.numeric && 'text-right tabular',
            col.className,
          )}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  );
}) as <T>(props: {
  row:          T;
  rowKey:       string;
  columns:      Column<T>[];
  density:      Density;
  onRowClick?:  (row: T) => void;
  highlighted?: boolean;
  selection?:   SelectionState;
}) => React.ReactElement;

// ── Main DataTable ────────────────────────────────────────────────────────────
export function DataTable<T>({
  columns,
  data,
  loading      = false,
  emptyMessage = 'No data found',
  emptyIcon,
  skeletonRows = 6,
  getRowKey,
  onRowClick,
  caption,
  maxHeight,
  isHighlighted,
  density = 'default',
  selection,
  columnVisibility,
  toolbar,
  renderMobileCard,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = useCallback((col: Column<T>) => {
    if (!col.sortFn) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir(null);
      setSortKey(null);
    } else {
      setSortDir('asc');
    }
  }, [sortKey, sortDir]);

  // Filter out hidden columns (when columnVisibility is provided).
  const visibleColumns = useMemo(() => {
    if (!columnVisibility) return columns;
    return columns.filter((c) => !columnVisibility.hidden.has(c.key));
  }, [columns, columnVisibility]);

  // Apply sort
  const displayData = useMemo(() => {
    if (!sortKey || sortDir === null) return data;
    const col = visibleColumns.find((c) => c.key === sortKey);
    if (!col?.sortFn) return data;
    const sorted = [...data].sort(col.sortFn);
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDir, visibleColumns]);

  // Select-all logic
  const allRowIds = useMemo(() => data.map(getRowKey), [data, getRowKey]);
  const selectedCount = selection
    ? allRowIds.reduce((n, id) => n + (selection.selected.has(id) ? 1 : 0), 0)
    : 0;
  const allSelected = selection ? selectedCount === allRowIds.length && allRowIds.length > 0 : false;
  const someSelected = selection ? selectedCount > 0 && !allSelected : false;

  const toggleAll = useCallback(() => {
    if (!selection) return;
    if (allSelected || someSelected) {
      // Clear only the rows present on this page; preserve any other selections.
      const next = new Set(selection.selected);
      allRowIds.forEach((id) => next.delete(id));
      selection.onChange(next);
    } else {
      const next = new Set(selection.selected);
      allRowIds.forEach((id) => next.add(id));
      selection.onChange(next);
    }
  }, [selection, allSelected, someSelected, allRowIds]);

  const colSpan = visibleColumns.length + (selection ? 1 : 0);

  // Shared empty-state body (used by both the table and the mobile card list).
  const emptyInner = (
    <div className="flex flex-col items-center gap-3" role="status" aria-label={emptyMessage}>
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
        {emptyIcon ?? <Inbox className="w-6 h-6 text-muted-foreground/40" aria-hidden="true" />}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          Data will appear here once available.
        </p>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
          {toolbar}
        </div>
      )}

      <div
        className={cn(
          'overflow-x-auto',
          // When a mobile card renderer is supplied, hide the table on small screens.
          renderMobileCard && 'hidden md:block',
          maxHeight && 'overflow-y-auto',
        )}
        style={maxHeight ? { maxHeight } : undefined}
        role="region"
        aria-label={caption || 'Data table'}
      >
        <table
          className="w-full text-sm"
          aria-busy={loading}
          aria-label={caption}
        >
          {caption && <caption className="sr-only">{caption}</caption>}

          {/* ── Sticky header ─────────────────────────────────────────────── */}
          <thead className={cn(
            'bg-muted/30 border-b border-border',
            maxHeight && 'sticky top-0 z-10 shadow-[0_1px_0_var(--border)]',
          )}>
            <tr>
              {selection && (
                <th
                  scope="col"
                  className={cn(DENSITY_HEAD[density], 'w-10 pr-0 text-left')}
                >
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                  />
                </th>
              )}
              {visibleColumns.map((col) => {
                const sortable    = !!col.sortFn;
                const activeSort  = sortKey === col.key ? sortDir : null;

                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => handleSort(col)}
                    className={cn(
                      DENSITY_HEAD[density],
                      'text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide select-none',
                      col.numeric && 'text-right',
                      sortable && 'cursor-pointer hover:text-foreground transition-colors',
                      col.headerClassName,
                    )}
                    aria-sort={
                      activeSort === 'asc'  ? 'ascending'  :
                      activeSort === 'desc' ? 'descending' :
                      sortable ? 'none' : undefined
                    }
                  >
                    <span className={cn('inline-flex items-center gap-1.5', col.numeric && 'justify-end w-full')}>
                      {col.header}
                      {sortable && (
                        <span className="text-muted-foreground/50" aria-hidden="true">
                          {activeSort === 'asc'  ? <ArrowUp   className="w-3 h-3" /> :
                           activeSort === 'desc' ? <ArrowDown className="w-3 h-3" /> :
                           <ArrowUpDown className="w-3 h-3 opacity-40" />}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr
                  key={i}
                  className="border-b border-border/60 last:border-0"
                  aria-hidden="true"
                >
                  {selection && (
                    <td className={cn(DENSITY_CELL[density], 'w-10 pr-0')}>
                      <Skeleton className="h-4 w-4 rounded" />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={col.key} className={DENSITY_CELL[density]}>
                      <Skeleton
                        className={cn('h-4 rounded', col.numeric ? 'ml-auto w-16' : 'w-full max-w-[140px]')}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayData.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-16 text-center">
                  {emptyInner}
                </td>
              </tr>
            ) : (
              displayData.map((row) => {
                const rowKey = getRowKey(row);
                return (
                  <TableRow
                    key={rowKey}
                    row={row}
                    rowKey={rowKey}
                    columns={visibleColumns}
                    density={density}
                    onRowClick={onRowClick}
                    highlighted={isHighlighted?.(row)}
                    selection={selection}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card list (shown below md when renderMobileCard is provided) ─ */}
      {renderMobileCard && (
        <div className="md:hidden">
          {loading ? (
            <div className="p-3 space-y-3" aria-hidden="true">
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : displayData.length === 0 ? (
            <div className="px-4 py-16 text-center">{emptyInner}</div>
          ) : (
            <ul className="p-3 space-y-3">
              {displayData.map((row) => (
                <li key={getRowKey(row)}>{renderMobileCard(row)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Row actions kebab ─────────────────────────────────────────────────────────
/**
 * Drop-in replacement for inline action buttons. Pass DropdownMenuItems as children.
 *
 *   <RowActions ariaLabel={`Actions for ${customer.name}`}>
 *     <DropdownMenuItem onClick={...}>Edit</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem variant="destructive" onClick={...}>Delete</DropdownMenuItem>
 *   </RowActions>
 */
export function RowActions({
  children,
  ariaLabel = 'Row actions',
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-muted-foreground hover:text-foreground"
              aria-label={ariaLabel}
            />
          }
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── View menu (density + column visibility) ───────────────────────────────────
export function DataTableViewMenu<T>({
  columns,
  density,
  onDensityChange,
  columnVisibility,
}: {
  columns:         Column<T>[];
  density:         Density;
  onDensityChange: (d: Density) => void;
  columnVisibility?: ColumnVisibilityState;
}) {
  const toggleColumn = (key: string) => {
    if (!columnVisibility) return;
    const next = new Set(columnVisibility.hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    columnVisibility.onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            <span className="text-xs">View</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {/* Each DropdownMenuLabel (Menu.GroupLabel) must be inside a
            DropdownMenuGroup (Menu.Group) — Base UI throws
            "MenuGroupContext is missing" otherwise. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Density</DropdownMenuLabel>
          {(['compact', 'default', 'comfortable'] as Density[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDensityChange(d)}
              className="w-full flex items-center justify-between gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="capitalize">{d}</span>
              {density === d && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          ))}
        </DropdownMenuGroup>

        {columnVisibility && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {columns
                .filter((c) => c.hideable !== false && c.header.trim() !== '')
                .map((c) => {
                  const hidden = columnVisibility.hidden.has(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleColumn(c.key)}
                      className="w-full flex items-center justify-between gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <span>{c.header}</span>
                      {!hidden && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    </button>
                  );
                })}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Bulk action bar ───────────────────────────────────────────────────────────
/**
 * Floating action bar shown when at least one row is selected.
 * Slides in from the bottom; clears selection via `onClear`.
 *
 *   <DataTableBulkBar count={selected.size} onClear={() => setSelected(new Set())}>
 *     <Button size="sm" variant="outline">Export</Button>
 *     <Button size="sm" variant="destructive">Delete</Button>
 *   </DataTableBulkBar>
 */
export function DataTableBulkBar({
  count,
  onClear,
  children,
  noun = 'item',
}: {
  count:    number;
  onClear:  () => void;
  children: ReactNode;
  /** Singular noun for the count; pluralised automatically. */
  noun?:    string;
}) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="bulk-bar"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y: 16, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-xl border border-border bg-popover/95 px-2 py-1.5 shadow-lg supports-backdrop-filter:backdrop-blur-md">
            <div className="flex items-center gap-2 pl-2 pr-1 text-sm">
              <span className="inline-flex items-center justify-center min-w-6 h-6 rounded-md bg-primary/15 text-primary text-xs font-semibold tabular px-1.5">
                {count}
              </span>
              <span className="text-muted-foreground">
                {noun}{count === 1 ? '' : 's'} selected
              </span>
            </div>

            <span className="h-5 w-px bg-border mx-0.5" aria-hidden="true" />

            <div className="flex items-center gap-1">
              {children}
            </div>

            <span className="h-5 w-px bg-border mx-0.5" aria-hidden="true" />

            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-muted-foreground"
              onClick={onClear}
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
