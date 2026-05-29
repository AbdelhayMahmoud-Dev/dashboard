export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatDate = (
  date?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (date == null) return '—';
  const d = new Date(date);
  // `new Date(undefined | garbage)` yields an Invalid Date, and
  // Intl.DateTimeFormat#format throws "RangeError: Invalid time value" on it.
  // A missing/partial timestamp from a not-fully-loaded record must never crash
  // a render — return an em dash placeholder instead.
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
};

export const formatRelativeTime = (date?: string | Date | null): string => {
  if (date == null) return '—';
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return '—';
  const diff = Date.now() - time;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
};

export const getInitials = (name?: string | null): string => {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Human-readable role label, e.g. `super_admin` → `super admin`.
 *
 * Null-safe by design: although `User.role` is typed as a required `UserRole`,
 * the auth store is rehydrated from localStorage with NO runtime validation, so
 * at runtime `role` can be `undefined` (a stale/partial persisted blob while the
 * `getMe` query is still in flight). Calling `.replace` on that undefined value
 * throws during render — which previously crashed the navbar/sidebar (→ global
 * error page) and the Settings profile tab (→ segment error). Returning '' keeps
 * the UI rendering instead of throwing.
 */
export const formatRole = (role?: string | null): string =>
  (role ?? '').replace(/_/g, ' ');
