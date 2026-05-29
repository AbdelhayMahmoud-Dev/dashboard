'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Shield,
  ChevronRight,
  LogOut,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { getInitials, formatRole } from '@/utils/format';

// ── Nav structure ─────────────────────────────────────────────────────────────
interface NavItem {
  href:       string;
  icon:       React.ElementType;
  label:      string;
  adminOnly?: boolean;
  badge?:     string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/products',  icon: Package,     label: 'Products'  },
      { href: '/orders',    icon: ShoppingCart, label: 'Orders'    },
      { href: '/customers', icon: Users,        label: 'Customers' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/users',    icon: Shield,   label: 'User Management', adminOnly: true },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

// ── Nav link item ───────────────────────────────────────────────────────────
// `collapsed` is a DESKTOP-only visual: the mini-rail. It is applied purely via
// `lg:` utilities so the mobile drawer always shows full labels regardless of
// the persisted collapse state.
interface NavLinkProps {
  item:        NavItem;
  active:      boolean;
  collapsed:   boolean;
  onNavigate:  () => void;
}

function SidebarNavLink({ item, active, collapsed, onNavigate }: NavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
        'transition-colors duration-150 select-none',
        collapsed && 'lg:justify-center',
        active
          ? 'text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-lg bg-sidebar-primary"
          style={{ zIndex: -1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        />
      )}

      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />

      <span className={cn('truncate whitespace-nowrap flex-1', collapsed && 'lg:hidden')}>
        {item.label}
      </span>

      {item.badge && (
        <span
          className={cn(
            'ml-auto shrink-0 rounded-full bg-sidebar-primary/20 text-sidebar-primary text-[10px] font-bold px-1.5 py-0.5 leading-none',
            collapsed && 'lg:hidden',
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarOpen, toggleCollapsed, setSidebarOpen } = useUIStore();
  const { user, logout } = useAuth();

  // Close the mobile drawer on Escape for keyboard accessibility.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, setSidebarOpen]);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const canSee = (item: NavItem) =>
    !item.adminOnly || user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <>
      {/* Mobile overlay — click to dismiss the drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="main-sidebar"
        className={cn(
          'fixed left-0 top-0 h-full z-40 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden',
          // Mobile: full-width drawer (240px) that slides in/out.
          'w-[15rem] transition-[transform,width] duration-300 ease-in-out',
          // Desktop (lg+): always visible, width driven by the collapse CSS var.
          'lg:w-[var(--sidebar-w)] lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center h-14 shrink-0 border-b border-sidebar-border px-4 gap-3',
            sidebarCollapsed && 'lg:justify-center lg:gap-0',
          )}
        >
          <div className="relative w-8 h-8 rounded-xl gradient-brand flex items-center justify-center shrink-0 glow-brand-sm">
            <Zap className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sidebar animate-pulse-dot" />
          </div>

          <div className={cn('overflow-hidden min-w-0', sidebarCollapsed && 'lg:hidden')}>
            <p className="text-sm font-bold text-sidebar-foreground leading-none whitespace-nowrap">
              Acme Commerce
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 whitespace-nowrap uppercase tracking-widest">
              Admin Dashboard
            </p>
          </div>
        </div>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <nav
          className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-0.5"
          role="navigation"
        >
          {NAV_GROUPS.map((group) => {
            const visible = group.items.filter(canSee);
            if (visible.length === 0) return null;

            return (
              <div key={group.label} className="mb-1">
                <p
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-widest overflow-hidden whitespace-nowrap',
                    sidebarCollapsed && 'lg:hidden',
                  )}
                >
                  {group.label}
                </p>

                {/* Mini-rail divider — only shown when collapsed on desktop */}
                <div
                  className={cn(
                    'my-1 h-px bg-sidebar-border/60 mx-2 hidden',
                    sidebarCollapsed && 'lg:block',
                  )}
                />

                <div className="space-y-0.5">
                  {visible.map((item) => (
                    <SidebarNavLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      collapsed={sidebarCollapsed}
                      onNavigate={() => setSidebarOpen(false)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 p-2 border-t border-sidebar-border space-y-1">
          <button
            onClick={() => logout()}
            title="Sign out"
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/50 hover:bg-red-500/15 hover:text-red-400',
              sidebarCollapsed && 'lg:justify-center',
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className={cn('truncate', sidebarCollapsed && 'lg:hidden')}>Sign Out</span>
          </button>

          {user && (
            <div
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sidebar-accent/60',
                sidebarCollapsed && 'lg:hidden',
              )}
            >
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center text-[11px] font-bold text-white">
                  {getInitials(user.name)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sidebar" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">
                  {user.name}
                </p>
                <p className="text-[10px] text-sidebar-foreground/45 mt-0.5 capitalize truncate">
                  {formatRole(user.role)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Collapse toggle (desktop only) ──────────────────────────────── */}
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border hidden lg:flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors shadow-sm"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.span
            animate={{ rotate: sidebarCollapsed ? 0 : 180 }}
            transition={{ duration: 0.22 }}
          >
            <ChevronRight className="w-3 h-3" aria-hidden="true" />
          </motion.span>
        </button>
      </aside>
    </>
  );
}
