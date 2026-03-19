import { PublicPhoto } from '@/lib/types';

export function PublicPhotoGrid({ photos }: { photos: PublicPhoto[] }): React.ReactElement {
  if (!photos.length) {
    return <p className="small">No public photos yet. Upload portfolio images from Admin.</p>;
  }

  return (
    <div className="grid gallery-grid">
      {photos.map((photo) => (
        <article className="photo-card" key={photo.id}>
          <div className="placeholder" />
          <div className="photo-meta">
            <strong>{photo.title ?? 'Untitled photo'}</strong>
            <div className="small">
              {photo.captured_at ? new Date(photo.captured_at).toLocaleDateString() : 'Date unavailable'}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

