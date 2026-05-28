'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Package, Pencil, Trash2, Star, AlertTriangle, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useProducts, useDeleteProduct, useProductCategories, PRODUCT_KEYS } from '@/hooks/useProducts';
import { useModalWithData } from '@/hooks/useModal';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/page-header';
import { ProductStatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { FilterSelect, ActiveFilters } from '@/components/ui/filter-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatCurrency, formatNumber } from '@/utils/format';
import { Product, ProductStatus } from '@/types';
import { ProductDialog } from '@/components/products/ProductDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { productService } from '@/services/product.service';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active'   },
  { value: 'inactive', label: 'Inactive' },
  { value: 'draft',    label: 'Draft'    },
] as const;

const SORT_OPTIONS = [
  { value: '-createdAt',  label: 'Newest first'      },
  { value: 'createdAt',   label: 'Oldest first'       },
  { value: '-price',      label: 'Price: high → low'  },
  { value: 'price',       label: 'Price: low → high'  },
  { value: '-totalSales', label: 'Top sellers'         },
  { value: '-stock',      label: 'Most stock'          },
  { value: 'stock',       label: 'Low stock first'     },
] as const;

const BULK_STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'active',   label: 'Set Active'   },
  { value: 'inactive', label: 'Set Inactive' },
  { value: 'draft',    label: 'Set Draft'    },
];

// ── Cell sub-components (defined outside page — stable references) ────────────
function StockCell({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
        <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
        Out of stock
      </span>
    );
  }
  const isLow = stock < 10;
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(
        'text-sm font-medium tabular',
        isLow ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
      )}>
        {formatNumber(stock)}
      </span>
      {isLow && (
        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full leading-none">
          Low
        </span>
      )}
    </div>
  );
}

function PriceCell({ price, comparePrice }: { price: number; comparePrice?: number }) {
  const hasDiscount = comparePrice !== undefined && comparePrice > price;
  return (
    <div>
      <span className="text-sm font-semibold text-foreground tabular">
        {formatCurrency(price)}
      </span>
      {hasDiscount && (
        <span className="text-[10px] text-muted-foreground/55 line-through tabular ml-1.5">
          {formatCurrency(comparePrice!)}
        </span>
      )}
    </div>
  );
}

function ProductNameCell({ product: p }: { product: Product }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
        {p.thumbnail
          ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
          : <Package className="w-4 h-4 text-muted-foreground/40" aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate max-w-[160px]">
            {p.name}
          </span>
          {p.isFeatured && (
            <Star
              className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0"
              aria-label="Featured"
            />
          )}
        </div>
        <span className="text-[11px] text-muted-foreground/60 font-mono">{p.sku}</span>
      </div>
    </div>
  );
}

// ── Bulk action toolbar ───────────────────────────────────────────────────────
interface BulkToolbarProps {
  count:       number;
  onSelectAll: () => void;
  onClear:     () => void;
  onDelete:    () => void;
  onSetStatus: (s: ProductStatus) => void;
  pending:     boolean;
}

function BulkToolbar({
  count, onSelectAll, onClear, onDelete, onSetStatus, pending,
}: BulkToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
      <span className="font-medium text-foreground tabular">
        {count} selected
      </span>

      <button
        type="button"
        onClick={onSelectAll}
        className="text-xs text-primary hover:underline"
      >
        Select page
      </button>

      <div className="flex-1" />

      {/* Status change */}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
        >
          Set status
          <ChevronDown className="w-3 h-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {BULK_STATUS_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => onSetStatus(o.value)}>
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
        disabled={pending}
      >
        Delete {count}
      </Button>

      {/* Clear */}
      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
        aria-label="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const qc = useQueryClient();

  // Filter / pagination state
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(10);
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus]     = useState('');
  const [sort, setSort]         = useState('-createdAt');

  // Single-delete confirm
  const [deleteId, setDeleteId]   = useState('');
  // Bulk-delete confirm
  const [confirmBulk, setConfirmBulk] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const productModal    = useModalWithData<Product>();
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useProducts({
    page, limit, search: debouncedSearch, category, status, sort,
  });
  const { data: categories } = useProductCategories();
  const deleteProduct         = useDeleteProduct();

  // ── Filter handlers ─────────────────────────────────────────────────────────
  const handleSearch   = useCallback((v: string) => { setSearch(v);   setPage(1); }, []);
  const handleCategory = useCallback((v: string) => { setCategory(v); setPage(1); }, []);
  const handleStatus   = useCallback((v: string) => { setStatus(v);   setPage(1); }, []);
  const handleSort     = useCallback((v: string | null) => {
    if (v) { setSort(v); setPage(1); }
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch(''); setCategory(''); setStatus(''); setSort('-createdAt'); setPage(1);
  }, []);

  // ── Selection handlers ──────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Select all items on current page
  const selectAll = useCallback(() => {
    const pageIds = data?.data.map((p) => p._id) ?? [];
    setSelectedIds(new Set(pageIds));
  }, [data?.data]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── Bulk operations ─────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    setBulkPending(true);
    try {
      await Promise.all([...selectedIds].map((id) => productService.delete(id)));
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.categories() });
      toast.success(`Deleted ${selectedIds.size} product${selectedIds.size !== 1 ? 's' : ''}`);
      clearSelection();
    } catch {
      toast.error('Failed to delete some products');
    } finally {
      setBulkPending(false);
      setConfirmBulk(false);
    }
  }, [selectedIds, qc, clearSelection]);

  const handleBulkStatus = useCallback(async (newStatus: ProductStatus) => {
    setBulkPending(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => productService.update(id, { status: newStatus }))
      );
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.lists() });
      toast.success(`Updated ${selectedIds.size} product${selectedIds.size !== 1 ? 's' : ''}`);
      clearSelection();
    } catch {
      toast.error('Failed to update some products');
    } finally {
      setBulkPending(false);
    }
  }, [selectedIds, qc, clearSelection]);

  // ── Derived values (memoized) ────────────────────────────────────────────────
  const pageData = data?.data ?? [];

  const categoryOptions = useMemo(
    () => (categories ?? []).map((c: string) => ({ value: c, label: c })),
    [categories],
  );

  const lowStockCount = useMemo(
    () => pageData.filter((p) => p.stock < 10).length,
    [pageData],
  );

  const activeFilters = useMemo(() => [
    ...(search   ? [{ key: 'search',   label: `"${search}"`, onRemove: () => handleSearch('') }]   : []),
    ...(category ? [{ key: 'category', label: category,       onRemove: () => handleCategory('') }] : []),
    ...(status   ? [{ key: 'status',   label: status,         onRemove: () => handleStatus('') }]   : []),
  ], [search, category, status, handleSearch, handleCategory, handleStatus]);

  // ── Columns (memoized — recreate only when selection or actions change) ──────
  const columns = useMemo(() => [
    // Checkbox
    {
      key: 'select',
      header: '',
      headerClassName: 'w-10',
      className: 'w-10',
      cell: (p: Product) => (
        <Checkbox
          checked={selectedIds.has(p._id)}
          onCheckedChange={() => toggleSelect(p._id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${p.name}`}
        />
      ),
    },
    // Name + SKU
    {
      key: 'product',
      header: 'Product',
      cell: (p: Product) => <ProductNameCell product={p} />,
      sortFn: (a: Product, b: Product) => a.name.localeCompare(b.name),
    },
    // Category
    {
      key: 'category',
      header: 'Category',
      cell: (p: Product) => (
        <span className="text-xs text-muted-foreground">{p.category}</span>
      ),
    },
    // Price
    {
      key: 'price',
      header: 'Price',
      numeric: true,
      cell: (p: Product) => <PriceCell price={p.price} comparePrice={p.comparePrice} />,
      sortFn: (a: Product, b: Product) => a.price - b.price,
    },
    // Stock
    {
      key: 'stock',
      header: 'Stock',
      cell: (p: Product) => <StockCell stock={p.stock} />,
      sortFn: (a: Product, b: Product) => a.stock - b.stock,
    },
    // Revenue (price × sales)
    {
      key: 'revenue',
      header: 'Revenue',
      numeric: true,
      cell: (p: Product) => (
        <span className="text-sm font-medium tabular text-foreground">
          {formatCurrency(p.price * p.totalSales)}
        </span>
      ),
      sortFn: (a: Product, b: Product) => (a.price * a.totalSales) - (b.price * b.totalSales),
    },
    // Sales
    {
      key: 'sales',
      header: 'Sales',
      numeric: true,
      cell: (p: Product) => (
        <span className="text-sm tabular text-muted-foreground">{formatNumber(p.totalSales)}</span>
      ),
      sortFn: (a: Product, b: Product) => a.totalSales - b.totalSales,
    },
    // Status
    {
      key: 'status',
      header: 'Status',
      cell: (p: Product) => <ProductStatusBadge status={p.status} />,
    },
    // Actions
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      cell: (p: Product) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            aria-label={`Edit ${p.name}`}
            onClick={(e) => { e.stopPropagation(); productModal.open(p); }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-destructive hover:text-destructive"
            aria-label={`Delete ${p.name}`}
            onClick={(e) => { e.stopPropagation(); setDeleteId(p._id); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ], [selectedIds, toggleSelect, productModal.open]);

  const totalShown = data?.meta?.total ?? 0;

  return (
    <motion.div
      className="space-y-5"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Products"
          description={
            lowStockCount > 0
              ? `${totalShown} products · ${lowStockCount} low on stock`
              : `${totalShown} total products`
          }
          actions={
            <Button onClick={() => productModal.open()} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          }
        />
      </motion.div>

      {/* Filters */}
      <motion.div className="flex flex-col sm:flex-row gap-2" variants={staggerItem}>
        <SearchBar
          value={search}
          onChange={handleSearch}
          placeholder="Search products…"
          className="flex-1 max-w-sm"
        />
        <FilterSelect
          value={category}
          onValueChange={handleCategory}
          options={categoryOptions}
          placeholder="Category"
          allLabel="All Categories"
          className="w-full sm:w-[155px]"
        />
        <FilterSelect
          value={status}
          onValueChange={handleStatus}
          options={[...STATUS_OPTIONS]}
          placeholder="Status"
          allLabel="All Status"
          className="w-full sm:w-[130px]"
        />
        <Select value={sort} onValueChange={(v) => handleSort(v ?? '')}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <motion.div variants={staggerItem}>
          <ActiveFilters filters={activeFilters} onClearAll={clearAllFilters} />
        </motion.div>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="bulk-bar"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <BulkToolbar
              count={selectedIds.size}
              onSelectAll={selectAll}
              onClear={clearSelection}
              onDelete={() => setConfirmBulk(true)}
              onSetStatus={handleBulkStatus}
              pending={bulkPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div variants={staggerItem}>
        <DataTable
          columns={columns}
          data={pageData}
          loading={isLoading}
          getRowKey={(p) => p._id}
          emptyMessage="No products found"
          emptyIcon={<Package className="w-10 h-10" />}
          skeletonRows={limit}
          isHighlighted={(p) => p.stock === 0}
          caption="Products list"
        />
      </motion.div>

      {data?.meta && data.meta.pages > 0 && (
        <motion.div variants={staggerItem}>
          <Pagination
            page={data.meta.page}
            pages={data.meta.pages}
            total={data.meta.total}
            limit={data.meta.limit}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); clearSelection(); }}
          />
        </motion.div>
      )}

      {/* Dialogs */}
      <ProductDialog
        open={productModal.isOpen}
        onClose={productModal.close}
        product={productModal.data ?? null}
      />

      {/* Single delete */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(''); }}
        onConfirm={() => {
          if (deleteId) { deleteProduct.mutate(deleteId); setDeleteId(''); }
        }}
        title="Delete Product"
        description="This product will be permanently deleted and cannot be recovered."
        confirmLabel="Delete Product"
        isLoading={deleteProduct.isPending}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={(open) => { if (!open) setConfirmBulk(false); }}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} Product${selectedIds.size !== 1 ? 's' : ''}`}
        description={`Permanently delete ${selectedIds.size} product${selectedIds.size !== 1 ? 's' : ''}. This cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Product${selectedIds.size !== 1 ? 's' : ''}`}
        isLoading={bulkPending}
      />
    </motion.div>
  );
}
