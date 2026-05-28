'use client';

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
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getInitials } from '@/utils/format';

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

// ── Animation variants ────────────────────────────────────────────────────────
const sidebarVariants = {
  expanded:  { width: 240 },
  collapsed: { width: 68  },
};

const labelVariants = {
  expanded:  { opacity: 1, width: 'auto', transition: { duration: 0.18, delay: 0.04 } },
  collapsed: { opacity: 0, width: 0,      transition: { duration: 0.12 } },
};

// ── Nav link item (extracted outside Sidebar to avoid remount on every render)
interface NavLinkProps {
  item:             NavItem;
  active:           boolean;
  collapsed:        boolean;
  onCloseMobile:    () => void;
}

function SidebarNavLink({ item, active, collapsed, onCloseMobile }: NavLinkProps) {
  const Icon = item.icon;

  const linkEl = (
    <Link
      href={item.href}
      onClick={onCloseMobile}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
        'transition-colors duration-150 select-none',
        collapsed ? 'justify-center' : '',
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

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            variants={labelVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="truncate overflow-hidden whitespace-nowrap flex-1"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {!collapsed && item.badge && (
        <span className="ml-auto shrink-0 rounded-full bg-sidebar-primary/20 text-sidebar-primary text-[10px] font-bold px-1.5 py-0.5 leading-none">
          {item.badge}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={linkEl} />
        <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkEl;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarOpen, toggleCollapsed, setSidebarOpen } = useUIStore();
  const { user, logout } = useAuth();
  const state = sidebarCollapsed ? 'collapsed' : 'expanded';

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const canSee = (item: NavItem) =>
    !item.adminOnly || user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <motion.aside
        id="main-sidebar"
        className="fixed left-0 top-0 h-full z-40 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden"
        variants={sidebarVariants}
        animate={state}
        initial={false}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        aria-label="Main navigation"
      >
        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div className={cn(
          'flex items-center h-14 shrink-0 border-b border-sidebar-border',
          sidebarCollapsed ? 'justify-center px-4' : 'px-4 gap-3',
        )}>
          <div className="relative w-8 h-8 rounded-xl gradient-brand flex items-center justify-center shrink-0 glow-brand-sm">
            <Zap className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sidebar animate-pulse-dot" />
          </div>

          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                className="overflow-hidden min-w-0"
                variants={labelVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
              >
                <p className="text-sm font-bold text-sidebar-foreground leading-none whitespace-nowrap">
                  Acme Commerce
                </p>
                <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 whitespace-nowrap uppercase tracking-widest">
                  Admin Dashboard
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.p
                      variants={labelVariants}
                      initial="collapsed"
                      animate="expanded"
                      exit="collapsed"
                      className="px-3 py-1.5 text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-widest overflow-hidden whitespace-nowrap"
                    >
                      {group.label}
                    </motion.p>
                  )}
                </AnimatePresence>

                {sidebarCollapsed && (
                  <div className="my-1 h-px bg-sidebar-border/60 mx-2" />
                )}

                <div className="space-y-0.5">
                  {visible.map((item) => (
                    <SidebarNavLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      collapsed={sidebarCollapsed}
                      onCloseMobile={() => setSidebarOpen(false)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 p-2 border-t border-sidebar-border space-y-1">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger render={
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/50 hover:bg-red-500/15 hover:text-red-400"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              } />
              <TooltipContent side="right" className="text-xs">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground/50 hover:bg-red-500/15 hover:text-red-400"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Sign Out</span>
            </button>
          )}

          <AnimatePresence>
            {!sidebarCollapsed && user && (
              <motion.div
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sidebar-accent/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.08 } }}
                exit={{ opacity: 0 }}
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
                    {user.role.replace('_', ' ')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Collapse toggle ─────────────────────────────────────────────── */}
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
      </motion.aside>
    </>
  );
}
