import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getUserById } from '@/lib/mongodb/userService';

const SESSION_SECRET = process.env.SESSION_SECRET || 'filmanesia-auth-session-secret-key-2026';
export const SESSION_COOKIE_NAME = 'filmanesia_session';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export interface SessionPayload {
  userId: string;
  username: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed session token for a user.
 */
export function createSessionToken(user: { id: string; username: string; email: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 */
export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    // Timing-safe signature check
    if (signature.length !== expectedSignature.length) return null;
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) return null;

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8')
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    console.error('[auth/session] Token verification error:', err);
    return null;
  }
}

/**
 * Extracts and verifies the authenticated user from cookies/request headers.
 * Never relies on client-supplied userId.
 */
export async function getAuthenticatedUser(req?: NextRequest | Request) {
  try {
    let token: string | undefined;

    if (req) {
      // Check cookies header in request
      if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
        token = (req as any).cookies.get(SESSION_COOKIE_NAME)?.value;
      } else {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }
    }

    if (!token) {
      // Next.js server cookie store fallback
      try {
        const cookieStore = cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {}
    }

    if (!token) return null;

    const payload = verifySessionToken(token);
    if (!payload || !payload.userId) return null;

    const user = await getUserById(payload.userId);
    if (!user) return null;

    const fallbackAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.username)}`;

    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role || 'member',
      avatar: user.avatar || fallbackAvatar,
      watchlist: user.watchlist || [],
      history: user.history || [],
      createdAt: user.createdAt,
    };
  } catch (err) {
    console.warn('[auth/session] getAuthenticatedUser failed:', err);
    return null;
  }
}
