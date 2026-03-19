create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name_optional text,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value_hash text not null,
  contact_value_masked text not null,
  consent_at timestamptz not null,
  policy_version text not null,
  access_state text not null default 'claimed' check (access_state in ('claimed', 'verified', 'blocked')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, contact_type, contact_value_hash)
);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  ip_hash text not null,
  user_agent_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists photo_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  storage_path text not null unique,
  checksum text,
  title text,
  captured_at timestamptz,
  visibility text not null check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists photo_assignments (
  photo_id uuid primary key references photo_assets(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  unique(photo_id),
  unique(photo_id, guest_id)
);

create table if not exists tip_config (
  id uuid primary key default gen_random_uuid(),
  venmo_username text not null,
  venmo_deeplink text not null,
  venmo_qr_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('admin', 'guest', 'system')),
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_active on events (is_active) where is_active = true;
create index if not exists idx_guests_event on guests (event_id);
create index if not exists idx_guests_contact on guests (contact_type, contact_value_hash);
create index if not exists idx_claims_guest on claims (guest_id);
create index if not exists idx_assets_event on photo_assets (event_id);
create index if not exists idx_assets_visibility on photo_assets (visibility);
create index if not exists idx_assignments_guest on photo_assignments (guest_id);
create index if not exists idx_otp_guest on otp_codes (guest_id, created_at desc);
create index if not exists idx_audit_created on audit_logs (created_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on events;
create trigger trg_events_updated_at
before update on events
for each row execute procedure set_updated_at();

drop trigger if exists trg_guests_updated_at on guests;
create trigger trg_guests_updated_at
before update on guests
for each row execute procedure set_updated_at();

drop trigger if exists trg_assets_updated_at on photo_assets;
create trigger trg_assets_updated_at
before update on photo_assets
for each row execute procedure set_updated_at();

drop trigger if exists trg_tip_updated_at on tip_config;
create trigger trg_tip_updated_at
before update on tip_config
for each row execute procedure set_updated_at();

alter table guests enable row level security;
alter table photo_assets enable row level security;
alter table photo_assignments enable row level security;
alter table tip_config enable row level security;

create policy "guest_can_read_self"
on guests
for select
using (id = (auth.jwt()->>'guest_id')::uuid);

create policy "guest_can_read_own_assignments"
on photo_assignments
for select
using (guest_id = (auth.jwt()->>'guest_id')::uuid);

create policy "guest_can_read_public_or_assigned_assets"
on photo_assets
for select
using (
  (visibility = 'public' and deleted_at is null)
  or
  exists (
    select 1
    from photo_assignments pa
    where pa.photo_id = photo_assets.id
      and pa.guest_id = (auth.jwt()->>'guest_id')::uuid
  )
);

create policy "public_can_read_tip_config"
on tip_config
for select
using (true);

