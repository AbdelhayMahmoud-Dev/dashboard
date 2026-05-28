'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from '@/components/ui/chart-container';

interface StatusData {
  _id: string;
  count: number;
}

const COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
  refunded: '#6b7280',
};

export function OrdersDonut({ data, loading }: { data: StatusData[]; loading?: boolean }) {
  const chartData = data.map((d) => ({
    name: d._id.charAt(0).toUpperCase() + d._id.slice(1),
    value: d.count,
    color: COLORS[d._id] || '#6b7280',
  }));

  return (
    <ChartContainer loading={loading} empty={!loading && data.length === 0} height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            isAnimationActive={true}
            animationDuration={700}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
