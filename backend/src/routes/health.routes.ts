import { Router, Request, Response } from 'express';
import { getDbStatus } from '../config/db';
import { isRedisReady } from '../config/redis';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/** GET /health — liveness probe (no auth required) */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV ?? 'development',
    version: process.env.npm_package_version ?? '1.0.0',
  });
});

/** GET /health/detailed — readiness probe (checks all dependencies) */
router.get(
  '/detailed',
  asyncHandler(async (_req: Request, res: Response) => {
    const dbStatus = getDbStatus();
    const redisOk = isRedisReady();
    const allHealthy = dbStatus === 'connected'; // Redis is optional

    const payload = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        unit: 'MB',
      },
      dependencies: {
        database: { status: dbStatus, healthy: dbStatus === 'connected' },
        cache: { status: redisOk ? 'connected' : 'unavailable', healthy: redisOk, optional: true },
      },
      version: {
        node: process.version,
        app: process.env.npm_package_version ?? '1.0.0',
      },
    };

    res.status(allHealthy ? 200 : 503).json(payload);
  })
);

/** GET /health/version — API versioning info */
router.get('/version', (_req: Request, res: Response) => {
  res.json({
    api: {
      current: 'v1',
      supported: ['v1'],
      deprecated: [],
      sunset: {},
    },
    app: process.env.npm_package_version ?? '1.0.0',
    docs: '/api-docs',
  });
});

export default router;
