'use client';

import { useState, useCallback } from 'react';
import { ShoppingCart, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useOrders } from '@/hooks/useOrders';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/page-header';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { FilterSelect, ActiveFilters } from '@/components/ui/filter-bar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, formatDate, formatRelativeTime, getInitials } from '@/utils/format';
import { Order, Customer } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { staggerContainer, staggerItem } from '@/lib/animations';

const ORDER_STATUS_OPTIONS = [
  { value: 'pending',    label: 'Pending'    },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped',    label: 'Shipped'    },
  { value: 'delivered',  label: 'Delivered'  },
  { value: 'cancelled',  label: 'Cancelled'  },
  { value: 'refunded',   label: 'Refunded'   },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'paid',     label: 'Paid'     },
  { value: 'failed',   label: 'Failed'   },
  { value: 'refunded', label: 'Refunded' },
];

export default function OrdersPage() {
  const router = useRouter();
  const [page, setPage]             = useState(1);
  const [limit, setLimit]           = useState(10);
  const [search, setSearch]         = useState('');
  const [status, setStatus]         = useState('');
  const [paymentStatus, setPayment] = useState('');

  const debouncedSearch = useDebounce(search, 400);
  const { data, isLoading } = useOrders({
    page, limit, search: debouncedSearch, status, paymentStatus,
  });

  const handleSearch  = useCallback((v: string) => { setSearch(v);  setPage(1); }, []);
  const handleStatus  = useCallback((v: string) => { setStatus(v);  setPage(1); }, []);
  const handlePayment = useCallback((v: string) => { setPayment(v); setPage(1); }, []);
  const clearAll      = useCallback(() => {
    setSearch(''); setStatus(''); setPayment(''); setPage(1);
  }, []);

  const activeFilters = [
    ...(search        ? [{ key: 'search',  label: `"${search}"`,             onRemove: () => handleSearch('') }] : []),
    ...(status        ? [{ key: 'status',  label: status,                    onRemove: () => handleStatus('') }] : []),
    ...(paymentStatus ? [{ key: 'payment', label: `Payment: ${paymentStatus}`, onRemove: () => handlePayment('') }] : []),
  ];

  const columns = [
    {
      key: 'order',
      header: 'Order',
      cell: (o: Order) => (
        <div>
          <p className="text-sm font-semibold text-foreground font-mono tracking-tight">
            {o.orderNumber}
          </p>
          <p
            className="text-[11px] text-muted-foreground/70"
            title={formatDate(o.createdAt, { hour: '2-digit', minute: '2-digit' })}
          >
            {formatRelativeTime(o.createdAt)}
          </p>
        </div>
      ),
      sortFn: (a: Order, b: Order) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (o: Order) => {
        const c = o.customer as Customer;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarImage src={c.avatar} />
              <AvatarFallback className="text-[10px] font-bold bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400">
                {getInitials(c.name || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate max-w-[140px]">{c.name}</p>
              <p className="text-[11px] text-muted-foreground/70 truncate max-w-[140px]">{c.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'items',
      header: 'Items',
      numeric: true,
      cell: (o: Order) => (
        <span className="text-sm font-medium text-foreground tabular">
          {o.items.length}
        </span>
      ),
      sortFn: (a: Order, b: Order) => a.items.length - b.items.length,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      cell: (o: Order) => (
        <span className="text-sm font-bold text-foreground tabular">
          {formatCurrency(o.total)}
        </span>
      ),
      sortFn: (a: Order, b: Order) => a.total - b.total,
    },
    {
      key: 'payment',
      header: 'Payment',
      cell: (o: Order) => (
        <div className="space-y-0.5">
          <PaymentStatusBadge status={o.paymentStatus} />
          <p className="text-[10px] text-muted-foreground/60 capitalize">{o.paymentMethod}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (o: Order) => <OrderStatusBadge status={o.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (o: Order) => (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          aria-label={`View order ${o.orderNumber}`}
          onClick={(e) => { e.stopPropagation(); router.push(`/orders/${o._id}`); }}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Orders"
          description={`${data?.meta?.total ?? 0} total orders`}
        />
      </motion.div>

      <motion.div className="flex flex-col sm:flex-row gap-3" variants={staggerItem}>
        <SearchBar
          value={search}
          onChange={handleSearch}
          placeholder="Search by order number…"
          className="flex-1 max-w-sm"
        />
        <FilterSelect
          value={status}
          onValueChange={handleStatus}
          options={ORDER_STATUS_OPTIONS}
          placeholder="Status"
          allLabel="All Status"
          className="w-full sm:w-[150px]"
        />
        <FilterSelect
          value={paymentStatus}
          onValueChange={handlePayment}
          options={PAYMENT_STATUS_OPTIONS}
          placeholder="Payment"
          allLabel="All Payment"
          className="w-full sm:w-[150px]"
        />
      </motion.div>

      {activeFilters.length > 0 && (
        <motion.div variants={staggerItem}>
          <ActiveFilters filters={activeFilters} onClearAll={clearAll} />
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          getRowKey={(o) => o._id}
          emptyMessage="No orders found"
          emptyIcon={<ShoppingCart className="w-12 h-12" />}
          onRowClick={(o) => router.push(`/orders/${o._id}`)}
          skeletonRows={limit}
          caption="Orders list"
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
    </motion.div>
  );
}
