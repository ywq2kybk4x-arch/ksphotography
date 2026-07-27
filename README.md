# KS Photography — Contact-Free Delivery

A private photo-delivery website for candid vacation portraits. The photographer creates a unique gallery on a phone,
the guests scan its QR code, and no email address, phone number, account, or OTP is required.

## Workflow

1. Sign in at `/admin` and create an active shoot.
2. Tap **Show new QR code** on the phone.
3. Let the group scan the QR, then photograph the large four-character marker code as the final camera frame.
4. On a computer, drag up to 20 portraits from the SD card into the admin. Leave out the marker frame.
5. Select the portraits, assign them to the matching short code, review, and publish.
6. The guest's saved link changes from a waiting screen to the finished gallery. Originals and a ZIP remain available
   for three days after publication.

The secret URL is the gallery credential. Only a SHA-256 hash of its token is stored. Regenerating a link immediately
invalidates the previous one.

## Stack

- Next.js App Router
- Supabase Postgres and private Storage
- Vercel deployment and daily retention cron

## Setup

Copy `.env.example` to `.env.local` and configure the existing values. `NEXT_PUBLIC_SITE_URL` must be the public
production origin so newly generated QR links point to the deployed site.

Apply both migrations, in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_contact_free_delivery.sql`

Create these private Supabase Storage buckets:

- `private-originals`
- `private-previews`

Keep `public-portfolio` public for curated portfolio work.

Install and verify:

```bash
npm install
npm run typecheck
npm run build
```

## Required environment variables

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` (retained for legacy guest sessions during migration)
- `APP_SESSION_SECRET`
- `ADMIN_API_KEY`
- `ADMIN_DASHBOARD_PASSWORD`
- `CRON_SECRET`

The old email/OTP routes and tables remain temporarily so an existing deployment can be upgraded without destructive
data loss. They are no longer linked from the public experience.

## Privacy and retention

- Gallery URLs use 256-bit random tokens.
- Tokens are hashed before database storage.
- Originals and previews stay in private buckets and are exposed only through short-lived authorized routes.
- Publishing starts the three-day clock.
- `/api/cron/retention` marks expired galleries, removes their originals and previews, and disables all guest access.
- Vercel invokes the cleanup daily according to `vercel.json`; the route requires `Authorization: Bearer <CRON_SECRET>`.
