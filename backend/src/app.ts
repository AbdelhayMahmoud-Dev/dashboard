import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';

import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import customerRoutes from './routes/customer.routes';
import analyticsRoutes from './routes/analytics.routes';
import userRoutes from './routes/user.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { logger, morganStream } from './utils/logger';
import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';

const app = express();

// Health probes hit both the unversioned and versioned paths — exempt either
// from rate limiting and request logging so monitors don't get throttled or
// flood the logs.
const isHealthPath = (path: string): boolean =>
  path === '/health' || path === '/api/v1/health';

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// Remove fingerprinting headers
app.disable('x-powered-by');

/**
 * Strip trailing slashes so "https://app.com/" and "https://app.com" compare
 * equal. A trailing slash in CLIENT_URL is the single most common reason a
 * correctly-configured origin still gets rejected — the browser's Origin header
 * never has one, so an exact string match silently fails.
 */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/** True for any localhost / loopback host (any port), used for local dev. */
function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

/**
 * CORS origin check. An origin is allowed when ANY of these hold:
 *
 *   1. It is in the CLIENT_URL allowlist (comma-separated, slash-insensitive).
 *   2. It is a Vercel deployment — host ends in `.vercel.app`. This covers the
 *      production alias AND every preview/branch deployment (which each get a
 *      unique *.vercel.app URL), so the frontend keeps working without having to
 *      re-list every new deployment URL in CLIENT_URL.
 *   3. It is localhost / loopback on any port — local development.
 *
 * The origin callback returns `true` (not `'*'`), so the cors middleware
 * REFLECTS the specific request origin back in Access-Control-Allow-Origin.
 * That is what keeps `credentials: true` valid — the spec forbids `*` with
 * credentials.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  // Same-origin and non-browser callers (curl, Postman, health probes) — allow.
  if (!origin) return true;

  const candidate = normalizeOrigin(origin);

  // 1) Explicit allowlist.
  const allowed = env.CLIENT_URL.split(',').map(normalizeOrigin).filter(Boolean);
  if (allowed.includes(candidate)) return true;

  // 2) & 3) Vercel deployments + localhost.
  try {
    const { hostname } = new URL(candidate);
    if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) return true;
    if (isLocalhost(hostname)) return true;
  } catch {
    // malformed origin — fall through to deny
  }

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      // Do NOT throw here. Throwing yields a 500 with no CORS headers and floods
      // the logs on every rejected request (the "intermittent CORS errors" you
      // saw). Log once and signal "not allowed" — the response simply omits the
      // CORS headers and the browser blocks the read, which is the correct
      // behaviour for a disallowed origin.
      logger.warn(`CORS: rejected origin "${origin}" (allowlist CLIENT_URL=${env.CLIENT_URL})`);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isHealthPath(req.path),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use(compression());
app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: morganStream,
    skip: (req) => isHealthPath(req.path),
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Trust proxy for accurate IP behind load balancers
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// NOTE: No local static `/uploads` mount. All user uploads go straight to
// Cloudinary (see config/cloudinary.ts → uploadBufferToCloudinary). Serverless
// hosts (Vercel) have a read-only filesystem, so there is nothing to serve from
// disk and nothing is ever written locally.

// Health checks, exposed at two paths backed by the same router:
//   /health        — unversioned; for load balancers, Docker & uptime probes
//   /api/v1/health — versioned; what API clients (the frontend) probe, so the
//                    reachability check shares the same base URL as real calls
app.use('/health', healthRoutes);
app.use('/api/v1/health', healthRoutes);

// API Docs (available in all environments; restrict in prod via env if needed)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SaaS Dashboard API',
}));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// Routes (v1)
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/users', userRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export { logger };
export default app;
