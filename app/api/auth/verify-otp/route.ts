import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { verifyOtpCode } from '@/lib/otp';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp, jsonError } from '@/lib/http';
import { createGuestSessionToken, setGuestSessionCookie } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  guestId: z.string().uuid(),
  code: z.string().min(4).max(12)
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!enforceRateLimit(`verify-otp:${ip}`, 12, 60)) {
    return jsonError('Too many verification attempts', 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid verification payload', 422);
  }

  const { guestId, code } = parsed.data;
  const isValid = await verifyOtpCode(guestId, code);
  if (!isValid) {
    return jsonError('Invalid or expired code', 401);
  }

  const supabase = createAdminClient();
  const { data: guest, error } = await supabase
    .from('guests')
    .update({ access_state: 'verified', last_verified_at: new Date().toISOString() })
    .eq('id', guestId)
    .select('id, event_id')
    .single();

  if (error || !guest) {
    return jsonError('Unable to verify guest', 500);
  }

  const token = createGuestSessionToken(guest.id, guest.event_id);
  await setGuestSessionCookie(token);

  await writeAuditLog({
    actorType: 'guest',
    actorId: guest.id,
    action: 'otp_verified',
    targetType: 'guest',
    targetId: guest.id
  });

  return NextResponse.json({ ok: true });
}

