'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type UploadResponse = {
  photoId: string;
  signedUrl: string;
};

type ActiveEvent = {
  id: string;
  title: string;
  location: string | null;
};

type OverviewGuest = {
  id: string;
  contact_value_masked: string;
  created_at: string;
};

type OverviewPhoto = {
  id: string;
  visibility: 'private' | 'public';
  created_at: string;
};

type UploadQueueItem = {
  localId: string;
  file: File;
  previewUrl: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'failed';
  photoId?: string;
  note?: string;
};

type StatCardProps = {
  label: string;
  value: string;
  tone?: 'default' | 'ok' | 'warn';
};

function StatCard({ label, value, tone = 'default' }: StatCardProps): React.ReactElement {
  return (
    <article className={`admin-stat admin-stat-${tone}`}>
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
    </article>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.ReactElement {
  return (
    <div className="admin-empty">
      <strong>{title}</strong>
      <p className="small">{description}</p>
      {actionLabel && onAction && (
        <button className="button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <article className="admin-card elevated">
      <div className="admin-section-head">
        <h3>{title}</h3>
        {subtitle && <p className="small">{subtitle}</p>}
      </div>
      {children}
    </article>
  );
}

export function AdminPanel(): React.ReactElement {
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [eventId, setEventId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [assignPhotoId, setAssignPhotoId] = useState('');
  const [assignGuestId, setAssignGuestId] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('ksphotography');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [recentGuests, setRecentGuests] = useState<OverviewGuest[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<OverviewPhoto[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [bulkGuestId, setBulkGuestId] = useState('');
  const [bulkPhotoIds, setBulkPhotoIds] = useState<string[]>([]);

  async function postJson(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(payload.error ?? 'Request failed');
    }
    return payload;
  }

  const loadOverview = useCallback(async (): Promise<void> => {
    setLoadingOverview(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overview', { method: 'GET' });
      const payload = (await res.json()) as {
        error?: string;
        activeEvent?: ActiveEvent | null;
        recentGuests?: OverviewGuest[];
        recentPhotos?: OverviewPhoto[];
      };
      if (!res.ok) {
        throw new Error(payload.error ?? 'Unable to load admin overview');
      }

      setActiveEvent(payload.activeEvent ?? null);
      setRecentGuests(payload.recentGuests ?? []);
      setRecentPhotos(payload.recentPhotos ?? []);
      if (!eventId && payload.activeEvent?.id) {
        setEventId(payload.activeEvent.id);
      }
      setHasLoadedData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin overview');
    } finally {
      setLoadingOverview(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function signOut(): Promise<void> {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  const privateRecentPhotos = useMemo(
    () => recentPhotos.filter((photo) => photo.visibility === 'private'),
    [recentPhotos]
  );

  const uploadQueueCount = uploadQueue.length;
  const dataStatus = hasLoadedData ? 'Loaded' : 'Not Loaded';
  const uploadReadiness = eventId && uploadQueueCount > 0 ? 'Ready to upload' : 'Needs setup';

  const filteredGuests = useMemo(() => {
    const query = guestSearch.trim().toLowerCase();
    if (!query) {
      return recentGuests;
    }
    return recentGuests.filter(
      (guest) =>
        guest.contact_value_masked.toLowerCase().includes(query) ||
        guest.id.toLowerCase().includes(query)
    );
  }, [guestSearch, recentGuests]);

  function addFiles(files: File[]): void {
    if (!files.length) {
      return;
    }
    setUploadQueue((current) => {
      const existing = new Set(current.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
      const additions = files
        .filter((file) => file.type.startsWith('image/'))
        .filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`))
        .map((file) => ({
          localId: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'queued' as const
        }));
      return [...current, ...additions];
    });
  }

  function clearQueue(): void {
    uploadQueue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setUploadQueue([]);
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const payload = (await postJson('/api/admin/events', {
        id: eventId || undefined,
        title: eventTitle,
        location: eventLocation || undefined,
        isActive: true
      })) as { event: { id: string } };
      setEventId(payload.event.id);
      setMessage(`Active event saved: ${payload.event.id}`);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating event');
    }
  }

  async function uploadQueuedPhotos(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!eventId) {
      setError('Create or load an active event first.');
      return;
    }
    const pending = uploadQueue.filter((item) => item.status === 'queued' || item.status === 'failed');
    if (!pending.length) {
      setError('Add at least one image to the queue.');
      return;
    }

    setUploading(true);
    for (const item of pending) {
      setUploadQueue((rows) =>
        rows.map((row) => (row.localId === item.localId ? { ...row, status: 'uploading', note: undefined } : row))
      );

      try {
        const payload = (await postJson('/api/admin/photos/upload', {
          eventId,
          filename: item.file.name,
          contentType: item.file.type || 'image/jpeg',
          visibility,
          title: item.file.name.replace(/\.[^.]+$/, '')
        })) as UploadResponse;

        const uploadRes = await fetch(payload.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': item.file.type || 'application/octet-stream',
            'x-upsert': 'false'
          },
          body: item.file
        });
        if (!uploadRes.ok) {
          throw new Error('Signed upload failed');
        }

        let note = 'Uploaded';
        if (visibility === 'private' && assignGuestId) {
          await postJson('/api/admin/assignments', {
            photoId: payload.photoId,
            guestId: assignGuestId,
            action: 'assign'
          });
          note = 'Uploaded + assigned';
        }

        setAssignPhotoId(payload.photoId);
        setUploadQueue((rows) =>
          rows.map((row) =>
            row.localId === item.localId ? { ...row, status: 'uploaded', photoId: payload.photoId, note } : row
          )
        );
      } catch (err) {
        setUploadQueue((rows) =>
          rows.map((row) =>
            row.localId === item.localId
              ? { ...row, status: 'failed', note: err instanceof Error ? err.message : 'Upload failed' }
              : row
          )
        );
      }
    }
    setUploading(false);
    setMessage('Upload complete. Review statuses below.');
    await loadOverview();
  }

  async function assignPhoto(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await postJson('/api/admin/assignments', {
        photoId: assignPhotoId,
        guestId: assignGuestId,
        action: 'assign'
      });
      setMessage('Photo assignment saved.');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    }
  }

  async function assignSelectedPhotos(): Promise<void> {
    setError(null);
    setMessage(null);
    if (!bulkGuestId || !bulkPhotoIds.length) {
      setError('Select a guest and at least one photo.');
      return;
    }

    try {
      for (const photoId of bulkPhotoIds) {
        await postJson('/api/admin/assignments', { photoId, guestId: bulkGuestId, action: 'assign' });
      }
      setMessage(`Assigned ${bulkPhotoIds.length} photo(s).`);
      setBulkPhotoIds([]);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assignment failed');
    }
  }

  async function saveTipConfig(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await postJson('/api/admin/tip-config', { venmoUsername });
      setMessage('Tip settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tip config failed');
    }
  }

  function toggleBulkPhoto(photoId: string): void {
    setBulkPhotoIds((current) => (current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]));
  }

  return (
    <div className="admin-shell">
      <section className="admin-top">
        <div className="admin-title-wrap">
          <h2>Studio Control Center</h2>
          <p>Run your whole client-delivery workflow here: event setup, drag-drop uploads, and secure assignments.</p>
        </div>
        <div className="admin-stats-grid">
          <StatCard
            label="Active Event"
            value={activeEvent ? activeEvent.title : 'None'}
            tone={activeEvent ? 'ok' : 'warn'}
          />
          <StatCard label="Guest Count" value={String(recentGuests.length)} />
          <StatCard label="Recent Photos" value={String(recentPhotos.length)} />
          <StatCard label="Upload Queue" value={String(uploadQueueCount)} />
          <StatCard label="Admin Data" value={dataStatus} tone={hasLoadedData ? 'ok' : 'warn'} />
          <StatCard label="Upload Status" value={uploadReadiness} tone={uploadReadiness === 'Ready to upload' ? 'ok' : 'warn'} />
        </div>
      </section>

      <section className="admin-grid">
        <div className="admin-main">
          <SectionCard
            title="Event Management"
            subtitle="Create a new active event or switch to another event. Active event controls where new uploads go."
          >
            {!activeEvent ? (
              <EmptyState
                title="No active event set"
                description="Create one now so uploads and guest claims are tied to the right trip/session."
              />
            ) : (
              <div className="admin-inline-banner">
                <div>
                  <strong>{activeEvent.title}</strong>
                  <div className="small">
                    {activeEvent.location ? `${activeEvent.location} • ` : ''}Event ID: {activeEvent.id}
                  </div>
                </div>
                <span className="status-chip">Active</span>
              </div>
            )}
            <form className="stack" onSubmit={createEvent}>
              <input placeholder="Event title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
              <input placeholder="Location (optional)" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} />
              <button className="button primary" type="submit">
                Save Active Event
              </button>
            </form>
          </SectionCard>

          <SectionCard
            title="Upload Photos"
            subtitle="Drag and drop images as your primary flow. This is the fastest way to deliver galleries."
          >
            <div className="admin-toolbar">
              <button className="button" type="button" onClick={() => (window.location.href = 'photos://')}>
                Open Apple Photos
              </button>
              <label className="button upload-select">
                Choose Images
                <input hidden multiple type="file" accept="image/*" onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
              </label>
            </div>
            <form className="stack" onSubmit={uploadQueuedPhotos}>
              <div className="admin-row-two">
                <input placeholder="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} required />
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}>
                  <option value="private">Private delivery photo</option>
                  <option value="public">Public portfolio photo</option>
                </select>
              </div>
              <label>
                Auto-assign guest (optional)
                <select value={assignGuestId} onChange={(e) => setAssignGuestId(e.target.value)}>
                  <option value="">No auto-assignment</option>
                  {recentGuests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.contact_value_masked} ({guest.id.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </label>
              <div
                className={`dropzone dropzone-large${isDragActive ? ' active' : ''}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                  addFiles(Array.from(e.dataTransfer.files ?? []));
                }}
              >
                <strong>Drop photos here</strong>
                <p className="small">
                  {uploadQueueCount
                    ? `${uploadQueueCount} file(s) in queue`
                    : 'No files in queue. Drop images here or click "Choose Images".'}
                </p>
              </div>

              <div className="upload-gallery">
                {!uploadQueue.length && (
                  <EmptyState
                    title="Queue is empty"
                    description="Add photos to queue, confirm event ID, then click Upload Queue."
                  />
                )}
                {uploadQueue.map((item) => (
                  <div className="upload-thumb" key={item.localId}>
                    <img src={item.previewUrl} alt={item.file.name} />
                    <div className="upload-meta">
                      <strong>{item.file.name}</strong>
                      <span className={`status-pill ${item.status}`}>
                        {item.status === 'queued' && 'Queued'}
                        {item.status === 'uploading' && 'Uploading'}
                        {item.status === 'uploaded' && 'Uploaded'}
                        {item.status === 'failed' && 'Failed'}
                      </span>
                      {item.note && <p className="small">{item.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="admin-toolbar">
                <button className="button primary" type="submit" disabled={uploading || !uploadQueue.length}>
                  {uploading ? 'Uploading...' : 'Upload Queue'}
                </button>
                <button className="button subtle-danger" type="button" onClick={clearQueue} disabled={uploading || !uploadQueue.length}>
                  Clear Queue
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Bulk Assign Private Photos"
            subtitle="Advanced: select multiple uploaded private photos and assign all to one guest."
          >
            <label>
              Target guest
              <select value={bulkGuestId} onChange={(e) => setBulkGuestId(e.target.value)}>
                <option value="">Select guest...</option>
                {recentGuests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.contact_value_masked}
                  </option>
                ))}
              </select>
            </label>
            <div className="bulk-list">
              {!privateRecentPhotos.length ? (
                <EmptyState title="No private photos yet" description="Upload private photos first, then bulk assign." />
              ) : (
                privateRecentPhotos.map((photo) => (
                  <label key={photo.id} className="bulk-row">
                    <input type="checkbox" checked={bulkPhotoIds.includes(photo.id)} onChange={() => toggleBulkPhoto(photo.id)} />
                    <span>{photo.id}</span>
                  </label>
                ))
              )}
            </div>
            <button className="button primary" type="button" onClick={() => void assignSelectedPhotos()}>
              Assign Selected Photos
            </button>
          </SectionCard>

          <SectionCard
            title="Single Photo Assignment"
            subtitle="Use this when you need a one-off correction or manual reassignment."
          >
            <form className="stack" onSubmit={assignPhoto}>
              <input placeholder="Photo ID" value={assignPhotoId} onChange={(e) => setAssignPhotoId(e.target.value)} required />
              <input placeholder="Guest ID" value={assignGuestId} onChange={(e) => setAssignGuestId(e.target.value)} required />
              <button className="button primary" type="submit">
                Assign Photo
              </button>
            </form>
          </SectionCard>
        </div>

        <aside className="admin-side">
          <SectionCard title="Admin Session" subtitle="You are authenticated. Refresh data or sign out here.">
            <button className="button" type="button" onClick={() => void loadOverview()} disabled={loadingOverview}>
              {loadingOverview ? 'Refreshing...' : 'Refresh Dashboard Data'}
            </button>
            <button className="button subtle-danger" type="button" onClick={() => void signOut()}>
              Sign Out
            </button>
          </SectionCard>

          <SectionCard title="Venmo Settings" subtitle="Set the username used in public and private tip prompts.">
            <form className="stack" onSubmit={saveTipConfig}>
              <input value={venmoUsername} onChange={(e) => setVenmoUsername(e.target.value)} required />
              <button className="button primary" type="submit">
                Save Venmo Settings
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Guests" subtitle="Search and quickly pick a guest for assignments.">
            <input
              placeholder="Search by masked email or guest id..."
              value={guestSearch}
              onChange={(e) => setGuestSearch(e.target.value)}
            />
            <div className="quick-list">
              {!filteredGuests.length ? (
                <EmptyState
                  title="No matching guests"
                  description={recentGuests.length ? 'Try a different search.' : 'Guests appear after claims are submitted.'}
                />
              ) : (
                filteredGuests.map((guest) => (
                  <div key={guest.id} className="quick-item">
                    <div>
                      <strong>{guest.contact_value_masked}</strong>
                      <div className="small">{new Date(guest.created_at).toLocaleString()}</div>
                      <div className="small">{guest.id}</div>
                    </div>
                    <button className="button" type="button" onClick={() => setAssignGuestId(guest.id)}>
                      Use Guest
                    </button>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Quick Actions">
            <div className="quick-action-list">
              <button className="button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Back to Top
              </button>
              <button className="button" type="button" onClick={() => setEventTitle('')}>
                Clear Event Title
              </button>
              <button className="button" type="button" onClick={() => setGuestSearch('')}>
                Clear Guest Search
              </button>
            </div>
          </SectionCard>
        </aside>
      </section>

      {message && <div className="status">{message}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
