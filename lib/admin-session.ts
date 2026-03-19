import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { signJwt, verifyJwt } from '@/lib/security';

export const ADMIN_COOKIE_NAME = 'ks_admin_session';

type AdminPayload = {
  role: 'admin';
  exp: number;
};

function getSecret(): string {
  return getEnv('APP_SESSION_SECRET');
}

export function createAdminSessionToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      role: 'admin',
      iat: now,
      exp: now + 7 * 24 * 60 * 60
    },
    getSecret()
  );
}

export function isValidAdminToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  const payload = verifyJwt(token, getSecret()) as Partial<AdminPayload> | null;
  return Boolean(payload && payload.role === 'admin' && typeof payload.exp === 'number');
}

export async function hasAdminSessionCookie(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export function setAdminSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.delete(ADMIN_COOKIE_NAME);
}

export function getAdminTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(ADMIN_COOKIE_NAME)?.value;
}

