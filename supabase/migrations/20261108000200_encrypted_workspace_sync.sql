-- Release 11: one encrypted, revisioned workspace record per cloud identity.
-- Plaintext workspace state and its encryption key never leave the browser.
create table if not exists public.encrypted_workspace_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  ciphertext text not null,
  salt text not null,
  nonce text not null,
  encryption_version smallint not null check (encryption_version > 0),
  kdf_iterations integer not null check (kdf_iterations >= 100000),
  schema_version integer not null check (schema_version > 0),
  payload_bytes bigint not null check (payload_bytes > 0 and payload_bytes <= 26214400),
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_encrypted_workspace_sync_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists encrypted_workspace_sync_set_updated_at on public.encrypted_workspace_sync;
create trigger encrypted_workspace_sync_set_updated_at
before update on public.encrypted_workspace_sync
for each row execute function public.set_encrypted_workspace_sync_updated_at();

create index if not exists encrypted_workspace_sync_updated_idx
on public.encrypted_workspace_sync (updated_at desc);

alter table public.encrypted_workspace_sync enable row level security;

drop policy if exists "Users can read their encrypted workspace" on public.encrypted_workspace_sync;
create policy "Users can read their encrypted workspace"
on public.encrypted_workspace_sync for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their encrypted workspace" on public.encrypted_workspace_sync;
create policy "Users can create their encrypted workspace"
on public.encrypted_workspace_sync for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their encrypted workspace" on public.encrypted_workspace_sync;
create policy "Users can update their encrypted workspace"
on public.encrypted_workspace_sync for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- No delete policy: replace the encrypted record through a revision-checked update.
-- The browser client uses optimistic concurrency on (user_id, revision).
