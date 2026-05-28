'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  label: string;
  keys: string[];
  /** Joiner shown between the keys (e.g. "then" for chords, "+" for combos). */
  joiner?: 'then' | '+' | null;
  /** Hide when the user is not an admin. */
  adminOnly?: boolean;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: 'Navigate',
    shortcuts: [
      { label: 'Go to Dashboard', keys: ['G', 'D'], joiner: 'then' },
      { label: 'Go to Products', keys: ['G', 'P'], joiner: 'then' },
      { label: 'Go to Orders', keys: ['G', 'O'], joiner: 'then' },
      { label: 'Go to Customers', keys: ['G', 'C'], joiner: 'then' },
      { label: 'Go to Settings', keys: ['G', 'S'], joiner: 'then' },
      { label: 'Go to Users', keys: ['G', 'U'], joiner: 'then', adminOnly: true },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { label: 'Open command palette', keys: ['⌘', 'K'], joiner: '+' },
      { label: 'Show this help', keys: ['?'], joiner: null },
      { label: 'Cancel chord', keys: ['Esc'], joiner: null },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] font-semibold text-foreground shadow-xs">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog() {
  const { shortcutsHelpOpen, setShortcutsHelpOpen } = useUIStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin' || role === 'super_admin';

  return (
    <Dialog open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Move around faster. Press <Kbd>?</Kbd> anywhere to reopen this dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {SECTIONS.map((section) => {
            const visible = section.shortcuts.filter((s) => !s.adminOnly || isAdmin);
            if (visible.length === 0) return null;

            return (
              <section key={section.title}>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  {section.title}
                </h3>
                <ul className="divide-y divide-border/60">
                  {visible.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="text-sm text-foreground">{s.label}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {s.keys.map((k, i) => (
                          <span key={`${k}-${i}`} className="flex items-center gap-1.5">
                            {i > 0 && s.joiner && (
                              <span className="text-[10px] text-muted-foreground">
                                {s.joiner}
                              </span>
                            )}
                            <Kbd>{k}</Kbd>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
