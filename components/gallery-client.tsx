'use client';

import { useEffect, useState } from 'react';

type GalleryPhoto = {
  id: string;
  title: string | null;
  capturedAt: string | null;
  assignedAt: string;
};

export function GalleryClient(): React.ReactElement {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/gallery/me');
        const payload = (await res.json()) as { photos?: GalleryPhoto[]; expiresInDays?: number; error?: string };
        if (!res.ok) {
          throw new Error(payload.error ?? 'Unable to load gallery');
        }
        setPhotos(payload.photos ?? []);
        setRetentionDays(payload.expiresInDays ?? 90);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return <p className="small">Loading your gallery...</p>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <p className="small">
        Your gallery is available for {retentionDays} days from upload. Download originals anytime during that window.
      </p>
      {!photos.length && <p className="small">No assigned photos yet. Check back soon.</p>}
      <div className="grid gallery-grid">
        {photos.map((photo) => (
          <article className="photo-card" key={photo.id}>
            <div className="placeholder" />
            <div className="photo-meta">
              <strong>{photo.title ?? 'Untitled photo'}</strong>
              <div className="small">
                {photo.capturedAt ? new Date(photo.capturedAt).toLocaleDateString() : 'Capture date unavailable'}
              </div>
              <div className="actions">
                <a className="button" href={`/api/photos/${photo.id}/download`} target="_blank" rel="noreferrer">
                  View / Download
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

