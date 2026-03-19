import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/admin';
import { jsonError } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  location: z.string().max(120).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().default(false)
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return jsonError('Unauthorized', 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid event payload', 422);
  }

  const supabase = createAdminClient();
  const payload = parsed.data;
  if (payload.isActive) {
    await supabase.from('events').update({ is_active: false }).eq('is_active', true);
  }

  const { data, error } = await supabase
    .from('events')
    .upsert(
      {
        id: payload.id,
        title: payload.title,
        location: payload.location ?? null,
        starts_at: payload.startsAt ?? null,
        ends_at: payload.endsAt ?? null,
        is_active: payload.isActive
      },
      { onConflict: 'id' }
    )
    .select('id, title, is_active')
    .single();

  if (error || !data) {
    return jsonError(`Unable to save event: ${error?.message ?? 'unknown'}`, 500);
  }

  await writeAuditLog({
    actorType: 'admin',
    action: payload.id ? 'event_updated' : 'event_created',
    targetType: 'event',
    targetId: data.id,
    metadata: { isActive: data.is_active }
  });

  return NextResponse.json({ event: data });
}

