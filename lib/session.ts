import { cookies } from 'next/headers';
import { getEnv } from '@/lib/env';
import { signJwt, verifyJwt } from '@/lib/security';
import { GuestSession } from '@/lib/types';

export const GUEST_COOKIE_NAME = 'ks_guest_session';

export function createGuestSessionToken(guestId: string, eventId: string): string {
  const secret = getEnv('APP_SESSION_SECRET');
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      guestId,
      eventId,
      iat: now,
      exp: now + 7 * 24 * 60 * 60
    },
    secret
  );
}

export async function setGuestSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60
  });
}

export async function clearGuestSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_COOKIE_NAME);
}

export async function getGuestSessionFromCookie(): Promise<GuestSession | null> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = verifyJwt(token, getEnv('APP_SESSION_SECRET'));
  if (!payload) {
    return null;
  }

  if (typeof payload.guestId !== 'string' || typeof payload.eventId !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }

  return {
    guestId: payload.guestId,
    eventId: payload.eventId,
    exp: payload.exp
  };
}

