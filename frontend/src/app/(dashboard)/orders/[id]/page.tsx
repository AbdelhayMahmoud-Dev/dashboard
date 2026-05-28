'use client';

import { use, useState } from 'react';
import {
  ArrowLeft, Package, Copy, Check, CreditCard,
  MapPin, User, Clock, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/status-badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate, formatRelativeTime, getInitials } from '@/utils/format';
import { Customer, OrderStatus } from '@/types';
import { ORDER_STATUS_CONFIG } from '@/constants';
import { cn } from '@/lib/utils';

// ── Loading skeleton ──────────────────────────────────────────────────────────
function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Copy order number"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
type TimelineEntry = { status: OrderStatus; timestamp: string; note?: string };

const STATUS_ORDER: OrderStatus[] = [
  'pending', 'processing', 'shipped', 'delivered',
];

function TimelineDot({ status }: { status: OrderStatus }) {
  const cfg = ORDER_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background',
        cfg.dot,
      )}
      aria-hidden="true"
    />
  );
}

function OrderTimeline({ history }: { history: TimelineEntry[] }) {
  // Show most recent first
  const entries = [...history].reverse();

  return (
    <div className="relative">
      {/* Connecting vertical line */}
      {entries.length > 1 && (
        <div className="absolute left-[4.5px] top-3 bottom-3 w-px bg-border" aria-hidden="true" />
      )}
      <div className="space-y-4">
        {entries.map((h, i) => (
          <div key={i} className="flex items-start gap-3 relative">
            <TimelineDot status={h.status} />
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground capitalize">
                  {ORDER_STATUS_CONFIG[h.status]?.label ?? h.status}
                </span>
                <span
                  className="text-[11px] text-muted-foreground/70"
                  title={formatDate(h.timestamp, { hour: '2-digit', minute: '2-digit' })}
                >
                  {formatRelativeTime(h.timestamp)}
                </span>
              </div>
              {h.note && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{h.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading } = useOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const [statusNote, setStatusNote] = useState('');

  if (isLoading) return <OrderDetailSkeleton />;
  if (!order)    return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
        <Package className="w-6 h-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Order not found</p>
      <Link href="/orders">
        <Button variant="outline" size="sm">Back to orders</Button>
      </Link>
    </div>
  );

  const customer = order.customer as Customer;

  const handleStatusChange = (val: string | null) => {
    if (val) {
      updateStatus.mutate({ id: order._id, status: val as OrderStatus });
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <Link
          href="/orders"
          className="mt-0.5 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Back to orders"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-foreground font-mono tracking-tight">
              {order.orderNumber}
            </h1>
            <CopyButton text={order.orderNumber} />
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Placed {formatDate(order.createdAt, { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {formatRelativeTime(order.createdAt)}
          </p>
        </div>

        {/* Status update */}
        <div className="shrink-0 hidden sm:block">
          <Select
            value={order.status}
            onValueChange={handleStatusChange}
            disabled={updateStatus.isPending}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
              <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-50" />
            </SelectTrigger>
            <SelectContent>
              {(['pending','processing','shipped','delivered','cancelled','refunded'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Content grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — items + timeline */}
        <div className="lg:col-span-2 space-y-4">

          {/* Order items */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-0 px-5 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Order Items
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-3">
              <div className="divide-y divide-border/60">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-muted-foreground/50" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} &times; {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground tabular shrink-0">
                      {formatCurrency(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="px-5 py-4 bg-muted/20 border-t border-border/60 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax</span>
                    <span className="tabular">{formatCurrency(order.tax)}</span>
                  </div>
                )}
                {order.shipping > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Shipping</span>
                    <span className="tabular">{formatCurrency(order.shipping)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="tabular">−{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-foreground">
                  <span>Total</span>
                  <span className="text-base tabular">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3 px-5 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {order.statusHistory.length > 0 ? (
                <OrderTimeline history={order.statusHistory} />
              ) : (
                <p className="text-sm text-muted-foreground">No timeline entries yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader className="pb-3 px-5 pt-4">
                <CardTitle className="text-sm font-semibold">Notes</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-sm text-muted-foreground leading-relaxed">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Customer */}
          <Card>
            <CardHeader className="pb-3 px-5 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={customer.avatar} />
                  <AvatarFallback className="text-xs font-bold bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400">
                    {getInitials(customer.name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{customer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                </div>
              </div>
              {customer._id && (
                <Link href={`/customers/${customer._id}`}>
                  <Button variant="outline" size="sm" className="w-full text-xs h-7">
                    View customer profile
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3 px-5 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium capitalize text-foreground">{order.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold tabular text-foreground">{formatCurrency(order.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Shipping address */}
          <Card>
            <CardHeader className="pb-3 px-5 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Ship To
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <address className="not-italic text-sm text-muted-foreground space-y-0.5 leading-relaxed">
                <p className="font-semibold text-foreground">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.address}</p>
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.zipCode}
                </p>
                <p>{order.shippingAddress.country}</p>
                {order.shippingAddress.phone && (
                  <p className="pt-1">{order.shippingAddress.phone}</p>
                )}
              </address>
            </CardContent>
          </Card>

          {/* Mobile status update */}
          <div className="sm:hidden">
            <Card>
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <Select
                  value={order.status}
                  onValueChange={handleStatusChange}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['pending','processing','shipped','delivered','cancelled','refunded'] as const).map((s) => (
                      <SelectItem key={s} value={s}>
                        {ORDER_STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
