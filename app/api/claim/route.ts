import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { ContactType } from '@/lib/types';
import { hashValue, normalizeContact } from '@/lib/security';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp, jsonError } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  contactValue: z.string().email().max(254),
  consentAccepted: z.literal(true),
  policyVersion: z.string().min(1).max(64),
  name: z.string().max(120).optional()
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!enforceRateLimit(`claim:${ip}`, 20, 60)) {
    return jsonError('Too many requests', 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid claim payload', 422);
  }

  const { contactValue, policyVersion, name } = parsed.data;
  const contactType: ContactType = 'email';
  const normalized = normalizeContact(contactType, contactValue);
  const contactHash = hashValue(normalized);
  const userAgentHash = hashValue(request.headers.get('user-agent') ?? '');

  const supabase = createAdminClient();
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError || !eventRow) {
    return jsonError('No active event is available', 409);
  }

  const payload = {
    event_id: eventRow.id,
    name_optional: name ?? null,
    contact_type: contactType,
    contact_value_hash: contactHash,
    contact_value_masked: maskContact(normalized),
    consent_at: new Date().toISOString(),
    policy_version: policyVersion
  };

  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .upsert(payload, { onConflict: 'event_id,contact_type,contact_value_hash' })
    .select('id, event_id')
    .single();

  if (guestError || !guest) {
    return jsonError(`Unable to create guest claim: ${guestError?.message ?? 'unknown'}`, 500);
  }

  const { error: claimError } = await supabase.from('claims').insert({
    guest_id: guest.id,
    ip_hash: hashValue(ip),
    user_agent_hash: userAgentHash
  });

  if (claimError) {
    return jsonError(`Unable to log claim: ${claimError.message}`, 500);
  }

  await writeAuditLog({
    actorType: 'guest',
    actorId: guest.id,
    action: 'claim_created',
    targetType: 'guest',
    targetId: guest.id,
    metadata: { eventId: guest.event_id, contactType }
  });

  return NextResponse.json({
    guestId: guest.id,
    eventId: guest.event_id,
    contactType,
    contact: normalized
  });
}

function maskContact(value: string): string {
  const [user, domain] = value.split('@');
  if (!user || !domain) {
    return '***';
  }
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}
