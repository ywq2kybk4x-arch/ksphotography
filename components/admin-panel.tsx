'use client';

import { useState } from 'react';

type UploadResponse = {
  photoId: string;
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
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
        <input placeholder="Photo ID" value={assignPhotoId} onChange={(e) => setAssignPhotoId(e.target.value)} required />
        <input placeholder="Guest ID" value={assignGuestId} onChange={(e) => setAssignGuestId(e.target.value)} required />
        <button className="button primary" type="submit">
          Assign Photo
        </button>
      </form>

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

