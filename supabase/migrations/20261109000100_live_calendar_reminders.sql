-- Release 8: explicitly shared calendars and recipient-specific reminders.
-- Local workspace sync remains encrypted and unchanged. Only owner-published
-- calendar data is stored in these dedicated, member-readable tables.
create table if not exists public.shared_calendars(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null default 'Shared calendar' check(char_length(name) between 1 and 120),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists shared_calendars_owner_idx on public.shared_calendars(owner_id,updated_at desc);
create table if not exists public.calendar_memberships(
 calendar_id uuid not null references public.shared_calendars(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in('read_only','read_write')),
 invited_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(calendar_id,user_id)
);
create index if not exists calendar_memberships_user_idx on public.calendar_memberships(user_id,created_at desc);
create or replace function public.is_calendar_owner(p_calendar_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shared_calendars c where c.id=p_calendar_id and c.owner_id=(select auth.uid()));
$$;
create or replace function public.can_view_calendar(p_calendar_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_calendar_owner(p_calendar_id) or exists(select 1 from public.calendar_memberships m where m.calendar_id=p_calendar_id and m.user_id=(select auth.uid()));
$$;
create or replace function public.can_edit_calendar(p_calendar_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_calendar_owner(p_calendar_id) or exists(select 1 from public.calendar_memberships m where m.calendar_id=p_calendar_id and m.user_id=(select auth.uid()) and m.role='read_write');
$$;
revoke all on function public.is_calendar_owner(uuid) from public;
revoke all on function public.can_view_calendar(uuid) from public;
revoke all on function public.can_edit_calendar(uuid) from public;
grant execute on function public.is_calendar_owner(uuid) to authenticated,service_role;
grant execute on function public.can_view_calendar(uuid) to authenticated,service_role;
grant execute on function public.can_edit_calendar(uuid) to authenticated,service_role;
alter table public.shared_calendars enable row level security;
alter table public.calendar_memberships enable row level security;
drop policy if exists "Calendar members can view shared calendars" on public.shared_calendars;
create policy "Calendar members can view shared calendars" on public.shared_calendars for select to authenticated using(public.can_view_calendar(id));
drop policy if exists "Users create calendars they own" on public.shared_calendars;
create policy "Users create calendars they own" on public.shared_calendars for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists "Owners update calendars" on public.shared_calendars;
create policy "Owners update calendars" on public.shared_calendars for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
drop policy if exists "Owners delete calendars" on public.shared_calendars;
create policy "Owners delete calendars" on public.shared_calendars for delete to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "Owners and members can view memberships" on public.calendar_memberships;
create policy "Owners and members can view memberships" on public.calendar_memberships for select to authenticated using(public.can_view_calendar(calendar_id));
drop policy if exists "Only owners can add members" on public.calendar_memberships;
create policy "Only owners can add members" on public.calendar_memberships for insert to authenticated with check(public.is_calendar_owner(calendar_id) and invited_by=(select auth.uid()));
drop policy if exists "Only owners can change member roles" on public.calendar_memberships;
create policy "Only owners can change member roles" on public.calendar_memberships for update to authenticated using(public.is_calendar_owner(calendar_id)) with check(public.is_calendar_owner(calendar_id));
drop policy if exists "Only owners can revoke members" on public.calendar_memberships;
create policy "Only owners can revoke members" on public.calendar_memberships for delete to authenticated using(public.is_calendar_owner(calendar_id));

create table if not exists public.calendar_events(
 id uuid primary key default gen_random_uuid(),calendar_id uuid not null references public.shared_calendars(id) on delete cascade,
 created_by uuid not null references auth.users(id),source_local_event_id text,title text not null check(char_length(title) between 1 and 160),
 starts_at timestamptz not null,ends_at timestamptz not null,all_day boolean not null default false,
 location text not null default '' check(char_length(location)<=500),location_lat double precision,location_lng double precision,
 notes text not null default '' check(char_length(notes)<=4000),
 travel_minutes integer not null default 0 check(travel_minutes between 0 and 600),
 leave_alert_minutes integer default null check(leave_alert_minutes is null or leave_alert_minutes between 0 and 180),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at>starts_at),
 check((location_lat is null and location_lng is null) or(location_lat between -90 and 90 and location_lng between -180 and 180))
);
create index if not exists calendar_events_calendar_start_idx on public.calendar_events(calendar_id,starts_at);
create unique index if not exists calendar_events_local_source_idx on public.calendar_events(calendar_id,source_local_event_id);
create or replace function public.set_calendar_event_updated_at() returns trigger
language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end;$$;
drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function public.set_calendar_event_updated_at();
alter table public.calendar_events enable row level security;
drop policy if exists "Calendar members can view events" on public.calendar_events;
create policy "Calendar members can view events" on public.calendar_events for select to authenticated using(public.can_view_calendar(calendar_id));
drop policy if exists "Calendar editors can create events" on public.calendar_events;
create policy "Calendar editors can create events" on public.calendar_events for insert to authenticated with check(public.can_edit_calendar(calendar_id) and created_by=(select auth.uid()));
drop policy if exists "Calendar editors can update events" on public.calendar_events;
create policy "Calendar editors can update events" on public.calendar_events for update to authenticated using(public.can_edit_calendar(calendar_id)) with check(public.can_edit_calendar(calendar_id));
drop policy if exists "Calendar editors can delete events" on public.calendar_events;
create policy "Calendar editors can delete events" on public.calendar_events for delete to authenticated using(public.can_edit_calendar(calendar_id));

-- Invitation token hashes and delivery ledgers are intentionally service-role only.
create table if not exists public.calendar_invites(
 id uuid primary key default gen_random_uuid(),calendar_id uuid not null references public.shared_calendars(id) on delete cascade,
 invite_email text not null,role text not null check(role in('read_only','read_write')),token_hash text not null unique,
 invited_by uuid not null references auth.users(id),expires_at timestamptz not null,
 accepted_at timestamptz,accepted_by uuid references auth.users(id),created_at timestamptz not null default now()
);
alter table public.calendar_invites enable row level security;

create table if not exists public.calendar_event_guests(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.calendar_events(id) on delete cascade,
 display_name text not null default '' check(char_length(display_name)<=120),
 email text not null check(char_length(email)<=320),reminder_enabled boolean not null default true,
 reminder_minutes integer not null default 60 check(reminder_minutes between 0 and 10080),
 created_at timestamptz not null default now(),unique(event_id,email)
);
alter table public.calendar_event_guests enable row level security;
drop policy if exists "Calendar editors manage event guests" on public.calendar_event_guests;
create policy "Calendar editors manage event guests" on public.calendar_event_guests for all to authenticated
using(exists(select 1 from public.calendar_events e where e.id=event_id and public.can_edit_calendar(e.calendar_id)))
with check(exists(select 1 from public.calendar_events e where e.id=event_id and public.can_edit_calendar(e.calendar_id)));

create table if not exists public.calendar_notification_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 departure_reminders_enabled boolean not null default true,in_app_enabled boolean not null default true,
 web_push_enabled boolean not null default false,email_enabled boolean not null default false,
 whatsapp_enabled boolean not null default false,sms_enabled boolean not null default false,
 email_address text,phone_e164 text,whatsapp_e164 text,
 default_lead_minutes integer not null default 15 check(default_lead_minutes between 0 and 10080),
 updated_at timestamptz not null default now(),
 check(email_address is null or char_length(email_address)<=320),
 check(phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$'),
 check(whatsapp_e164 is null or whatsapp_e164 ~ '^[+][1-9][0-9]{7,14}$')
);
alter table public.calendar_notification_preferences enable row level security;
drop policy if exists "Users manage their notification preferences" on public.calendar_notification_preferences;
create policy "Users manage their notification preferences" on public.calendar_notification_preferences for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,p256dh text not null,auth_secret text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint)
);
alter table public.calendar_push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on public.calendar_push_subscriptions;
create policy "Users manage their own push subscriptions" on public.calendar_push_subscriptions for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_in_app_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid references public.calendar_events(id) on delete cascade,title text not null,body text not null,
 action_url text,read_at timestamptz,created_at timestamptz not null default now()
);
create index if not exists calendar_in_app_notifications_user_created_idx on public.calendar_in_app_notifications(user_id,created_at desc);
alter table public.calendar_in_app_notifications enable row level security;
drop policy if exists "Users read their in app notifications" on public.calendar_in_app_notifications;
create policy "Users read their in app notifications" on public.calendar_in_app_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Users update their notification read state" on public.calendar_in_app_notifications;
create policy "Users update their notification read state" on public.calendar_in_app_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_notification_deliveries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.calendar_events(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,recipient_key text not null default '',
 event_updated_at timestamptz not null,channel text not null check(channel in('in_app','web_push','email','whatsapp','sms','guest_email')),
 status text not null default 'queued' check(status in('queued','sent','failed','skipped')),
 provider_message_id text,error_code text,created_at timestamptz not null default now(),sent_at timestamptz
);
create unique index if not exists calendar_notification_delivery_once_idx
on public.calendar_notification_deliveries(event_id,user_id,event_updated_at,channel) where user_id is not null;
create unique index if not exists calendar_guest_delivery_once_idx
on public.calendar_notification_deliveries(event_id,recipient_key,event_updated_at,channel) where user_id is null;
alter table public.calendar_notification_deliveries enable row level security;
-- No client policies for invitations or delivery ledgers. Edge Functions use service role.
),
 check(whatsapp_e164 is null or whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);
alter table public.calendar_notification_preferences enable row level security;
drop policy if exists "Users manage their notification preferences" on public.calendar_notification_preferences;
create policy "Users manage their notification preferences" on public.calendar_notification_preferences for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,p256dh text not null,auth_secret text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint)
);
alter table public.calendar_push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on public.calendar_push_subscriptions;
create policy "Users manage their own push subscriptions" on public.calendar_push_subscriptions for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_in_app_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid references public.calendar_events(id) on delete cascade,title text not null,body text not null,
 action_url text,read_at timestamptz,created_at timestamptz not null default now()
);
create index if not exists calendar_in_app_notifications_user_created_idx on public.calendar_in_app_notifications(user_id,created_at desc);
alter table public.calendar_in_app_notifications enable row level security;
drop policy if exists "Users read their in app notifications" on public.calendar_in_app_notifications;
create policy "Users read their in app notifications" on public.calendar_in_app_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Users update their notification read state" on public.calendar_in_app_notifications;
create policy "Users update their notification read state" on public.calendar_in_app_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_notification_deliveries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.calendar_events(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,recipient_key text not null default '',
 event_updated_at timestamptz not null,channel text not null check(channel in('in_app','web_push','email','whatsapp','sms','guest_email')),
 status text not null default 'queued' check(status in('queued','sent','failed','skipped')),
 provider_message_id text,error_code text,created_at timestamptz not null default now(),sent_at timestamptz
);
create unique index if not exists calendar_notification_delivery_once_idx
on public.calendar_notification_deliveries(event_id,user_id,event_updated_at,channel) where user_id is not null;
create unique index if not exists calendar_guest_delivery_once_idx
on public.calendar_notification_deliveries(event_id,recipient_key,event_updated_at,channel) where user_id is null;
alter table public.calendar_notification_deliveries enable row level security;
-- No client policies for invitations or delivery ledgers. Edge Functions use service role.
)
);
alter table public.calendar_notification_preferences enable row level security;
drop policy if exists "Users manage their notification preferences" on public.calendar_notification_preferences;
create policy "Users manage their notification preferences" on public.calendar_notification_preferences for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,p256dh text not null,auth_secret text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint)
);
alter table public.calendar_push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on public.calendar_push_subscriptions;
create policy "Users manage their own push subscriptions" on public.calendar_push_subscriptions for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_in_app_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid references public.calendar_events(id) on delete cascade,title text not null,body text not null,
 action_url text,read_at timestamptz,created_at timestamptz not null default now()
);
create index if not exists calendar_in_app_notifications_user_created_idx on public.calendar_in_app_notifications(user_id,created_at desc);
alter table public.calendar_in_app_notifications enable row level security;
drop policy if exists "Users read their in app notifications" on public.calendar_in_app_notifications;
create policy "Users read their in app notifications" on public.calendar_in_app_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Users update their notification read state" on public.calendar_in_app_notifications;
create policy "Users update their notification read state" on public.calendar_in_app_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_notification_deliveries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.calendar_events(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,recipient_key text not null default '',
 event_updated_at timestamptz not null,channel text not null check(channel in('in_app','web_push','email','whatsapp','sms','guest_email')),
 status text not null default 'queued' check(status in('queued','sent','failed','skipped')),
 provider_message_id text,error_code text,created_at timestamptz not null default now(),sent_at timestamptz
);
create unique index if not exists calendar_notification_delivery_once_idx
on public.calendar_notification_deliveries(event_id,user_id,event_updated_at,channel) where user_id is not null;
create unique index if not exists calendar_guest_delivery_once_idx
on public.calendar_notification_deliveries(event_id,recipient_key,event_updated_at,channel) where user_id is null;
alter table public.calendar_notification_deliveries enable row level security;
-- No client policies for invitations or delivery ledgers. Edge Functions use service role.
),
 check(whatsapp_e164 is null or whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);
alter table public.calendar_notification_preferences enable row level security;
drop policy if exists "Users manage their notification preferences" on public.calendar_notification_preferences;
create policy "Users manage their notification preferences" on public.calendar_notification_preferences for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,p256dh text not null,auth_secret text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint)
);
alter table public.calendar_push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on public.calendar_push_subscriptions;
create policy "Users manage their own push subscriptions" on public.calendar_push_subscriptions for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_in_app_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid references public.calendar_events(id) on delete cascade,title text not null,body text not null,
 action_url text,read_at timestamptz,created_at timestamptz not null default now()
);
create index if not exists calendar_in_app_notifications_user_created_idx on public.calendar_in_app_notifications(user_id,created_at desc);
alter table public.calendar_in_app_notifications enable row level security;
drop policy if exists "Users read their in app notifications" on public.calendar_in_app_notifications;
create policy "Users read their in app notifications" on public.calendar_in_app_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Users update their notification read state" on public.calendar_in_app_notifications;
create policy "Users update their notification read state" on public.calendar_in_app_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.calendar_notification_deliveries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.calendar_events(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,recipient_key text not null default '',
 event_updated_at timestamptz not null,channel text not null check(channel in('in_app','web_push','email','whatsapp','sms','guest_email')),
 status text not null default 'queued' check(status in('queued','sent','failed','skipped')),
 provider_message_id text,error_code text,created_at timestamptz not null default now(),sent_at timestamptz
);
create unique index if not exists calendar_notification_delivery_once_idx
on public.calendar_notification_deliveries(event_id,user_id,event_updated_at,channel) where user_id is not null;
create unique index if not exists calendar_guest_delivery_once_idx
on public.calendar_notification_deliveries(event_id,recipient_key,event_updated_at,channel) where user_id is null;
alter table public.calendar_notification_deliveries enable row level security;
-- No client policies for invitations or delivery ledgers. Edge Functions use service role.

-- Enable realtime change delivery for live shared calendar updates where the
-- standard Supabase realtime publication is present.
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='calendar_events') then
  alter publication supabase_realtime add table public.calendar_events;
 end if;
end $$;
