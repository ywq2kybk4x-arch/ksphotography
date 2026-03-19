import { NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { getAdminTokenFromRequest, isValidAdminToken } from '@/lib/admin-session';

export function isAdminRequest(request: NextRequest): boolean {
  const key = request.headers.get('x-admin-api-key');
  if (Boolean(key) && key === getEnv('ADMIN_API_KEY')) {
    return true;
  }

  return isValidAdminToken(getAdminTokenFromRequest(request));
}
