import { createRequire } from 'module';
import type { Archiver } from 'archiver';
import { PassThrough, Readable } from 'stream';
import { resolveGalleryToken } from '@/lib/gallery-access';
import { createAdminClient } from '@/lib/supabase';
import { jsonError } from '@/lib/http';

export const runtime = 'nodejs';
type Params = { params: Promise<{ token: string }> };
const archiver = createRequire(import.meta.url)('archiver') as (
  format: 'zip',
  options: { zlib: { level: number } }
) => Archiver;

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const { token } = await params;
  const gallery = await resolveGalleryToken(token);
  if (!gallery || gallery.status !== 'published') return jsonError('Gallery not found', 404);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('gallery_photo_assignments')
    .select('sort_order, photo_assets!inner(storage_path, original_filename, deleted_at)')
    .eq('gallery_id', gallery.id)
    .is('photo_assets.deleted_at', null)
    .order('sort_order', { ascending: true })
    .limit(20);
  if (error || !data?.length) return jsonError('No photos are available', 404);

  const output = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.on('error', (error: Error) => output.destroy(error));
  archive.pipe(output);

  void (async () => {
    for (const row of data) {
      const asset = Array.isArray(row.photo_assets) ? row.photo_assets[0] : row.photo_assets;
      const { data: file, error: downloadError } = await supabase.storage.from('private-originals').download(asset.storage_path);
      if (downloadError || !file) throw downloadError ?? new Error('Download failed');
      archive.append(Buffer.from(await file.arrayBuffer()), { name: asset.original_filename || `photo-${row.sort_order + 1}.jpg` });
    }
    await archive.finalize();
  })().catch((error: unknown) => output.destroy(error instanceof Error ? error : new Error('ZIP failed')));

  return new Response(Readable.toWeb(output) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="KS-Photography-${gallery.short_code}.zip"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
