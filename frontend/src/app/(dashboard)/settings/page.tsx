'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TextField } from '@/components/ui/form-field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate, getInitials } from '@/utils/format';
import {
  Loader2, Moon, Sun, Bell, Shield, AlertTriangle, Monitor, User as UserIcon, Palette,
} from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/types/api';
import { cn } from '@/lib/utils';

// ── Schemas ───────────────────────────────────────────────────────────────────
const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain uppercase, lowercase, and a number'),
});

type ProfileForm  = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

// ── Notification preferences (localStorage-backed) ────────────────────────────
const NOTIF_KEY = 'dashboard:notif_prefs';

interface NotifPrefs {
  orderUpdates:   boolean;
  newCustomers:   boolean;
  lowStockAlerts: boolean;
  weeklyDigest:   boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  orderUpdates:   true,
  newCustomers:   false,
  lowStockAlerts: true,
  weeklyDigest:   false,
};

function useNotifPrefs() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIF_KEY);
      if (stored) setPrefs(JSON.parse(stored) as NotifPrefs);
    } catch {
      // ignore parse errors
    }
  }, []);

  const update = useCallback(<K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { prefs, update };
}

// ── Section nav ───────────────────────────────────────────────────────────────
type SectionId =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'appearance'
  | 'sessions'
  | 'danger';

interface SectionDef {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  destructive?: boolean;
}

const SECTIONS: readonly SectionDef[] = [
  { id: 'profile',       label: 'Profile',        icon: UserIcon       },
  { id: 'security',      label: 'Security',       icon: Shield         },
  { id: 'notifications', label: 'Notifications',  icon: Bell           },
  { id: 'appearance',    label: 'Appearance',     icon: Palette        },
  { id: 'sessions',      label: 'Sessions',       icon: Monitor        },
  { id: 'danger',        label: 'Danger Zone',    icon: AlertTriangle, destructive: true },
];

const VALID_IDS = new Set<SectionId>(SECTIONS.map((s) => s.id));

function isValidSection(value: string): value is SectionId {
  return (VALID_IDS as Set<string>).has(value);
}

// ── URL hash binding ──────────────────────────────────────────────────────────
// useSyncExternalStore avoids the React 19 "set-state-in-effect" anti-pattern.
// Bonus: browser back/forward (which fires hashchange) updates the active panel.
const subscribeHash = (cb: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHashSnapshot = (): string =>
  typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
const getHashServerSnapshot = (): string => '';

function useUrlHash(): string {
  return useSyncExternalStore(subscribeHash, getHashSnapshot, getHashServerSnapshot);
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({
  id, label, description, checked, onCheckedChange, disabled,
}: {
  id:              string;
  label:           string;
  description:     string;
  checked:         boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?:       boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <Label htmlFor={id} className={cn('text-sm font-medium', disabled && 'opacity-50')}>
          {label}
        </Label>
        <p className={cn('text-xs text-muted-foreground mt-0.5', disabled && 'opacity-50')}>
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

// ── Settings nav (left rail on desktop, top strip on mobile) ──────────────────
function SettingsNav({
  active,
  onSelect,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        // mobile: scrollable horizontal strip
        'flex gap-1 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1',
        // desktop: vertical sticky rail
        'md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:mx-0 md:pb-0 md:sticky md:top-20 md:self-start',
      )}
    >
      {SECTIONS.map(({ id, label, icon: Icon, destructive }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative shrink-0 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-ring',
              isActive
                ? destructive ? 'text-destructive' : 'text-foreground'
                : destructive
                  ? 'text-muted-foreground hover:text-destructive'
                  : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="settings-nav-active"
                className={cn(
                  'absolute inset-0 rounded-lg',
                  destructive ? 'bg-destructive/10' : 'bg-muted',
                )}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <Icon className="relative w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="relative whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Section panel wrapper (handles motion + a11y attrs) ───────────────────────
function Panel({ id, children }: { id: SectionId; children: React.ReactNode }) {
  return (
    <motion.section
      key={id}
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="space-y-6"
    >
      {children}
    </motion.section>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, updateProfile, deleteAccount, isDeletingAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const { prefs, update: updateNotif } = useNotifPrefs();

  // Active section is derived from URL hash so back/forward navigation works
  // and the user can bookmark/share a specific section. Default: 'profile'.
  const hash = useUrlHash();
  const active: SectionId = isValidSection(hash) ? hash : 'profile';

  const handleSelect = useCallback((id: SectionId) => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `#${id}`);
    // replaceState does not fire hashchange; dispatch manually so the store updates.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);

  // Confirm delete state
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const emailMatches = confirmEmail.trim().toLowerCase() === user?.email?.toLowerCase();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name || '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const changePassword = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      toast.success('Password changed successfully');
      passwordForm.reset();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to change password')),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="max-w-5xl"
    >
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <div className="grid md:grid-cols-[180px_1fr] gap-8 mt-6">
        <SettingsNav active={active} onSelect={handleSelect} />

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>

            {/* ── Profile ───────────────────────────────────────────────────── */}
            {active === 'profile' && (
              <Panel id="profile">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Profile</CardTitle>
                    <CardDescription>Update your personal information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback className="text-xl font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                          {getInitials(user?.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user?.name}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5 capitalize">
                          {user?.role.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <form
                      onSubmit={profileForm.handleSubmit((d) => updateProfile(d))}
                      className="space-y-4"
                      noValidate
                    >
                      <TextField
                        label="Full Name"
                        placeholder="Your full name"
                        required
                        {...profileForm.register('name')}
                        error={profileForm.formState.errors.name}
                      />
                      <TextField
                        label="Email Address"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted"
                        hint="Email address cannot be changed"
                        readOnly
                      />
                      <Button type="submit" size="sm">Save Profile</Button>
                    </form>
                  </CardContent>
                </Card>
              </Panel>
            )}

            {/* ── Security ─────────────────────────────────────────────────── */}
            {active === 'security' && (
              <Panel id="security">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Change Password</CardTitle>
                    <CardDescription>Use a strong password with mixed character types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={passwordForm.handleSubmit((d) => changePassword.mutate(d))}
                      className="space-y-4"
                      noValidate
                    >
                      <TextField
                        label="Current Password"
                        type="password"
                        required
                        autoComplete="current-password"
                        {...passwordForm.register('currentPassword')}
                        error={passwordForm.formState.errors.currentPassword}
                      />
                      <TextField
                        label="New Password"
                        type="password"
                        required
                        autoComplete="new-password"
                        hint="At least 8 characters, with uppercase, lowercase and a number"
                        {...passwordForm.register('newPassword')}
                        error={passwordForm.formState.errors.newPassword}
                      />
                      <Button type="submit" size="sm" disabled={changePassword.isPending}>
                        {changePassword.isPending && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                        )}
                        Change Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </Panel>
            )}

            {/* ── Notifications ────────────────────────────────────────────── */}
            {active === 'notifications' && (
              <Panel id="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Email Notifications</CardTitle>
                    <CardDescription>Control which email notifications you receive</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-border">
                      <ToggleRow
                        id="notif-orders"
                        label="Order updates"
                        description="Get notified when orders change status"
                        checked={prefs.orderUpdates}
                        onCheckedChange={(v) => updateNotif('orderUpdates', v)}
                      />
                      <ToggleRow
                        id="notif-customers"
                        label="New customers"
                        description="Alert when a new customer registers"
                        checked={prefs.newCustomers}
                        onCheckedChange={(v) => updateNotif('newCustomers', v)}
                      />
                      <ToggleRow
                        id="notif-stock"
                        label="Low stock alerts"
                        description="Notify when product stock falls below threshold"
                        checked={prefs.lowStockAlerts}
                        onCheckedChange={(v) => updateNotif('lowStockAlerts', v)}
                      />
                      <ToggleRow
                        id="notif-digest"
                        label="Weekly digest"
                        description="Summary of activity sent every Monday morning"
                        checked={prefs.weeklyDigest}
                        onCheckedChange={(v) => updateNotif('weeklyDigest', v)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Panel>
            )}

            {/* ── Appearance ───────────────────────────────────────────────── */}
            {active === 'appearance' && (
              <Panel id="appearance">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Appearance</CardTitle>
                    <CardDescription>Customize the dashboard look and feel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'icon-container icon-container-sm',
                            theme === 'dark' ? 'icon-violet' : 'icon-amber',
                          )}
                        >
                          {theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <p className="text-sm font-medium">Dark Mode</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Toggle between light and dark theme
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={theme === 'dark'}
                        onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
                        aria-label="Toggle dark mode"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Panel>
            )}

            {/* ── Sessions ─────────────────────────────────────────────────── */}
            {active === 'sessions' && (
              <Panel id="sessions">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Current Session</CardTitle>
                    <CardDescription>Information about your active session</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Account</span>
                        <span className="font-medium">{user?.email}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last signed in</span>
                        <span className="font-medium tabular">
                          {user?.lastLogin ? formatDate(user.lastLogin) : '—'}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Role</span>
                        <span className="font-medium capitalize">
                          {user?.role.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Panel>
            )}

            {/* ── Danger Zone ──────────────────────────────────────────────── */}
            {active === 'danger' && (
              <Panel id="danger">
                <Card className="border-destructive/40">
                  <CardHeader>
                    <CardTitle className="text-base text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Irreversible actions that permanently affect your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Delete Account</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Permanently remove your account and all associated data. This cannot be undone.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
                        onClick={() => { setConfirmEmail(''); setDeleteOpen(true); }}
                        disabled={isDeletingAccount}
                      >
                        {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                        Delete Account
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Panel>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Delete account confirmation dialog ────────────────────────────── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => { if (!open) { setDeleteOpen(false); setConfirmEmail(''); } }}
        onConfirm={() => deleteAccount()}
        title="Delete Account"
        confirmLabel="Permanently Delete"
        isLoading={isDeletingAccount}
        confirmDisabled={!emailMatches}
        variant="destructive"
        description={
          <span>
            This will permanently delete your account and all associated data.{' '}
            <strong>This action cannot be undone.</strong>
            <span className="block mt-3 space-y-2">
              <span className="block text-sm text-muted-foreground">
                Type your email address to confirm:
              </span>
              <Input
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user?.email ?? 'your@email.com'}
                className="h-8 text-sm font-mono"
                autoComplete="off"
                autoFocus
              />
            </span>
          </span>
        }
      />
    </motion.div>
  );
}
