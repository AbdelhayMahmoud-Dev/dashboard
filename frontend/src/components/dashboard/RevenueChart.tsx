'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/utils/format';
import { ChartContainer } from '@/components/ui/chart-container';

interface DataPoint {
  _id:     string;
  revenue: number;
  orders:  number;
}

interface RevenueChartProps {
  data:     DataPoint[];
  loading?: boolean;
}

// Format "2025-05-28" → "May 28"
function formatDateTick(value: string): string {
  try {
    return new Date(value + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
    });
  } catch {
    return value;
  }
}

// Show only every Nth tick to avoid crowding (recharts does this via interval
// but we use a custom formatter so we can return '' for hidden labels)
function sparseTickFormatter(value: string, index: number, total: number): string {
  const every = total <= 10 ? 1 : total <= 20 ? 3 : 5;
  return index % every === 0 ? formatDateTick(value) : '';
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const revenue = payload[0]?.value ?? 0;
  const orders  = payload[1]?.value ?? 0;

  return (
    <div className="bg-popover rounded-xl border border-border shadow-md px-3.5 py-3 text-sm min-w-[140px]">
      <p className="text-xs font-semibold text-muted-foreground mb-2">
        {label ? formatDateTick(label) : ''}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="text-xs text-muted-foreground">Revenue</span>
          </div>
          <span className="text-xs font-bold tabular text-foreground">
            {formatCurrency(revenue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
            <span className="text-xs text-muted-foreground">Orders</span>
          </div>
          <span className="text-xs font-bold tabular text-foreground">
            {orders}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Chart component ────────────────────────────────────────────────────────────
export function RevenueChart({ data, loading = false }: RevenueChartProps) {
  const chartData = data.map((d) => ({
    date:    d._id,
    revenue: d.revenue,
    orders:  d.orders,
  }));

  const total = chartData.length;

  return (
    <ChartContainer loading={loading} empty={!loading && data.length === 0} height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-border"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tickFormatter={(v, i) => sparseTickFormatter(v, i, total)}
            tick={{ fontSize: 10, fill: 'currentColor' }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            dy={4}
          />

          <YAxis
            yAxisId="revenue"
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            tick={{ fontSize: 10, fill: 'currentColor' }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            width={48}
          />

          <YAxis
            yAxisId="orders"
            orientation="right"
            tickFormatter={(v) => String(v)}
            tick={{ fontSize: 10, fill: 'currentColor' }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            width={30}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'currentColor', strokeWidth: 1, className: 'text-border' }}
          />

          {/* Revenue area */}
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#revenueGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive
            animationDuration={900}
          />

          {/* Orders area (secondary) */}
          <Area
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="url(#ordersGrad)"
            dot={false}
            activeDot={{ r: 3, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive
            animationDuration={900}
            animationBegin={200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
