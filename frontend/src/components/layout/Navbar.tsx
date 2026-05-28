'use client';

import { Bell, Menu, Moon, Sun, Settings, LogOut, Search, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/uiStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/utils/format';

// ── Breadcrumb segments ────────────────────────────────────────────────────────
const ROUTE_LABELS: Record<string, string> = {
  dashboard:  'Dashboard',
  products:   'Products',
  orders:     'Orders',
  customers:  'Customers',
  users:      'User Management',
  settings:   'Settings',
  analytics:  'Analytics',
};

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <span className="text-muted-foreground/50">Acme Commerce</span>
      {segments.map((seg, i) => {
        const label = ROUTE_LABELS[seg] ?? (seg.charAt(0).toUpperCase() + seg.slice(1));
        const isLast = i === segments.length - 1;

        return (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-muted-foreground/30" aria-hidden="true" />
            <span className={cn(isLast ? 'text-foreground font-medium' : 'text-muted-foreground/70')}>
              {label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────────
export function Navbar() {
  const { sidebarCollapsed, sidebarOpen, toggleSidebar, setCommandOpen } = useUIStore();
  const { unreadCount } = useNotificationStore();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <motion.header
      className={cn(
        'fixed top-0 right-0 z-20 h-14 flex items-center gap-3 px-4 sm:px-5',
        'bg-background/85 backdrop-blur-md border-b border-border',
      )}
      animate={{ left: sidebarCollapsed ? 68 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      role="banner"
    >
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="lg:hidden -ml-1 h-8 w-8"
        aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={sidebarOpen}
        aria-controls="main-sidebar"
      >
        <Menu className="w-4 h-4" aria-hidden="true" />
      </Button>

      {/* Breadcrumbs */}
      <Breadcrumbs pathname={pathname} />

      <div className="flex-1" />

      {/* ── Right-side actions ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1">

        {/* Search / command palette trigger */}
        <button
          onClick={() => setCommandOpen(true)}
          className={cn(
            'hidden md:flex items-center gap-2 h-8 rounded-lg border border-border',
            'px-3 text-xs text-muted-foreground',
            'bg-muted/40 hover:bg-muted/70 transition-colors',
            'focus-ring',
          )}
          aria-label="Search"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Search…</span>
          <kbd className="ml-2 hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground/70">
            ⌘K
          </kbd>
        </button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <Sun  className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
          <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full gradient-brand text-white text-[9px] font-bold flex items-center justify-center px-0.5"
              aria-hidden="true"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {/* Vertical divider */}
        <div className="w-px h-5 bg-border mx-0.5" aria-hidden="true" />

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 h-8',
                'hover:bg-accent transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              )}
              aria-label={`User menu for ${user.name}`}
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={user.avatar} alt="" />
                <AvatarFallback className="gradient-brand text-white text-[10px] font-bold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-foreground leading-none">{user.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize leading-none">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatar} alt="" />
                    <AvatarFallback className="gradient-brand text-white text-xs font-bold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{user.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="gap-2 text-sm"
              >
                <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </motion.header>
  );
}
