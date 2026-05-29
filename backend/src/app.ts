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
 * CORS origin check.
 *
 * Production: strict allowlist driven by CLIENT_URL (comma-separated list).
 *
 * Development: allowlist PLUS any localhost / 127.0.0.1 / [::1] origin on any
 * port. Without this, browsers hitting the dev server via 127.0.0.1 instead of
 * localhost, or on a non-default port (when 3000 is taken), get their preflight
 * silently blocked — surfacing on the frontend as the generic "Cannot reach
 * the server" because axios never sees a response.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  // Same-origin and non-browser callers (curl, Postman, health probes) — allow.
  if (!origin) return true;

  const allowed = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;

  if (!env.isProd) {
    try {
      const url = new URL(origin);
      const isLocalHost =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]' ||
        url.hostname === '::1';
      if (isLocalHost) return true;
    } catch {
      // malformed origin — fall through to deny
    }
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" not in allowlist (CLIENT_URL=${env.CLIENT_URL})`));
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
  skip: (req) => req.path === '/health',
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
    skip: (req) => req.path === '/health',
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

// Health (unversioned — consumed by load balancers & Docker)
app.use('/health', healthRoutes);

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
