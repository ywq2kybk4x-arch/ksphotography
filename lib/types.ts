export type ContactType = 'email';
export type PhotoVisibility = 'private' | 'public';

export type GuestSession = {
  guestId: string;
  eventId: string;
  exp: number;
};

export type PublicPhoto = {
  id: string;
  title: string | null;
  storage_path: string;
  captured_at: string | null;
};
