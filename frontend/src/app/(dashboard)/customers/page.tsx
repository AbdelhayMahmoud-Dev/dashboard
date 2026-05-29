'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Users, Pencil, Trash2, ShoppingBag, Download, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCustomers, useDeleteCustomer } from '@/hooks/useCustomers';
import { useModalWithData } from '@/hooks/useModal';
import {
  DataTable,
  RowActions,
  DataTableViewMenu,
  DataTableBulkBar,
  type Column,
  type Density,
} from '@/components/ui/data-table';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MobileCard, MobileCardHeader, MobileCardField, MobileCardActions } from '@/components/ui/mobile-card';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/page-header';
import { CustomerStatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { FilterSelect, ActiveFilters } from '@/components/ui/filter-bar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatDate, formatNumber, getInitials } from '@/utils/format';
import { Customer } from '@/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CustomerDialog } from '@/components/customers/CustomerDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active'   },
  { value: 'inactive', label: 'Inactive' },
  { value: 'banned',   label: 'Banned'   },
];

// ── CSV export (client-side, for selected rows) ───────────────────────────────
function downloadCustomersCsv(customers: Customer[]) {
  const rows = [
    ['Name', 'Email', 'Phone', 'Status', 'Orders', 'Lifetime Value', 'Joined'],
    ...customers.map((c) => [
      c.name,
      c.email,
      c.phone || '',
      c.status,
      String(c.totalOrders),
      String(c.totalSpent),
      new Date(c.createdAt).toISOString(),
    ]),
  ];
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CustomersPage() {
  const [page, setPage]     = useState(1);
  const [limit, setLimit]   = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState('');

  // New: table view state
  const [density, setDensity] = useState<Density>('default');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const customerModal   = useModalWithData<Customer>();
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useCustomers({ page, limit, search: debouncedSearch, status });
  const deleteCustomer      = useDeleteCustomer();

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleStatus = useCallback((v: string) => { setStatus(v); setPage(1); }, []);

  const clearAll = useCallback(() => {
    setSearch(''); setStatus(''); setPage(1);
  }, []);

  const activeFilters = [
    ...(search ? [{ key: 'search', label: `"${search}"`, onRemove: () => handleSearch('') }] : []),
    ...(status ? [{ key: 'status', label: status,        onRemove: () => handleStatus('') }] : []),
  ];

  const columns = useMemo<Column<Customer>[]>(() => [
    {
      key: 'customer',
      header: 'Customer',
      hideable: false, // primary identifier — always visible
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={c.avatar} />
            <AvatarFallback className="text-xs font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              {getInitials(c.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate max-w-[160px]">{c.name}</p>
            <p className="text-xs text-muted-foreground/70 truncate max-w-[160px]">{c.email}</p>
          </div>
        </div>
      ),
      sortFn: (a, b) => a.name.localeCompare(b.name),
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (c) => (
        <span className="text-sm text-muted-foreground">{c.phone || '—'}</span>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      numeric: true,
      cell: (c) => (
        <div className="flex items-center gap-1.5 justify-end">
          <ShoppingBag className="w-3 h-3 text-muted-foreground/50 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground tabular">
            {formatNumber(c.totalOrders)}
          </span>
        </div>
      ),
      sortFn: (a, b) => a.totalOrders - b.totalOrders,
    },
    {
      key: 'spent',
      header: 'LTV',
      numeric: true,
      cell: (c) => (
        <span className="text-sm font-semibold text-foreground tabular">
          {formatCurrency(c.totalSpent)}
        </span>
      ),
      sortFn: (a, b) => a.totalSpent - b.totalSpent,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <CustomerStatusBadge status={c.status} />,
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (c) => (
        <span className="text-sm text-muted-foreground/70">{formatDate(c.createdAt)}</span>
      ),
      sortFn: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      key: 'actions',
      header: '',
      hideable: false, // actions column can't be hidden
      cell: (c) => (
        <RowActions ariaLabel={`Actions for ${c.name}`}>
          <DropdownMenuItem onClick={() => customerModal.open(c)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(c._id)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </RowActions>
      ),
    },
  ], [customerModal]);

  // ── Bulk operations ─────────────────────────────────────────────────────────
  const selectedCustomers = useMemo(
    () => (data?.data ?? []).filter((c) => selected.has(c._id)),
    [data, selected],
  );

  const handleBulkExport = useCallback(() => {
    // Note: only exports customers loaded on the current page that are selected.
    // For cross-page export, a dedicated backend endpoint would be required.
    if (selectedCustomers.length === 0) return;
    downloadCustomersCsv(selectedCustomers);
    toast.success(`Exported ${selectedCustomers.length} customer${selectedCustomers.length === 1 ? '' : 's'}`);
  }, [selectedCustomers]);

  const handleBulkDelete = useCallback(async () => {
    // Backend has no bulk-delete endpoint, so we delete serially. The cache
    // invalidates after each delete; that's fine for typical selection sizes.
    if (selected.size === 0) return;
    setIsBulkDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => deleteCustomer.mutateAsync(id)),
    );
    const ok   = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    setIsBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelected(new Set());
    if (fail === 0) {
      toast.success(`Deleted ${ok} customer${ok === 1 ? '' : 's'}`);
    } else {
      toast.error(`Deleted ${ok}, failed ${fail}`);
    }
  }, [selected, deleteCustomer]);

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Customers"
          description={`${data?.meta?.total ?? 0} total customers`}
          actions={
            <Button onClick={() => customerModal.open()} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          }
        />
      </motion.div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <motion.div variants={staggerItem}>
          <ActiveFilters filters={activeFilters} onClearAll={clearAll} />
        </motion.div>
      )}

      {/* Table with toolbar */}
      <motion.div variants={staggerItem}>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          getRowKey={(c) => c._id}
          emptyMessage="No customers found"
          emptyIcon={<Users className="w-12 h-12" />}
          onRowClick={(c) => customerModal.open(c)}
          skeletonRows={limit}
          caption="Customers list"
          density={density}
          selection={{ selected, onChange: setSelected }}
          columnVisibility={{ hidden: hiddenCols, onChange: setHiddenCols }}
          renderMobileCard={(c) => (
            <MobileCard onClick={() => customerModal.open(c)}>
              <MobileCardHeader>
                <div className="flex items-start gap-3 min-w-0">
                  <Checkbox
                    checked={selected.has(c._id)}
                    onCheckedChange={() => {
                      const next = new Set(selected);
                      if (next.has(c._id)) next.delete(c._id);
                      else next.add(c._id);
                      setSelected(next);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${c.name}`}
                    className="mt-0.5 shrink-0"
                  />
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={c.avatar} />
                    <AvatarFallback className="text-xs font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      {getInitials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground/70 truncate">{c.email}</p>
                  </div>
                </div>
                <CustomerStatusBadge status={c.status} />
              </MobileCardHeader>
              <MobileCardField label="Orders">{formatNumber(c.totalOrders)}</MobileCardField>
              <MobileCardField label="Spent">
                <span className="font-semibold tabular">{formatCurrency(c.totalSpent)}</span>
              </MobileCardField>
              <MobileCardField label="Joined">
                <span className="text-muted-foreground/70">{formatDate(c.createdAt)}</span>
              </MobileCardField>
              <MobileCardActions>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={(e) => { e.stopPropagation(); customerModal.open(c); }}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(c._id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </MobileCardActions>
            </MobileCard>
          )}
          toolbar={
            <>
              <SearchBar
                value={search}
                onChange={handleSearch}
                placeholder="Search customers…"
                className="flex-1 max-w-sm"
              />
              <FilterSelect
                value={status}
                onValueChange={handleStatus}
                options={STATUS_OPTIONS}
                placeholder="Status"
                allLabel="All Status"
                className="w-[140px]"
              />
              <div className="ml-auto">
                <DataTableViewMenu
                  columns={columns}
                  density={density}
                  onDensityChange={setDensity}
                  columnVisibility={{ hidden: hiddenCols, onChange: setHiddenCols }}
                />
              </div>
            </>
          }
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
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </motion.div>
      )}

      {/* Floating bulk action bar */}
      <DataTableBulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        noun="customer"
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5"
          onClick={handleBulkExport}
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setBulkDeleteOpen(true)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </Button>
      </DataTableBulkBar>

      {/* Dialogs */}
      <CustomerDialog
        open={customerModal.isOpen}
        onClose={customerModal.close}
        customer={customerModal.data ?? null}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(''); }}
        onConfirm={() => { if (deleteId) { deleteCustomer.mutate(deleteId); setDeleteId(''); } }}
        title="Delete Customer"
        description="This will permanently delete the customer and all associated data. This action cannot be undone."
        confirmLabel="Delete Customer"
        isLoading={deleteCustomer.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => { if (!open) setBulkDeleteOpen(false); }}
        onConfirm={handleBulkDelete}
        title={`Delete ${selected.size} customer${selected.size === 1 ? '' : 's'}?`}
        description={
          <span>
            This will permanently delete <strong>{selected.size}</strong> customer
            {selected.size === 1 ? '' : 's'} and all associated data.{' '}
            <strong>This action cannot be undone.</strong>
            {isBulkDeleting && (
              <span className="block mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting…
              </span>
            )}
          </span>
        }
        confirmLabel={isBulkDeleting ? 'Deleting…' : 'Delete'}
        variant="destructive"
        isLoading={isBulkDeleting}
      />
    </motion.div>
  );
}
