import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens';

describe('token generation', () => {
  it('signs an access token that verifies with JWT_SECRET and carries id + role', () => {
    const token = generateAccessToken('user-123', 'admin');
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      role: string;
    };
    expect(decoded.id).toBe('user-123');
    expect(decoded.role).toBe('admin');
  });

  it('signs a refresh token that verifies with JWT_REFRESH_SECRET and carries id only', () => {
    const token = generateRefreshToken('user-123');
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as {
      id: string;
      role?: string;
    };
    expect(decoded.id).toBe('user-123');
    expect(decoded.role).toBeUndefined();
  });

  it('does not verify an access token with the refresh secret (secrets are distinct)', () => {
    const token = generateAccessToken('user-123', 'admin');
    expect(() => jwt.verify(token, process.env.JWT_REFRESH_SECRET as string)).toThrow();
  });
});
