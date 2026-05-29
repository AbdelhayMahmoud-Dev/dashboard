import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import User from '../models/User';

/**
 * End-to-end HTTP tests against the real Express app, backed by an in-memory
 * MongoDB. Exercises the auth lifecycle (register → login → me → refresh) and
 * the RBAC gate on an admin-only route. No mocks: this is the wiring the
 * frontend actually hits.
 */
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

const API = '/api/v1';
const creds = { name: 'Jane Doe', email: 'jane@example.com', password: 'Sup3rSecret!' };

function refreshCookieFrom(res: request.Response): string {
  const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  const cookie = cookies.find((c) => c.startsWith('refreshToken='));
  return cookie ? cookie.split(';')[0].split('=')[1] : '';
}

describe('POST /auth/register', () => {
  it('creates a viewer, returns an access token, and sets a refresh cookie', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(creds);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('viewer');
    expect(res.body.data.user.password).toBeUndefined();
    expect(refreshCookieFrom(res)).toBeTruthy();
  });

  it('stores only the SHA-256 hash of the refresh token, never the raw value', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(creds);
    const raw = refreshCookieFrom(res);

    const dbUser = await User.findOne({ email: creds.email }).select('+refreshToken');
    const expected = crypto.createHash('sha256').update(raw).digest('hex');

    expect(dbUser?.refreshToken).toBe(expected);
    expect(dbUser?.refreshToken).not.toBe(raw);
    expect(dbUser?.refreshToken).toHaveLength(64);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post(`${API}/auth/register`).send(creds);
    const res = await request(app).post(`${API}/auth/register`).send(creds);
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post(`${API}/auth/register`).send(creds);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: creds.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`${API}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid Bearer token', async () => {
    const reg = await request(app).post(`${API}/auth/register`).send(creds);
    const token = reg.body.data.accessToken;

    const res = await request(app).get(`${API}/auth/me`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(creds.email);
  });
});

describe('POST /auth/refresh-token', () => {
  it('issues a new access token from the refresh cookie (rotation)', async () => {
    const agent = request.agent(app);
    await agent.post(`${API}/auth/register`).send(creds);

    const res = await agent.post(`${API}/auth/refresh-token`).send();
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects when no refresh token is supplied', async () => {
    const res = await request(app).post(`${API}/auth/refresh-token`).send();
    expect(res.status).toBe(401);
  });
});

describe('RBAC on GET /users (admin only)', () => {
  async function tokenForRole(role: 'viewer' | 'admin', email: string): Promise<string> {
    await User.create({ name: 'X', email, password: 'Sup3rSecret!', role });
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email, password: 'Sup3rSecret!' });
    return res.body.data.accessToken;
  }

  it('forbids a viewer (403)', async () => {
    const token = await tokenForRole('viewer', 'viewer@example.com');
    const res = await request(app).get(`${API}/users`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin (200)', async () => {
    const token = await tokenForRole('admin', 'admin@example.com');
    const res = await request(app).get(`${API}/users`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
