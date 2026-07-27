'use client';

import { useCallback, useEffect, useState } from 'react';

type Photo = {
  id: string;
  title: string | null;
  filename: string | null;
  capturedAt: string | null;
  previewUrl: string;
  downloadUrl: string;
};
type Payload = {
  gallery?: {
    shortCode: string;
    status: 'draft' | 'published' | 'expired';
    expiresAt: string | null;
  };
  photos?: Photo[];
  error?: string;
};

export function GuestDeliveryGallery({ token }: { token: string }): React.ReactElement {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/g/${token}`, { cache: 'no-store' });
      const next = (await response.json()) as Payload;
      if (!response.ok) throw new Error(next.error ?? 'This gallery could not be found.');
      setPayload(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this gallery.');
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function downloadAll(): Promise<void> {
    setDownloading(true);
    try {
      const response = await fetch(`/api/g/${token}/download-all`);
      if (!response.ok) throw new Error('The ZIP could not be prepared. Try individual downloads.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `KS-Photography-${payload?.gallery?.shortCode ?? 'Gallery'}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  if (error) return <section className="delivery-state"><div className="error">{error}</div></section>;
  if (!payload?.gallery) return <section className="delivery-state"><p>Opening your private gallery…</p></section>;
  if (payload.gallery.status === 'expired') {
    return <section className="delivery-state"><span className="eyebrow">Gallery {payload.gallery.shortCode}</span><h1>This gallery has expired.</h1><p>For privacy, photos are removed three days after delivery.</p></section>;
  }
  if (payload.gallery.status === 'draft') {
    return <section className="delivery-state"><span className="eyebrow">You’re connected · {payload.gallery.shortCode}</span><h1>Your photos are on the way.</h1><p>Save this private link. This page checks automatically and your photos will appear here after they’re ready.</p><button className="button" onClick={() => void navigator.clipboard.writeText(window.location.href)}>Copy private link</button></section>;
  }

  return (
    <section className="section delivery-gallery">
      <div className="container">
        <div className="delivery-heading">
          <div><span className="eyebrow">Private gallery · {payload.gallery.shortCode}</span><h1>Your vacation photos</h1><p className="small">Available until {payload.gallery.expiresAt ? new Date(payload.gallery.expiresAt).toLocaleString() : '—'}</p></div>
          <button className="button primary" disabled={downloading || !payload.photos?.length} onClick={() => void downloadAll()}>{downloading ? 'Preparing ZIP…' : 'Download all'}</button>
        </div>
        <div className="delivery-photo-grid">
          {(payload.photos ?? []).map((photo) => (
            <article className="delivery-photo" key={photo.id}>
              <img src={photo.previewUrl} alt={photo.title ?? 'Your portrait'} />
              <a className="button" href={photo.downloadUrl}>Download original</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
