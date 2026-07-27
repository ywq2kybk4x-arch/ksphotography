create table if not exists delivery_galleries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  short_code text not null unique,
  access_token_hash text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'expired')),
  admin_note text,
  first_opened_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table photo_assets add column if not exists preview_path text;
alter table photo_assets add column if not exists original_filename text;

create table if not exists gallery_photo_assignments (
  gallery_id uuid not null references delivery_galleries(id) on delete cascade,
  photo_id uuid not null references photo_assets(id) on delete cascade,
  sort_order integer not null default 0,
  assigned_at timestamptz not null default now(),
  primary key (gallery_id, photo_id),
  unique (photo_id)
);

create index if not exists idx_delivery_galleries_event on delivery_galleries(event_id, created_at desc);
create index if not exists idx_delivery_galleries_token on delivery_galleries(access_token_hash);
create index if not exists idx_delivery_galleries_expiry on delivery_galleries(expires_at)
  where status = 'published';
create index if not exists idx_gallery_assignments_gallery on gallery_photo_assignments(gallery_id, sort_order);

drop trigger if exists trg_delivery_galleries_updated_at on delivery_galleries;
create trigger trg_delivery_galleries_updated_at
before update on delivery_galleries
for each row execute procedure set_updated_at();

alter table delivery_galleries enable row level security;
alter table gallery_photo_assignments enable row level security;

-- All access is intentionally mediated by server routes. The service-role client
-- performs authorization after hashing and resolving the secret URL token.
