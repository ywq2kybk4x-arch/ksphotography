import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/admin';
import { jsonError } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  photoId: z.string().uuid(),
  guestId: z.string().uuid(),
  action: z.enum(['assign', 'unassign']).default('assign')
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return jsonError('Unauthorized', 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid assignment payload', 422);
  }

  const supabase = createAdminClient();
  const { photoId, guestId, action } = parsed.data;

  if (action === 'unassign') {
    const { error } = await supabase
      .from('photo_assignments')
      .delete()
      .eq('photo_id', photoId)
      .eq('guest_id', guestId);
    if (error) {
      return jsonError(`Unable to unassign photo: ${error.message}`, 500);
    }
    await writeAuditLog({
      actorType: 'admin',
      action: 'photo_unassigned',
      targetType: 'photo_assignment',
      targetId: photoId,
      metadata: { guestId }
    });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from('photo_assignments')
    .upsert(
      {
        photo_id: photoId,
        guest_id: guestId,
        assigned_at: new Date().toISOString()
      },
      { onConflict: 'photo_id' }
    );

  if (error) {
    return jsonError(`Unable to assign photo: ${error.message}`, 500);
  }

  await writeAuditLog({
    actorType: 'admin',
    action: 'photo_assigned',
    targetType: 'photo_assignment',
    targetId: photoId,
    metadata: { guestId }
  });

  return NextResponse.json({ ok: true });
}

