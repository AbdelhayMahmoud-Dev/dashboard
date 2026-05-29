'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/hooks/useUsers';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard, MobileCardHeader, MobileCardField } from '@/components/ui/mobile-card';
import { Pagination } from '@/components/ui/pagination';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, getInitials } from '@/utils/format';
import { AuditLog } from '@/types';
import { Activity } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  UPDATE: 'bg-blue-50    text-blue-700    dark:bg-blue-500/10    dark:text-blue-400',
  DELETE: 'bg-rose-50    text-rose-700    dark:bg-rose-500/10    dark:text-rose-400',
};

export function AuditLogTable() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const { data, isLoading } = useAuditLogs({ page, limit });

  const columns = [
    {
      key: 'user',
      header: 'User',
      cell: (log: AuditLog) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="w-7 h-7">
            <AvatarImage src={log.user.avatar} />
            <AvatarFallback className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
              {getInitials(log.user.name || 'U')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{log.user.name}</p>
            <p className="text-xs text-muted-foreground">{log.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (log: AuditLog) => {
        const actionType = log.action.split(':')[0]?.toUpperCase();
        return (
          <Badge className={ACTION_COLORS[actionType] || 'bg-gray-100 text-gray-700'}>
            {log.action}
          </Badge>
        );
      },
    },
    {
      key: 'resource',
      header: 'Resource',
      cell: (log: AuditLog) => (
        <span className="text-sm text-muted-foreground capitalize">{log.resource}</span>
      ),
    },
    {
      key: 'ip',
      header: 'IP Address',
      cell: (log: AuditLog) => (
        <span className="text-xs text-muted-foreground font-mono">{log.ipAddress || '—'}</span>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      cell: (log: AuditLog) => (
        <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        getRowKey={(log) => log._id}
        emptyMessage="No audit logs"
        emptyIcon={<Activity className="w-12 h-12" />}
        renderMobileCard={(log) => {
          const actionType = log.action.split(':')[0]?.toUpperCase();
          return (
            <MobileCard>
              <MobileCardHeader>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={log.user.avatar} />
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                      {getInitials(log.user.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{log.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{log.user.email}</p>
                  </div>
                </div>
                <Badge className={ACTION_COLORS[actionType] || 'bg-gray-100 text-gray-700'}>
                  {log.action}
                </Badge>
              </MobileCardHeader>
              <MobileCardField label="Resource">
                <span className="capitalize">{log.resource}</span>
              </MobileCardField>
              <MobileCardField label="IP address">
                <span className="font-mono text-xs">{log.ipAddress || '—'}</span>
              </MobileCardField>
              <MobileCardField label="Time">
                <span className="text-muted-foreground/70">{formatRelativeTime(log.createdAt)}</span>
              </MobileCardField>
            </MobileCard>
          );
        }}
      />
      {data?.meta && data.meta.pages > 0 && (
        <Pagination
          page={data.meta.page}
          pages={data.meta.pages}
          total={data.meta.total}
          limit={data.meta.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
