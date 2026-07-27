import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminRequest } from '@/lib/admin';
import { jsonError } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  galleryId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1).max(20),
  action: z.enum(['assign', 'remove']).default('assign')
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Select a gallery and 1–20 photos', 422);
  const { galleryId, photoIds, action } = parsed.data;
  const supabase = createAdminClient();

  const { data: gallery } = await supabase.from('delivery_galleries').select('status').eq('id', galleryId).single();
  if (!gallery) return jsonError('Gallery not found', 404);
  if (gallery.status !== 'draft') return jsonError('Published galleries cannot be edited', 409);

  const query = supabase.from('gallery_photo_assignments');
  const { error } =
    action === 'remove'
      ? await query.delete().eq('gallery_id', galleryId).in('photo_id', photoIds)
      : await query.upsert(
          photoIds.map((photoId, index) => ({ gallery_id: galleryId, photo_id: photoId, sort_order: index })),
          { onConflict: 'photo_id' }
        );
  if (error) return jsonError(`Unable to ${action} photos: ${error.message}`, 500);
  await writeAuditLog({
    actorType: 'admin',
    action: action === 'assign' ? 'gallery_photos_assigned' : 'gallery_photos_removed',
    targetType: 'delivery_gallery',
    targetId: galleryId,
    metadata: { photoIds }
  });
  return NextResponse.json({ ok: true });
}
