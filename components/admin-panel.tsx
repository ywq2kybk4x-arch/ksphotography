'use client';

import { useCallback, useEffect, useState } from 'react';

type UploadResponse = {
  photoId: string;
  bucket: string;
  path: string;
  token: string;
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
  event_id: string;
};

type OverviewPhoto = {
  id: string;
  visibility: 'private' | 'public';
  created_at: string;
  event_id: string;
};

export function AdminPanel(): React.ReactElement {
  const [apiKey, setApiKey] = useState('');
  const [eventId, setEventId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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

  async function postJson(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': apiKey
      },
      body: JSON.stringify(body)
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(payload.error ?? 'Request failed');
    }
    return payload;
  }

  const loadOverview = useCallback(async (): Promise<void> => {
    if (!apiKey) {
      return;
    }

    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/overview', {
        method: 'GET',
        headers: {
          'x-admin-api-key': apiKey
        }
      });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin overview');
    } finally {
      setLoadingOverview(false);
    }
  }, [apiKey, eventId]);

  useEffect(() => {
    if (!apiKey) {
      return;
    }
    void loadOverview();
  }, [apiKey, loadOverview]);

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

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!photoFile || !eventId) {
      setError('Event ID and file are required.');
      return;
    }

    try {
      const payload = (await postJson('/api/admin/photos/upload', {
        eventId,
        filename: photoFile.name,
        contentType: photoFile.type || 'image/jpeg',
        visibility
      })) as UploadResponse;

      const uploadRes = await fetch(payload.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': photoFile.type || 'application/octet-stream',
          'x-upsert': 'false'
        },
        body: photoFile
      });
      if (!uploadRes.ok) {
        throw new Error('Signed upload failed');
      }
      setMessage(`Uploaded photo ${payload.photoId}`);
      setAssignPhotoId(payload.photoId);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
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

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="card">
        <h2>Admin API key</h2>
        <p className="small">All admin routes require this key in the request header.</p>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="x-admin-api-key" />
        <div className="actions">
          <button className="button" type="button" onClick={() => void loadOverview()} disabled={!apiKey || loadingOverview}>
            {loadingOverview ? 'Refreshing...' : 'Load Dashboard Data'}
          </button>
        </div>
        {activeEvent && (
          <div className="small" style={{ marginTop: '0.6rem' }}>
            Active event: <strong>{activeEvent.title}</strong> ({activeEvent.id})
          </div>
        )}
      </div>

      <form className="card stack" onSubmit={createEvent}>
        <h3>1) Create / Activate Event</h3>
        <input placeholder="Event title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
        <input placeholder="Location (optional)" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} />
        <button className="button primary" type="submit">
          Save Active Event
        </button>
      </form>

      <form className="card stack" onSubmit={uploadPhoto}>
        <h3>2) Upload Photo</h3>
        <input placeholder="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} required />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}>
          <option value="private">Private delivery photo</option>
          <option value="public">Public portfolio photo</option>
        </select>
        <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} required />
        <button className="button primary" type="submit">
          Initialize + Upload
        </button>
      </form>

      <form className="card stack" onSubmit={assignPhoto}>
        <h3>3) Assign Private Photo to Guest</h3>
        <p className="small">Tip: use the quick-pick lists below instead of manually copying IDs.</p>
        <input placeholder="Photo ID" value={assignPhotoId} onChange={(e) => setAssignPhotoId(e.target.value)} required />
        <input placeholder="Guest ID" value={assignGuestId} onChange={(e) => setAssignGuestId(e.target.value)} required />
        <button className="button primary" type="submit">
          Assign Photo
        </button>
      </form>

      <div className="card">
        <h3>Recent Guests</h3>
        <p className="small">Click one to fill Guest ID instantly.</p>
        {!recentGuests.length && <p className="small">No recent guests yet.</p>}
        <div className="quick-list">
          {recentGuests.map((guest) => (
            <div key={guest.id} className="quick-item">
              <div>
                <strong>{guest.contact_value_masked}</strong>
                <div className="small">
                  {new Date(guest.created_at).toLocaleString()} • {guest.id}
                </div>
              </div>
              <button className="button" type="button" onClick={() => setAssignGuestId(guest.id)}>
                Use Guest
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Recent Photos</h3>
        <p className="small">Click one to fill Photo ID instantly.</p>
        {!recentPhotos.length && <p className="small">No recent uploads yet.</p>}
        <div className="quick-list">
          {recentPhotos.map((photo) => (
            <div key={photo.id} className="quick-item">
              <div>
                <strong>{photo.visibility === 'private' ? 'Private delivery photo' : 'Public portfolio photo'}</strong>
                <div className="small">
                  {new Date(photo.created_at).toLocaleString()} • {photo.id}
                </div>
              </div>
              <button className="button" type="button" onClick={() => setAssignPhotoId(photo.id)}>
                Use Photo
              </button>
            </div>
          ))}
        </div>
      </div>

      <form className="card stack" onSubmit={saveTipConfig}>
        <h3>4) Venmo Tip Configuration</h3>
        <input value={venmoUsername} onChange={(e) => setVenmoUsername(e.target.value)} required />
        <button className="button primary" type="submit">
          Save Venmo Settings
        </button>
      </form>

      {message && <div className="status">{message}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
