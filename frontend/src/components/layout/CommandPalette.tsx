'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Shield,
  Settings,
  Moon,
  Sun,
  Plus,
  LogOut,
  Keyboard,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';

// ── CommandPalette ────────────────────────────────────────────────────────────
export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { commandOpen, setCommandOpen, setShortcutsHelpOpen } = useUIStore();
  const { user, logout } = useAuth();

  // ── Close helper ──────────────────────────────────────────────────────────
  const close = useCallback(() => setCommandOpen(false), [setCommandOpen]);

  // Run an action then close
  const run = useCallback(
    (fn: () => void) => {
      close();
      // Small delay so the dialog closes before navigation/action
      requestAnimationFrame(fn);
    },
    [close],
  );

  const navigate = useCallback(
    (href: string) => run(() => router.push(href)),
    [run, router],
  );

  // ── Global keyboard shortcut ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setCommandOpen]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command or search…" autoFocus />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* ── Navigate ──────────────────────────────────────────────────── */}
        <CommandGroup heading="Navigate">
          <CommandItem
            keywords={['home', 'overview', 'analytics', 'metrics']}
            onSelect={() => navigate('/dashboard')}
          >
            <LayoutDashboard className="text-muted-foreground" />
            Dashboard
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>

          <CommandItem
            keywords={['inventory', 'items', 'catalog', 'sku', 'stock']}
            onSelect={() => navigate('/products')}
          >
            <Package className="text-muted-foreground" />
            Products
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>

          <CommandItem
            keywords={['purchases', 'transactions', 'invoices']}
            onSelect={() => navigate('/orders')}
          >
            <ShoppingCart className="text-muted-foreground" />
            Orders
            <CommandShortcut>G O</CommandShortcut>
          </CommandItem>

          <CommandItem
            keywords={['clients', 'accounts', 'buyers', 'users']}
            onSelect={() => navigate('/customers')}
          >
            <Users className="text-muted-foreground" />
            Customers
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>

          {isAdmin && (
            <CommandItem
              keywords={['team', 'staff', 'admins', 'permissions', 'roles', 'audit']}
              onSelect={() => navigate('/users')}
            >
              <Shield className="text-muted-foreground" />
              User Management
            </CommandItem>
          )}

          <CommandItem
            keywords={['profile', 'preferences', 'account', 'password', 'appearance']}
            onSelect={() => navigate('/settings')}
          >
            <Settings className="text-muted-foreground" />
            Settings
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Create ────────────────────────────────────────────────────── */}
        <CommandGroup heading="Create">
          <CommandItem
            keywords={['new', 'add', 'create', 'product', 'item', 'inventory', 'sku']}
            onSelect={() => navigate('/products')}
          >
            <Plus className="text-muted-foreground" />
            New Product
          </CommandItem>

          <CommandItem
            keywords={['new', 'add', 'create', 'customer', 'client', 'account', 'buyer']}
            onSelect={() => navigate('/customers')}
          >
            <Plus className="text-muted-foreground" />
            New Customer
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Appearance ────────────────────────────────────────────────── */}
        <CommandGroup heading="Appearance">
          {theme === 'dark' ? (
            <CommandItem
              keywords={['light', 'mode', 'theme', 'color', 'scheme', 'appearance']}
              onSelect={() => run(() => setTheme('light'))}
            >
              <Sun className="text-muted-foreground" />
              Switch to Light Mode
            </CommandItem>
          ) : (
            <CommandItem
              keywords={['dark', 'mode', 'theme', 'color', 'scheme', 'night', 'appearance']}
              onSelect={() => run(() => setTheme('dark'))}
            >
              <Moon className="text-muted-foreground" />
              Switch to Dark Mode
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* ── Help ──────────────────────────────────────────────────────── */}
        <CommandGroup heading="Help">
          <CommandItem
            keywords={['keyboard', 'shortcuts', 'keys', 'hotkeys', 'help', 'cheatsheet']}
            onSelect={() => run(() => setShortcutsHelpOpen(true))}
          >
            <Keyboard className="text-muted-foreground" />
            Keyboard Shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Account ───────────────────────────────────────────────────── */}
        <CommandGroup heading="Account">
          <CommandItem
            keywords={['sign', 'out', 'log', 'off', 'quit', 'exit', 'logout']}
            onSelect={() => run(logout)}
          >
            <LogOut className="text-destructive" />
            <span className="text-destructive">Sign Out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
