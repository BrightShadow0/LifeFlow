-- LifeFlow cloud foundation.
-- Stores account metadata and opaque encrypted backup payloads only.
-- Workspace encryption/decryption remains client-side. Never send plaintext workspace content here.

create extension if not exists pgcrypto;

create table if not exists public.account_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists account_profiles_set_updated_at on public.account_profiles;
create trigger account_profiles_set_updated_at
before update on public.account_profiles
for each row execute function public.set_updated_at();

alter table public.account_profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.account_profiles;
create policy "Users can read their own profile"
on public.account_profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.account_profiles;
create policy "Users can create their own profile"
on public.account_profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.account_profiles;
create policy "Users can update their own profile"
on public.account_profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create table if not exists public.encrypted_workspace_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  label text not null default 'Workspace backup',
  ciphertext text not null,
  nonce text not null,
  encryption_version smallint not null default 1 check (encryption_version > 0),
  workspace_schema_version integer not null default 1 check (workspace_schema_version > 0),
  payload_bytes bigint not null check (payload_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists encrypted_workspace_backups_user_created_idx
on public.encrypted_workspace_backups (user_id, created_at desc);

alter table public.encrypted_workspace_backups enable row level security;

drop policy if exists "Users can read their own encrypted backups" on public.encrypted_workspace_backups;
create policy "Users can read their own encrypted backups"
on public.encrypted_workspace_backups for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can upload their own encrypted backups" on public.encrypted_workspace_backups;
create policy "Users can upload their own encrypted backups"
on public.encrypted_workspace_backups for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own encrypted backups" on public.encrypted_workspace_backups;
create policy "Users can delete their own encrypted backups"
on public.encrypted_workspace_backups for delete
to authenticated
using ((select auth.uid()) = user_id);

-- No UPDATE policy: backups are immutable. Upload a new version instead.
-- RLS is the user-row isolation boundary; the service-role key is never used in browser code.
