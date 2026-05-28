// ── Status display configuration ────────────────────────────────────────────
// Uses paired light/dark classes so badges look great in both colour modes.
// dot = indicator bullet colour; color = badge background + text + border.

export const ORDER_STATUS_CONFIG = {
  pending:    { label: 'Pending',    dot: 'bg-amber-500',   color: 'bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-500/10   dark:text-amber-400   dark:border-amber-500/20'   },
  processing: { label: 'Processing', dot: 'bg-blue-500',    color: 'bg-blue-50    text-blue-700    border-blue-200    dark:bg-blue-500/10    dark:text-blue-400    dark:border-blue-500/20'    },
  shipped:    { label: 'Shipped',    dot: 'bg-violet-500',  color: 'bg-violet-50  text-violet-700  border-violet-200  dark:bg-violet-500/10  dark:text-violet-400  dark:border-violet-500/20'  },
  delivered:  { label: 'Delivered',  dot: 'bg-emerald-500', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
  cancelled:  { label: 'Cancelled',  dot: 'bg-rose-500',    color: 'bg-rose-50    text-rose-700    border-rose-200    dark:bg-rose-500/10    dark:text-rose-400    dark:border-rose-500/20'    },
  refunded:   { label: 'Refunded',   dot: 'bg-slate-400',   color: 'bg-slate-100  text-slate-600   border-slate-200   dark:bg-slate-500/10   dark:text-slate-400   dark:border-slate-500/20'   },
} as const;

export const PAYMENT_STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-amber-50   text-amber-700   dark:bg-amber-500/10   dark:text-amber-400'   },
  paid:     { label: 'Paid',     color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  failed:   { label: 'Failed',   color: 'bg-rose-50    text-rose-700    dark:bg-rose-500/10    dark:text-rose-400'    },
  refunded: { label: 'Refunded', color: 'bg-slate-100  text-slate-600   dark:bg-slate-500/10   dark:text-slate-400'   },
} as const;

export const PRODUCT_STATUS_CONFIG = {
  active:   { label: 'Active',   color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  inactive: { label: 'Inactive', color: 'bg-slate-100  text-slate-600   dark:bg-slate-500/10   dark:text-slate-400'   },
  draft:    { label: 'Draft',    color: 'bg-amber-50   text-amber-700   dark:bg-amber-500/10   dark:text-amber-400'   },
} as const;

export const CUSTOMER_STATUS_CONFIG = {
  active:   { label: 'Active',   color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  inactive: { label: 'Inactive', color: 'bg-slate-100  text-slate-600   dark:bg-slate-500/10   dark:text-slate-400'   },
  banned:   { label: 'Banned',   color: 'bg-rose-50    text-rose-700    dark:bg-rose-500/10    dark:text-rose-400'    },
} as const;

export const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: 'bg-violet-50  text-violet-700  dark:bg-violet-500/10  dark:text-violet-400'  },
  admin:       { label: 'Admin',       color: 'bg-blue-50    text-blue-700    dark:bg-blue-500/10    dark:text-blue-400'    },
  manager:     { label: 'Manager',     color: 'bg-orange-50  text-orange-700  dark:bg-orange-500/10  dark:text-orange-400'  },
  viewer:      { label: 'Viewer',      color: 'bg-slate-100  text-slate-600   dark:bg-slate-500/10   dark:text-slate-400'   },
} as const;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
