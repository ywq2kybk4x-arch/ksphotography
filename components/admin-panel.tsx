'use client';

import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ActiveEvent = { id: string; title: string; location: string | null };
type Gallery = {
  id: string; short_code: string; status: 'draft' | 'published' | 'expired'; admin_note: string | null;
  first_opened_at: string | null; published_at: string | null; expires_at: string | null; created_at: string;
};
type Photo = {
  id: string; title: string | null; original_filename: string | null; visibility: 'private' | 'public';
  captured_at: string | null; created_at: string; gallery_photo_assignments: { gallery_id: string }[];
};
type QueueItem = {
  id: string; file: File; previewUrl: string; status: 'queued' | 'uploading' | 'uploaded' | 'failed';
  photoId?: string; error?: string;
};
type CreatedGallery = { id: string; short_code: string; url: string; qr: string };

async function previewBlob(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create preview')), 'image/jpeg', 0.82)
  );
}

export function AdminPanel(): React.ReactElement {
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [targetGalleryId, setTargetGalleryId] = useState('');
  const [created, setCreated] = useState<CreatedGallery | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function json(path: string, options?: RequestInit): Promise<any> {
    const response = await fetch(path, options);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Request failed');
    return payload;
  }

  const refresh = useCallback(async () => {
    try {
      const payload = await json('/api/admin/overview');
      setActiveEvent(payload.activeEvent ?? null);
      setGalleries(payload.galleries ?? []);
      setPhotos(payload.recentPhotos ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load dashboard');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createEvent(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await json('/api/admin/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: eventTitle, location: eventLocation || undefined, isActive: true })
      });
      setEventTitle(''); setEventLocation(''); setMessage('Active shoot created.'); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create shoot'); }
  }

  async function createGallery(): Promise<void> {
    if (!activeEvent) { setError('Create an active shoot first.'); return; }
    setBusy(true); setError(null);
    try {
      const payload = await json('/api/admin/galleries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: activeEvent.id, adminNote: note || undefined })
      });
      const qr = await QRCode.toDataURL(payload.url, { width: 520, margin: 2, errorCorrectionLevel: 'M' });
      setCreated({ id: payload.gallery.id, short_code: payload.gallery.short_code, url: payload.url, qr });
      setTargetGalleryId(payload.gallery.id); setNote(''); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create gallery'); }
    finally { setBusy(false); }
  }

  function addFiles(files: File[]): void {
    const valid = files.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 20 - queue.length));
    setQueue((current) => [...current, ...valid.map((file) => ({
      id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: 'queued' as const
    }))]);
  }

  async function upload(): Promise<void> {
    if (!activeEvent) { setError('Create an active shoot first.'); return; }
    setBusy(true); setError(null);
    for (const item of queue.filter((row) => row.status === 'queued' || row.status === 'failed')) {
      setQueue((rows) => rows.map((row) => row.id === item.id ? { ...row, status: 'uploading', error: undefined } : row));
      try {
        const signed = await json('/api/admin/photos/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: activeEvent.id, filename: item.file.name, contentType: item.file.type || 'image/jpeg',
            previewContentType: 'image/jpeg', visibility: 'private',
            title: item.file.name.replace(/\.[^.]+$/, ''), capturedAt: new Date(item.file.lastModified).toISOString()
          })
        });
        const preview = await previewBlob(item.file);
        const [originalResponse, previewResponse] = await Promise.all([
          fetch(signed.signedUrl, { method: 'PUT', headers: { 'Content-Type': item.file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: item.file }),
          fetch(signed.previewSignedUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: preview })
        ]);
        if (!originalResponse.ok || !previewResponse.ok) throw new Error('Storage upload failed');
        setQueue((rows) => rows.map((row) => row.id === item.id ? { ...row, status: 'uploaded', photoId: signed.photoId } : row));
      } catch (caught) {
        setQueue((rows) => rows.map((row) => row.id === item.id ? { ...row, status: 'failed', error: caught instanceof Error ? caught.message : 'Upload failed' } : row));
      }
    }
    setBusy(false); setMessage('Upload finished. Select the portraits below and assign them to the matching code.'); await refresh();
  }

  async function assign(): Promise<void> {
    if (!targetGalleryId || !selectedPhotoIds.length) { setError('Choose a draft gallery and at least one portrait.'); return; }
    setBusy(true); setError(null);
    try {
      await json('/api/admin/gallery-assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId: targetGalleryId, photoIds: selectedPhotoIds, action: 'assign' })
      });
      setSelectedPhotoIds([]); setMessage('Photos assigned. Review the gallery, then publish it.'); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Assignment failed'); }
    finally { setBusy(false); }
  }

  async function publish(gallery: Gallery): Promise<void> {
    if (!window.confirm(`Publish gallery ${gallery.short_code}? Its three-day download window starts now.`)) return;
    setBusy(true); setError(null);
    try {
      await json(`/api/admin/galleries/${gallery.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' })
      });
      setMessage(`Gallery ${gallery.short_code} is live for three days.`); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Publish failed'); }
    finally { setBusy(false); }
  }

  async function regenerate(gallery: Gallery): Promise<void> {
    if (!window.confirm(`Replace the private link for ${gallery.short_code}? The old QR will stop working.`)) return;
    try {
      const payload = await json(`/api/admin/galleries/${gallery.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'regenerate' })
      });
      const qr = await QRCode.toDataURL(payload.url, { width: 520, margin: 2 });
      setCreated({ id: gallery.id, short_code: gallery.short_code, url: payload.url, qr });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not replace link'); }
  }

  const draftGalleries = galleries.filter((gallery) => gallery.status === 'draft');
  const selectedGallery = useMemo(() => galleries.find((gallery) => gallery.id === targetGalleryId), [galleries, targetGalleryId]);

  if (created) {
    return (
      <section className="phone-handoff">
        <button className="button" onClick={() => setCreated(null)}>← Back to dashboard</button>
        <div className="handoff-card">
          <span className="eyebrow">Private gallery ready</span>
          <div className="marker-code">{created.short_code}</div>
          <p>1. Let the guests scan this QR.<br />2. Photograph this screen with your camera as the group’s final frame.</p>
          <img className="qr-image" src={created.qr} alt={`QR code for gallery ${created.short_code}`} />
          <div className="handoff-actions">
            <button className="button primary" onClick={() => void navigator.clipboard.writeText(created.url)}>Copy private link</button>
            <a className="button" href={created.url} target="_blank" rel="noreferrer">Test guest view</a>
          </div>
          <p className="scan-status">{galleries.find((row) => row.id === created.id)?.first_opened_at ? '✓ Guest connected' : 'Waiting for guest to scan…'}</p>
          <button className="button" onClick={() => void refresh()}>Check scan</button>
        </div>
      </section>
    );
  }

  return (
    <div className="delivery-admin">
      <section className="admin-top">
        <div><span className="eyebrow">Contact-free delivery</span><h1>Photo handoff</h1><p>Create the QR on your phone. Upload, match, and publish from your computer.</p></div>
        <button className="button" onClick={() => void fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => location.href = '/admin/login')}>Sign out</button>
      </section>

      {!activeEvent ? (
        <form className="admin-card stack" onSubmit={createEvent}>
          <h2>Start a shoot</h2><p className="small">A shoot keeps today’s galleries and uploads together.</p>
          <input required placeholder="Shoot name (e.g. Rome · July 27)" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
          <input placeholder="Location (optional)" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
          <button className="button primary">Create active shoot</button>
        </form>
      ) : (
        <>
          <div className="active-shoot"><span><strong>{activeEvent.title}</strong>{activeEvent.location ? ` · ${activeEvent.location}` : ''}</span><span className="status-chip">Active shoot</span></div>
          <section className="workflow-grid">
            <article className="admin-card new-gallery-card">
              <span className="step-number">1</span><h2>New guest gallery</h2><p>Create this immediately after taking a group’s portraits.</p>
              <input placeholder="Private note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
              <button className="button primary large-button" disabled={busy} onClick={() => void createGallery()}>Show new QR code</button>
            </article>
            <article className="admin-card">
              <span className="step-number">2</span><h2>Upload from SD card</h2><p>Choose up to 20 portraits. Do not select the marker-code photo.</p>
              <label className="dropzone">
                <strong>Choose or drop photos</strong><span>{queue.length ? `${queue.length} selected` : 'JPEG, PNG, HEIC if supported by this browser'}</span>
                <input hidden type="file" accept="image/*" multiple onChange={(event) => addFiles(Array.from(event.target.files ?? []))} />
              </label>
              <div className="upload-gallery">{queue.map((item) => <div className="upload-thumb" key={item.id}><img src={item.previewUrl} alt="" /><span className={`status-pill ${item.status}`}>{item.status}</span>{item.error && <small>{item.error}</small>}</div>)}</div>
              <button className="button primary" disabled={busy || !queue.length} onClick={() => void upload()}>{busy ? 'Working…' : 'Upload photos'}</button>
            </article>
          </section>

          <section className="admin-card">
            <span className="step-number">3</span><h2>Match portraits to the marker code</h2>
            <div className="assignment-bar">
              <select value={targetGalleryId} onChange={(event) => setTargetGalleryId(event.target.value)}>
                <option value="">Choose draft gallery…</option>
                {draftGalleries.map((gallery) => <option key={gallery.id} value={gallery.id}>{gallery.short_code}{gallery.admin_note ? ` · ${gallery.admin_note}` : ''}</option>)}
              </select>
              <span>{selectedPhotoIds.length} selected</span>
              <button className="button primary" disabled={busy || !targetGalleryId || !selectedPhotoIds.length} onClick={() => void assign()}>Assign to {selectedGallery?.short_code ?? 'gallery'}</button>
            </div>
            <div className="admin-photo-grid">
              {photos.filter((photo) => photo.visibility === 'private').map((photo) => {
                const assigned = photo.gallery_photo_assignments?.[0]?.gallery_id;
                const selected = selectedPhotoIds.includes(photo.id);
                return <button type="button" className={`admin-photo-choice${selected ? ' selected' : ''}`} key={photo.id} disabled={Boolean(assigned)} onClick={() => setSelectedPhotoIds((ids) => ids.includes(photo.id) ? ids.filter((id) => id !== photo.id) : [...ids, photo.id])}><img src={`/api/admin/photos/${photo.id}/preview`} alt={photo.title ?? 'Uploaded portrait'} /><span>{assigned ? `Assigned to ${galleries.find((g) => g.id === assigned)?.short_code ?? 'gallery'}` : selected ? '✓ Selected' : photo.original_filename}</span></button>;
              })}
            </div>
          </section>

          <section className="admin-card">
            <span className="step-number">4</span><h2>Review and publish</h2>
            <div className="gallery-list">{galleries.map((gallery) => {
              const count = photos.filter((photo) => photo.gallery_photo_assignments?.some((assignment) => assignment.gallery_id === gallery.id)).length;
              return <article className="gallery-row" key={gallery.id}><div><strong className="gallery-code">{gallery.short_code}</strong><span className={`status-pill ${gallery.status}`}>{gallery.status}</span><p className="small">{gallery.admin_note || 'No private note'} · {count} photo{count === 1 ? '' : 's'}{gallery.first_opened_at ? ' · Guest connected' : ''}</p>{gallery.expires_at && <p className="small">Expires {new Date(gallery.expires_at).toLocaleString()}</p>}</div><div className="actions">{gallery.status === 'draft' && <button className="button primary" disabled={busy || count === 0} onClick={() => void publish(gallery)}>Publish</button>}<button className="button" onClick={() => void regenerate(gallery)}>Replace link</button></div></article>;
            })}</div>
          </section>
        </>
      )}
      {message && <div className="toast status">{message}</div>}{error && <div className="toast error">{error}</div>}
    </div>
  );
}
