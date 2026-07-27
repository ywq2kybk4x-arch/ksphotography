import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import { jsonError } from '@/lib/http';

type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);
  const { id } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase.from('photo_assets').select('preview_path').eq('id', id).is('deleted_at', null).single();
  if (!data?.preview_path) return jsonError('Preview not found', 404);
  const { data: signed } = await supabase.storage.from('private-previews').createSignedUrl(data.preview_path, 60);
  if (!signed) return jsonError('Preview unavailable', 404);
  return NextResponse.redirect(signed.signedUrl, 302);
}
