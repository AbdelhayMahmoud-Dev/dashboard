'use client';

import { useEffect } from 'react';
import {
  LucideIcon,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  title: string;
  /**
   * Formatted display value — shown immediately and used as the final value
   * after the count-up animation completes.
   */
  value: string | number;
  /**
   * Raw numeric value used to drive the count-up spring animation.
   * If omitted, no animation plays and `value` is shown as-is.
   */
  numericValue?: number;
  /**
   * Called during the animation to format each intermediate numeric value.
   * Must return the same kind of string as `value`.
   */
  formatter?: (n: number) => string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  /** One of the `.icon-*` token classes from the design system */
  iconVariant?: 'blue' | 'violet' | 'emerald' | 'orange' | 'rose' | 'cyan' | 'amber' | 'indigo';
  loading?: boolean;
  /** Optional sparkline data — array of numbers rendered as a mini area chart */
  sparkline?: number[];
  /** Sparkline stroke colour (CSS colour or Tailwind resolved value) */
  sparklineColor?: string;
  className?: string;
}

const ICON_VARIANT_MAP: Record<NonNullable<StatCardProps['iconVariant']>, string> = {
  blue:    'icon-blue',
  violet:  'icon-violet',
  emerald: 'icon-emerald',
  orange:  'icon-orange',
  rose:    'icon-rose',
  cyan:    'icon-cyan',
  amber:   'icon-amber',
  indigo:  'icon-indigo',
};

const SPARKLINE_COLORS: Record<NonNullable<StatCardProps['iconVariant']>, string> = {
  blue:    '#3b82f6',
  violet:  '#8b5cf6',
  emerald: '#10b981',
  orange:  '#f97316',
  rose:    '#f43f5e',
  cyan:    '#06b6d4',
  amber:   '#f59e0b',
  indigo:  '#6366f1',
};

// Animated numeric value driven by framer-motion spring
function AnimatedValue({
  target,
  formatter,
  fallback,
}: {
  target: number;
  formatter?: (n: number) => string;
  fallback: string | number;
}) {
  const spring = useSpring(0, { stiffness: 55, damping: 20, restDelta: 0.5 });
  const displayed = useTransform(spring, (v) =>
    formatter ? formatter(Math.round(v)) : String(Math.round(v))
  );

  useEffect(() => {
    spring.set(target);
  }, [target, spring]);

  // If no formatter, just show the fallback string
  if (!formatter) return <>{fallback}</>;

  return <motion.span>{displayed}</motion.span>;
}

function Sparkline({
  data,
  color = '#3b82f6',
}: {
  data: number[];
  color?: string;
}) {
  const chartData = data.map((v, i) => ({ i, v }));
  const gradientId = `sg-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div className="absolute bottom-0 right-0 w-[120px] h-[52px] opacity-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={true}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatCard({
  title,
  value,
  numericValue,
  formatter,
  change,
  changeLabel,
  icon: Icon,
  iconVariant = 'blue',
  loading = false,
  sparkline,
  sparklineColor,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div className={cn('stat-card', className)}>
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <Skeleton className="w-24 h-8 mb-1" />
        <Skeleton className="w-28 h-3.5 mt-2" />
        <Skeleton className="w-20 h-3 mt-1.5" />
      </div>
    );
  }

  const isPositive = change !== undefined ? change > 0 : null;
  const isNeutral  = change !== undefined ? change === 0 : null;
  const resolvedSparklineColor = sparklineColor ?? SPARKLINE_COLORS[iconVariant];

  return (
    <div className={cn('stat-card relative', className)}>
      {/* Optional sparkline watermark */}
      {sparkline && sparkline.length > 1 && (
        <Sparkline data={sparkline} color={resolvedSparklineColor} />
      )}

      {/* Header row */}
      <div className="relative flex items-start justify-between mb-4">
        <div className={cn('icon-container icon-container-md', ICON_VARIANT_MAP[iconVariant])}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>

        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tracking-tight',
              isNeutral
                ? 'bg-muted text-muted-foreground'
                : isPositive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'
            )}
          >
            {isNeutral ? (
              <Minus className="w-3 h-3" aria-hidden="true" />
            ) : isPositive ? (
              <TrendingUp className="w-3 h-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="w-3 h-3" aria-hidden="true" />
            )}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative">
        <p className="text-[1.65rem] font-bold text-foreground tabular leading-none tracking-tight">
          {numericValue !== undefined ? (
            <AnimatedValue
              target={numericValue}
              formatter={formatter}
              fallback={value}
            />
          ) : (
            value
          )}
        </p>

        <p className="text-sm font-medium text-muted-foreground mt-2">{title}</p>

        {changeLabel && change !== undefined && (
          <p className="text-xs text-muted-foreground/60 mt-0.5">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
