# KS Photography Private Delivery

Secure photo-delivery web app with:
- Public portfolio showcase
- QR claim flow
- OTP verification
- Private guest-specific galleries
- Admin dashboard for event/upload/assignment management
- Venmo tipping CTA
- Daily retention cleanup

## Stack
- Next.js 15 (App Router)
- Supabase (Postgres + Storage)
- Vercel deployment + cron

## 1) Environment

Copy `.env.example` to `.env.local` and set values:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `APP_SESSION_SECRET`
- `ADMIN_API_KEY`
- `CRON_SECRET`

## 2) Supabase Setup

1. Run SQL migration in Supabase SQL editor:
- `supabase/migrations/0001_init.sql`

2. Create storage buckets:
- `private-originals` (private)
- `public-portfolio` (public)

3. Ensure RLS stays enabled on:
- `guests`
- `photo_assets`
- `photo_assignments`
- `tip_config`

## 3) Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## 4) Main Flows

- Guest flow:
1. Visit `/claim` (your universal QR should point here)
2. Submit email + consent
3. Verify OTP at `/verify`
4. Access private gallery at `/gallery`

- Admin flow:
1. Open `/admin`
2. Enter `ADMIN_API_KEY`
3. Create/activate event
4. Upload photos (private/public)
5. Assign private photo IDs to guest IDs
6. Configure Venmo username

## 5) Retention

- Daily cron configured in `vercel.json` for `/api/cron/retention`
- Endpoint requires `Authorization: Bearer <CRON_SECRET>`
- Default private retention: 90 days (`RETENTION_DAYS`)

## 6) Security Notes

- Guest session is `httpOnly` cookie, signed with `APP_SESSION_SECRET`
- OTP codes are hashed at rest
- Contact values are hashed for lookup (`contact_value_hash`)
- Guest read access is constrained by guest-scoped token + RLS
- Admin APIs require `x-admin-api-key`
- Download links are short-lived signed URLs

## 7) Production Notes

- This project is configured for free-friendly email-only OTP flow (no SMS costs)
- Replace OTP console logging with a real email sender if needed (for example Resend free tier)
- Add bot protection (Turnstile/reCAPTCHA) on `/claim` and OTP endpoints
- Add an admin auth provider (Supabase Auth or SSO) instead of static API key in UI
- Add image thumbnails/previews for better gallery UX
