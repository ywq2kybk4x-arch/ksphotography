import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminRequest } from '@/lib/admin';
import { createAccessToken, createShortCode, hashAccessToken } from '@/lib/delivery';
import { getSiteUrl } from '@/lib/env';
import { jsonError } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase';
import { writeAuditLog } from '@/lib/audit';

const createSchema = z.object({
  eventId: z.string().uuid(),
  adminNote: z.string().max(240).optional()
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('delivery_galleries')
    .select('id, event_id, short_code, status, admin_note, first_opened_at, published_at, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return jsonError(`Unable to load galleries: ${error.message}`, 500);
  return NextResponse.json({ galleries: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid gallery payload', 422);

  const supabase = createAdminClient();
  const token = createAccessToken();
  let inserted: { id: string; short_code: string } | null = null;
  let lastError = 'Unable to create gallery';

  for (let attempt = 0; attempt < 8 && !inserted; attempt += 1) {
    const { data, error } = await supabase
      .from('delivery_galleries')
      .insert({
        event_id: parsed.data.eventId,
        short_code: createShortCode(),
        access_token_hash: hashAccessToken(token),
        admin_note: parsed.data.adminNote || null
      })
      .select('id, short_code')
      .single();
    if (data) inserted = data;
    if (error) lastError = error.message;
  }
  if (!inserted) return jsonError(lastError, 500);

  await writeAuditLog({
    actorType: 'admin',
    action: 'delivery_gallery_created',
    targetType: 'delivery_gallery',
    targetId: inserted.id,
    metadata: { shortCode: inserted.short_code }
  });

  const url = `${getSiteUrl().replace(/\/$/, '')}/g/${token}`;
  return NextResponse.json({ gallery: inserted, token, url }, { status: 201 });
}
