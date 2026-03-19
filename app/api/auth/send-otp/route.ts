import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { createOtpCode } from '@/lib/otp';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp, jsonError } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';
import { hashValue, normalizeContact } from '@/lib/security';
import { sendOtpEmail } from '@/lib/email';
import { getOtpExpiryMinutes } from '@/lib/env';

const schema = z.object({
  guestId: z.string().uuid(),
  email: z.string().email()
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!enforceRateLimit(`send-otp:${ip}`, 8, 60)) {
    return jsonError('Too many OTP requests', 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid OTP request', 422);
  }

  const supabase = createAdminClient();
  const { data: guest, error } = await supabase
    .from('guests')
    .select('id, contact_type, contact_value_masked, contact_value_hash')
    .eq('id', parsed.data.guestId)
    .single();

  if (error || !guest) {
    return jsonError('Guest not found', 404);
  }
  if (guest.contact_type !== 'email') {
    return jsonError('Only email delivery is supported', 422);
  }

  const normalizedEmail = normalizeContact('email', parsed.data.email);
  const suppliedHash = hashValue(normalizedEmail);
  if (suppliedHash !== guest.contact_value_hash) {
    return jsonError('Email does not match this guest claim', 403);
  }

  const code = await createOtpCode(guest.id);
  const emailResult = await sendOtpEmail({
    to: normalizedEmail,
    code,
    expiryMinutes: getOtpExpiryMinutes()
  });

  if (!emailResult.ok && process.env.NODE_ENV === 'production') {
    return jsonError(`Unable to deliver OTP email: ${emailResult.detail}`, 500);
  }

  await writeAuditLog({
    actorType: 'guest',
    actorId: guest.id,
    action: 'otp_sent',
    targetType: 'otp',
    targetId: guest.id
  });

  console.info(`[OTP] guest=${guest.id} email=${guest.contact_value_masked} code=${code}`);

  return NextResponse.json({
    ok: true,
    delivery: 'email',
    masked: guest.contact_value_masked,
    developmentCode: process.env.NODE_ENV === 'production' ? undefined : code,
    emailWarning: emailResult.ok ? undefined : emailResult.detail
  });
}
