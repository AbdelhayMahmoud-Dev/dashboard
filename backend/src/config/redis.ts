import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redis: Redis | null = null;
let isRedisAvailable = false;

export function getRedis(): Redis | null {
  return redis;
}

export function isRedisReady(): boolean {
  return isRedisAvailable;
}

export function initRedis(): void {
  const url = process.env.REDIS_URL;

  if (!url) {
    logger.warn('REDIS_URL not set — caching disabled. Set REDIS_URL to enable.');
    return;
  }

  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 5) {
        logger.warn('Redis: max retries exceeded — giving up');
        return null; // stop retrying
      }
      return Math.min(times * 100, 2000);
    },
  });

  redis.on('connect', () => {
    isRedisAvailable = true;
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    isRedisAvailable = false;
    logger.warn('Redis error — falling back to no-cache mode', { error: err.message });
  });

  redis.on('close', () => {
    isRedisAvailable = false;
  });

  redis.connect().catch((err) => {
    logger.warn('Redis initial connect failed', { error: err.message });
  });
}
