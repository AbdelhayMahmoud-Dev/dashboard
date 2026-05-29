/**
 * Vercel serverless entry point for the Express backend.
 *
 * Why this file exists (and why it lives in `api/`, not `src/`):
 *   Vercel's zero-config detection turns every file in the project's top-level
 *   `api/` directory into a serverless function (built individually by the
 *   @vercel/node runtime, which transpiles TS with esbuild — no type-check).
 *   With Root Directory = `backend` on Vercel, that directory is
 *   `backend/api/`, so this file becomes the single function that serves the
 *   whole API. The companion `backend/vercel.json` rewrites every incoming
 *   path to `/api`, so this one function handles all routes; Express then does
 *   its own internal routing off the original request URL (Vercel preserves it
 *   across the rewrite).
 *
 *   It is intentionally OUTSIDE `src/` so that `tsc` (the `build` script, whose
 *   tsconfig `include` is `src/**` with `rootDir: ./src`) never tries to emit
 *   it into `dist/` — this file is only ever consumed by the Vercel runtime,
 *   never by the long-running `node dist/server.js` process used elsewhere
 *   (local dev, Docker, Render).
 *
 * Connection reuse:
 *   Serverless invocations share process state while the instance stays warm.
 *   We connect to MongoDB once and cache the in-flight promise so concurrent
 *   and subsequent warm requests reuse the same connection instead of opening a
 *   new one per request (which would exhaust the Atlas connection pool). A
 *   dropped connection (readyState !== 1) transparently triggers a reconnect.
 *
 * Realtime caveat:
 *   Socket.IO / WebSockets do NOT work on Vercel serverless functions (no
 *   persistent process, no upgraded connection). Only the REST API is served
 *   here. Realtime features require a long-lived host (Render/Railway/Fly/a VM)
 *   running `npm start` (src/server.ts). See DEPLOYMENT.md.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import mongoose from 'mongoose';
import connectDB from '../src/config/db';
import { initMonitoring } from '../src/config/monitoring';
import app from '../src/app';

let dbConnection: Promise<void> | null = null;

// Initialise monitoring once per warm instance (no-op unless SENTRY_DSN is set).
const monitoringReady = initMonitoring().catch(() => {});

/**
 * Open the MongoDB connection once and reuse it across warm invocations.
 * If a previous attempt failed, the cached promise is cleared so the next
 * request can retry rather than reusing a rejected promise forever.
 */
function ensureDb(): Promise<void> {
  // Already connected on this warm instance — nothing to do.
  if (mongoose.connection.readyState === 1) return Promise.resolve();

  if (!dbConnection) {
    dbConnection = connectDB().catch((err) => {
      dbConnection = null; // allow a retry on the next invocation
      throw err;
    });
  }
  return dbConnection;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await monitoringReady;
    await ensureDb();
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({ success: false, message: 'Database connection failed' })
    );
    return;
  }

  // An Express application is itself a (req, res) request listener, so we can
  // hand the raw Node request/response straight to it.
  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(
    req,
    res
  );
}
