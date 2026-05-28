'use client';

import { useMemo } from 'react';
import { useIsClient } from '@/hooks/useIsClient';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Zap,
  Star,
  Clock,
  CheckCircle2,
  Truck,
  CircleDot,
  XCircle,
  Plus,
  BarChart3,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useDashboardStats } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/ui/stat-card';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { OrdersDonut } from '@/components/dashboard/OrdersDonut';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  formatCurrency,
  formatRelativeTime,
  formatNumber,
  getInitials,
} from '@/utils/format';
import { Order, Customer, OrderStatus, DashboardStats } from '@/types';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ── Time helpers ──────────────────────────────────────────────────────────────
// These are called only when `useIsClient()` returns true, guaranteeing
// server and first-client render agree before any time-dependent text appears.
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    year:    'numeric',
  });
}

// ── Order status display config ───────────────────────────────────────────────
const STATUS_CFG: Record<OrderStatus, { icon: React.ElementType; textCls: string; bgCls: string }> = {
  pending:    { icon: Clock,        textCls: 'text-amber-600 dark:text-amber-400',    bgCls: 'bg-amber-50 dark:bg-amber-500/10'    },
  processing: { icon: CircleDot,    textCls: 'text-blue-600 dark:text-blue-400',      bgCls: 'bg-blue-50 dark:bg-blue-500/10'      },
  shipped:    { icon: Truck,        textCls: 'text-violet-600 dark:text-violet-400',  bgCls: 'bg-violet-50 dark:bg-violet-500/10'  },
  delivered:  { icon: CheckCircle2, textCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' },
  cancelled:  { icon: XCircle,      textCls: 'text-rose-600 dark:text-rose-400',      bgCls: 'bg-rose-50 dark:bg-rose-500/10'      },
  refunded:   { icon: RefreshCw,    textCls: 'text-slate-500',                        bgCls: 'bg-slate-100 dark:bg-slate-500/10'   },
};

// ── Insights logic (derived from real data) ───────────────────────────────────
interface Insight { icon: React.ElementType; text: string; positive: boolean }

function buildInsights(overview?: DashboardStats['overview']): Insight[] {
  if (!overview) return [];
  const items: Insight[] = [];

  if (overview.revenueGrowth > 10) {
    items.push({ icon: TrendingUp, positive: true, text: `Revenue is up ${overview.revenueGrowth.toFixed(1)}% vs last month — strong growth trajectory.` });
  } else if (overview.revenueGrowth < -5) {
    items.push({ icon: AlertCircle, positive: false, text: `Revenue declined ${Math.abs(overview.revenueGrowth).toFixed(1)}% vs last month — consider a promotional campaign.` });
  }

  if (overview.monthCustomers > 5) {
    items.push({ icon: Users, positive: true, text: `${overview.monthCustomers} new customers this month — consider a welcome email series.` });
  }

  if (overview.monthOrders > 20) {
    items.push({ icon: Zap, positive: true, text: `${formatNumber(overview.monthOrders)} orders placed this month — on track for a strong month.` });
  }

  if (items.length === 0) {
    items.push({ icon: Star, positive: true, text: 'All systems operational. Dashboard data refreshes every 2 minutes.' });
  }

  return items.slice(0, 2);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RecentOrdersContent({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
        <ShoppingCart className="w-8 h-8 mb-3 opacity-30" aria-hidden="true" />
        <p className="text-sm">No orders yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {orders.map((order, i) => {
        const customer   = order.customer as Customer;
        const cfg        = STATUS_CFG[order.status] ?? STATUS_CFG.pending;
        const StatusIcon = cfg.icon;

        return (
          <motion.div
            key={order._id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
          >
            <Link
              href={`/orders/${order._id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/25 transition-colors group"
            >
              {/* Avatar with live-dot on first (most recent) */}
              <div className="relative shrink-0">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={customer.avatar} />
                  <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-foreground">
                    {getInitials(customer.name || 'U')}
                  </AvatarFallback>
                </Avatar>
                {i === 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
                )}
              </div>

              {/* Customer + order meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {customer.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {order.orderNumber} · {formatRelativeTime(order.createdAt)}
                </p>
              </div>

              {/* Amount + status */}
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular leading-tight">
                  {formatCurrency(order.total)}
                </p>
                <div className={cn(
                  'inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                  cfg.bgCls, cfg.textCls,
                )}>
                  <StatusIcon className="w-2.5 h-2.5" aria-hidden="true" />
                  <span className="capitalize">{order.status}</span>
                </div>
              </div>

              <ArrowRight className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 shrink-0" />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function TopProductsContent({
  products,
}: {
  products: DashboardStats['topProducts'];
}) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
        <Package className="w-8 h-8 mb-3 opacity-30" aria-hidden="true" />
        <p className="text-sm">No products yet</p>
      </div>
    );
  }

  const maxSales  = Math.max(...products.map((p) => p.totalSales ?? 0), 1);
  const rankCols  = ['text-amber-500', 'text-slate-400', 'text-orange-600', 'text-muted-foreground', 'text-muted-foreground'];

  return (
    <div className="divide-y divide-border/60">
      {products.map((product, i) => {
        const pct = Math.round(((product.totalSales ?? 0) / maxSales) * 100);

        return (
          <motion.div
            key={product._id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
          >
            <Link
              href="/products"
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/25 transition-colors group"
            >
              {/* Thumbnail / rank badge */}
              <div className="relative w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className={cn('text-sm font-bold', rankCols[i] ?? 'text-muted-foreground')}>
                    #{i + 1}
                  </span>
                )}
              </div>

              {/* Name + progress bar */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {product.name}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary/60"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.1 + 0.3, duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular shrink-0 w-14 text-right">
                    {formatNumber(product.totalSales ?? 0)} sold
                  </span>
                </div>
              </div>

              {/* Price */}
              <p className="text-sm font-semibold tabular shrink-0">
                {formatCurrency(product.price)}
              </p>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: stats, isLoading, isError, error } = useDashboardStats();
  const { user }    = useAuth();
  const overview    = stats?.overview;
  const firstName   = user?.name?.split(' ')[0] ?? 'there';
  const insights    = useMemo(() => buildInsights(overview), [overview]);
  const isClient    = useIsClient();
  const greeting    = isClient ? getGreeting()   : 'Welcome back';
  const todayLabel  = isClient ? getTodayLabel() : '';

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* ── Greeting + quick actions ─────────────────────────────────────── */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-[1.6rem] font-bold tracking-tight leading-tight">
            <span className="text-muted-foreground font-normal text-xl">{greeting}, </span>
            <span className="gradient-text">{firstName}</span>
            <span> 👋</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todayLabel ? <>{todayLabel} · </> : null}Your store is running smoothly
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/orders">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Plus className="w-3 h-3" /> New Order
            </Button>
          </Link>
          <Link href="/products">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Package className="w-3 h-3" /> Add Product
            </Button>
          </Link>
          <Link href="/customers">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Users className="w-3 h-3" /> Add Customer
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {isError && (
        <motion.div variants={staggerItem}>
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>
              {(error as { response?: { status?: number } })?.response?.status === 403
                ? "You don't have permission to view analytics data."
                : 'Failed to load dashboard data. Please refresh the page.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── KPI stat cards ────────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        variants={staggerItem}
      >
        <StatCard
          title="Total Revenue"
          value={isLoading ? '—' : formatCurrency(overview?.totalRevenue ?? 0)}
          numericValue={!isLoading ? (overview?.totalRevenue ?? undefined) : undefined}
          formatter={(n) => formatCurrency(n)}
          change={overview?.revenueGrowth}
          changeLabel={
            !isLoading && overview
              ? `${formatCurrency(overview.monthRevenue)} this month`
              : undefined
          }
          icon={DollarSign}
          iconVariant="blue"
          sparkline={stats?.sparklines?.revenue}
          loading={isLoading}
        />
        <StatCard
          title="Total Orders"
          value={isLoading ? '—' : formatNumber(overview?.totalOrders ?? 0)}
          numericValue={!isLoading ? (overview?.totalOrders ?? undefined) : undefined}
          formatter={formatNumber}
          changeLabel={
            !isLoading && overview
              ? `+${formatNumber(overview.monthOrders)} this month`
              : undefined
          }
          icon={ShoppingCart}
          iconVariant="violet"
          sparkline={stats?.sparklines?.orders}
          loading={isLoading}
        />
        <StatCard
          title="Total Customers"
          value={isLoading ? '—' : formatNumber(overview?.totalCustomers ?? 0)}
          numericValue={!isLoading ? (overview?.totalCustomers ?? undefined) : undefined}
          formatter={formatNumber}
          changeLabel={
            !isLoading && overview
              ? `+${formatNumber(overview.monthCustomers)} new this month`
              : undefined
          }
          icon={Users}
          iconVariant="emerald"
          sparkline={stats?.sparklines?.customers}
          loading={isLoading}
        />
        <StatCard
          title="Active Products"
          value={isLoading ? '—' : formatNumber(overview?.totalProducts ?? 0)}
          numericValue={!isLoading ? (overview?.totalProducts ?? undefined) : undefined}
          formatter={formatNumber}
          icon={Package}
          iconVariant="orange"
          loading={isLoading}
        />
      </motion.div>

      {/* ── AI Insights bar ──────────────────────────────────────────────── */}
      {!isLoading && insights.length > 0 && (
        <motion.div variants={staggerItem}>
          <div className="flex items-stretch gap-0 rounded-xl border border-border bg-card overflow-hidden">
            {/* Label */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-r border-border shrink-0">
              <div className="w-6 h-6 rounded-md gradient-brand flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" aria-hidden="true" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap hidden sm:block">
                Insights
              </span>
            </div>
            {/* Insight chips */}
            <div className="flex items-center gap-5 px-4 py-2.5 overflow-x-auto scrollbar-thin flex-1 min-w-0">
              {insights.map((insight, i) => {
                const Icon = insight.icon;
                return (
                  <div key={i} className="flex items-center gap-1.5 shrink-0 min-w-0">
                    <Icon
                      className={cn('w-3.5 h-3.5 shrink-0', insight.positive ? 'text-emerald-500' : 'text-amber-500')}
                      aria-hidden="true"
                    />
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{insight.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <motion.div className="grid grid-cols-1 xl:grid-cols-5 gap-4" variants={staggerItem}>
        {/* Revenue chart — 3/5 width */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold">Revenue Overview</CardTitle>
                <CardDescription className="text-xs mt-0.5">Daily revenue · last 30 days</CardDescription>
              </div>
              {overview && !isLoading && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">This month</p>
                  <p className="text-base font-bold tabular">{formatCurrency(overview.monthRevenue)}</p>
                  {overview.revenueGrowth !== 0 && (
                    <p className={cn('text-[10px] font-medium', overview.revenueGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                      {overview.revenueGrowth >= 0 ? '+' : ''}{overview.revenueGrowth.toFixed(1)}% vs last month
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <RevenueChart data={stats?.revenueByDay ?? []} loading={isLoading} />
          </CardContent>
        </Card>

        {/* Orders donut — 2/5 width */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold">Order Status</CardTitle>
                <CardDescription className="text-xs mt-0.5">Distribution across all orders</CardDescription>
              </div>
              {overview && !isLoading && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="text-base font-bold tabular">{formatNumber(overview.totalOrders)}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <OrdersDonut data={stats?.ordersByStatus ?? []} loading={isLoading} />
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Recent Orders + Top Products ──────────────────────────────────── */}
      <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-4" variants={staggerItem}>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Orders</CardTitle>
                <CardDescription className="text-xs mt-0.5">Latest activity from your store</CardDescription>
              </div>
              <Link
                href="/orders"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="space-y-1.5 items-end flex flex-col">
                      <Skeleton className="h-3.5 w-16" />
                      <Skeleton className="h-4 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <RecentOrdersContent orders={stats?.recentOrders ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
                <CardDescription className="text-xs mt-0.5">Best sellers by units sold</CardDescription>
              </div>
              <Link
                href="/products"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-14 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <TopProductsContent products={stats?.topProducts ?? []} />
            )}
          </CardContent>
        </Card>

      </motion.div>
    </motion.div>
  );
}
