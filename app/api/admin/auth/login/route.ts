import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { createAdminSessionToken, setAdminSessionCookie } from '@/lib/admin-session';

const schema = z.object({
  password: z.string().min(1)
});

function expectedPassword(): string {
  return process.env.ADMIN_DASHBOARD_PASSWORD ?? process.env.ADMIN_API_KEY ?? '';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid login payload', 422);
  }

  if (!expectedPassword()) {
    return jsonError('Admin password is not configured on the server', 500);
  }

  if (parsed.data.password !== expectedPassword()) {
    return jsonError('Invalid password', 401);
  }

  const response = NextResponse.json({ ok: true });
  setAdminSessionCookie(response, createAdminSessionToken());
  return response;
}

