'use client';

import { useState, useCallback } from 'react';
import { Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUsers, useToggleUserStatus, useDeleteUser } from '@/hooks/useUsers';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard, MobileCardHeader, MobileCardField, MobileCardActions } from '@/components/ui/mobile-card';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/page-header';
import { RoleBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate, formatRelativeTime, getInitials } from '@/utils/format';
import { User } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditLogTable } from '@/components/users/AuditLogTable';
import { useDebounce } from '@/hooks/useDebounce';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { cn } from '@/lib/utils';

function UserStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
      active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        active ? 'bg-emerald-500' : 'bg-slate-400',
      )} aria-hidden="true" />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function UsersPage() {
  const [page, setPage]     = useState(1);
  const [limit, setLimit]   = useState(10);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState('');

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useUsers({ page, limit, search: debouncedSearch });
  const toggleStatus = useToggleUserStatus();
  const deleteUser   = useDeleteUser();

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  const columns = [
    {
      key: 'user',
      header: 'User',
      cell: (u: User) => (
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={u.avatar} />
            <AvatarFallback className="text-xs font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
              {getInitials(u.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate max-w-[160px]">{u.name}</p>
            <p className="text-xs text-muted-foreground/70 truncate max-w-[160px]">{u.email}</p>
          </div>
        </div>
      ),
      sortFn: (a: User, b: User) => a.name.localeCompare(b.name),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u: User) => <RoleBadge role={u.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u: User) => <UserStatusBadge active={u.isActive} />,
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      cell: (u: User) => (
        <span className="text-sm text-muted-foreground/70" title={u.lastLogin ? formatDate(u.lastLogin) : undefined}>
          {u.lastLogin ? formatRelativeTime(u.lastLogin) : '—'}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (u: User) => (
        <span className="text-sm text-muted-foreground/70">{formatDate(u.createdAt)}</span>
      ),
      sortFn: (a: User, b: User) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      key: 'actions',
      header: '',
      cell: (u: User) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={(e) => { e.stopPropagation(); toggleStatus.mutate(u._id); }}
            aria-label={u.isActive ? `Deactivate ${u.name}` : `Activate ${u.name}`}
            disabled={toggleStatus.isPending}
          >
            {u.isActive
              ? <UserX className="w-3.5 h-3.5 text-amber-500" />
              : <UserCheck className="w-3.5 h-3.5 text-emerald-500" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-destructive hover:text-destructive"
            aria-label={`Delete ${u.name}`}
            onClick={(e) => { e.stopPropagation(); setDeleteId(u._id); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
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
          title="User Management"
          description="Manage admin users, roles, and permissions"
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4 mt-4">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Search users…"
              className="max-w-sm"
            />

            <DataTable
              columns={columns}
              data={data?.data ?? []}
              loading={isLoading}
              getRowKey={(u) => u._id}
              emptyMessage="No users found"
              emptyIcon={<Shield className="w-12 h-12" />}
              skeletonRows={limit}
              renderMobileCard={(u) => (
                <MobileCard>
                  <MobileCardHeader>
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="text-xs font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground/70 truncate">{u.email}</p>
                      </div>
                    </div>
                    <RoleBadge role={u.role} />
                  </MobileCardHeader>
                  <MobileCardField label="Status"><UserStatusBadge active={u.isActive} /></MobileCardField>
                  <MobileCardField label="Last login">
                    <span className="text-muted-foreground/70">
                      {u.lastLogin ? formatRelativeTime(u.lastLogin) : '—'}
                    </span>
                  </MobileCardField>
                  <MobileCardField label="Joined">
                    <span className="text-muted-foreground/70">{formatDate(u.createdAt)}</span>
                  </MobileCardField>
                  <MobileCardActions>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => toggleStatus.mutate(u._id)}
                      disabled={toggleStatus.isPending}
                    >
                      {u.isActive
                        ? <><UserX className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Deactivate</>
                        : <><UserCheck className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> Activate</>}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(u._id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                    </Button>
                  </MobileCardActions>
                </MobileCard>
              )}
            />

            {data?.meta && data.meta.pages > 0 && (
              <Pagination
                page={data.meta.page}
                pages={data.meta.pages}
                total={data.meta.total}
                limit={data.meta.limit}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
              />
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLogTable />
          </TabsContent>
        </Tabs>
      </motion.div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(''); }}
        onConfirm={() => { if (deleteId) { deleteUser.mutate(deleteId); setDeleteId(''); } }}
        title="Delete User"
        description="This will permanently delete the user and all associated data. This action cannot be undone."
        confirmLabel="Delete User"
        isLoading={deleteUser.isPending}
      />
    </motion.div>
  );
}
