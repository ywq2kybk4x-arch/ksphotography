import { NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';

export function isAdminRequest(request: NextRequest): boolean {
  const key = request.headers.get('x-admin-api-key');
  return Boolean(key) && key === getEnv('ADMIN_API_KEY');
}

