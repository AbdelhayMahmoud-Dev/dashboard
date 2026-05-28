'use client';

import { motion } from 'framer-motion';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?:        LucideIcon;
  title:        string;
  description?: string;
  action?: {
    label:   string;
    onClick: () => void;
    icon?:   LucideIcon;
  };
  secondaryAction?: {
    label:   string;
    onClick: () => void;
  };
  className?: string;
  /** Compact mode — less padding, smaller icon */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const FallbackIcon = Icon ?? Inbox;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-10 px-4' : 'py-16 px-6',
        className,
      )}
    >
      {/* Icon container */}
      <div
        className={cn(
          'rounded-2xl bg-muted flex items-center justify-center mb-4',
          compact ? 'w-12 h-12' : 'w-16 h-16',
        )}
        aria-hidden="true"
      >
        <FallbackIcon
          className={cn(
            'text-muted-foreground/50',
            compact ? 'w-5 h-5' : 'w-7 h-7',
          )}
        />
      </div>

      {/* Text */}
      <h3 className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
        {title}
      </h3>
      {description && (
        <p className={cn('text-muted-foreground mt-1 max-w-sm', compact ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-5">
          {action && (
            <Button
              onClick={action.onClick}
              size="sm"
              className="gap-1.5"
            >
              {action.icon && <action.icon className="w-3.5 h-3.5" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size="sm"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
