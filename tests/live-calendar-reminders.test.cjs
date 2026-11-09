const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('supabase/migrations/20261109000100_live_calendar_reminders.sql','utf8').toLowerCase();
test('live calendars are separate from encrypted workspace sync',()=>{for(const t of ['shared_calendars','calendar_memberships','calendar_events','calendar_invites','calendar_event_guests'])assert.match(sql,new RegExp('create table if not exists public\\.'+t));assert.equal(sql.includes('alter table public.encrypted_workspace_sync'),false);});
test('calendar RLS enforces owner-managed sharing and read/write roles',()=>{for(const s of ['enable row level security','function public.can_view_calendar','function public.can_edit_calendar',"m.role = 'read_write'",'only owners can add members','only owners can revoke members'])assert.ok(sql.includes(s),s);});
test('notification settings and idempotent per-recipient delivery ledger exist',()=>{for(const t of ['calendar_notification_preferences','calendar_push_subscriptions','calendar_in_app_notifications','calendar_notification_deliveries'])assert.ok(sql.includes('create table if not exists public.'+t));assert.match(sql,/calendar_notification_delivery_once_idx/);assert.match(sql,/calendar_guest_delivery_once_idx/);assert.match(sql,/recipient_key text not null/);});
test('event location and travel data have database constraints',()=>{assert.match(sql,/location_lat between -90 and 90/);assert.match(sql,/travel_minutes between 0 and 600/);assert.match(sql,/leave_alert_minutes is null or leave_alert_minutes between 0 and 180/);assert.match(sql,/calendar_events_local_source_idx/);});

test('migration is complete and does not contain the previous duplicated tail',()=>{
  for (const table of [
    'calendar_notification_preferences',
    'calendar_push_subscriptions',
    'calendar_in_app_notifications',
    'calendar_notification_deliveries'
  ]) {
    assert.equal(sql.split('create table if not exists public.' + table).length - 1, 1, table);
  }
  assert.equal(sql.includes('check(whatsapp_e164 is null or'),false);
  assert.ok(sql.includes('grant select, insert, update, delete on table'));
  assert.ok(sql.includes('alter publication supabase_realtime add table public.calendar_events;'));
});
