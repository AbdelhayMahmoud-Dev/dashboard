/**
 * Thin cache utility wrapping ioredis.
 * All methods are safe to call even when Redis is unavailable — they silently
 * fall back to the provided data-fetching function so the application is
 * always correct, just potentially slower.
 */
import { getRedis, isRedisReady } from '../config/redis';
import { logger } from './logger';

const DEFAULT_TTL = 60 * 5; // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisReady()) return null;
  try {
    const val = await getRedis()!.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch (err) {
    logger.warn('Cache GET failed', { key, error: (err as Error).message });
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await getRedis()!.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('Cache SET failed', { key, error: (err as Error).message });
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!isRedisReady() || !keys.length) return;
  try {
    await getRedis()!.del(...keys);
  } catch (err) {
    logger.warn('Cache DEL failed', { keys, error: (err as Error).message });
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const r = getRedis()!;
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(...keys);
  } catch (err) {
    logger.warn('Cache DEL pattern failed', { pattern, error: (err as Error).message });
  }
}

/**
 * Cache-aside helper: try cache, on miss call fetcher, store result.
 * Guarantees the caller always gets data even if Redis is down.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  await cacheSet(key, data, ttlSeconds);
  return data;
}

/** Cache keys factory — keeps key format consistent */
export const CacheKeys = {
  dashboardStats: () => 'analytics:dashboard',
  products: (filters: string) => `products:list:${filters}`,
  product: (id: string) => `products:detail:${id}`,
  categories: () => 'products:categories',
  orders: (filters: string) => `orders:list:${filters}`,
  customers: (filters: string) => `customers:list:${filters}`,
  userProfile: (id: string) => `users:profile:${id}`,
};
