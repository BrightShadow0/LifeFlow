# LifeFlow Supabase services

## Release 8: live calendar sharing and reminders

Apply migrations in timestamp order with the Supabase CLI:

```sh
supabase db push
```

### Live calendars
- Owners create calendars and control access.
- `read_only` members can view; `read_write` members can edit event details and locations.
- Only owners can add members, change roles, or revoke access. Members cannot invite others.
- The invitation Edge Function stores only SHA-256 token hashes; links expire after seven days and can be accepted only by the signed-in account matching the invited email.
- Live calendar data is stored separately from the encrypted workspace sync record. Only events the owner explicitly publishes to a shared calendar are readable by its members. Do not assume these dedicated shared-calendar rows are end-to-end encrypted.
- The calendar-events table is added to Supabase Realtime when the standard publication exists.

### Deploy Edge Functions

```sh
supabase functions deploy calendar-invites
supabase functions deploy notify-calendar-guests
supabase functions deploy dispatch-calendar-reminders --no-verify-jwt
```

Set these Edge Function secrets in Supabase (never in browser assets or Git):

- Supabase-provided: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- App: `APP_ORIGIN`, `APP_BASE_URL`
- Email: `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `REMINDER_FROM_EMAIL`
- Scheduler: `REMINDER_CRON_SECRET`
- Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- WhatsApp Cloud API: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`
- Twilio SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`

Configure a Supabase Cron job or trusted scheduler to POST to `/functions/v1/dispatch-calendar-reminders` every minute with `Authorization: Bearer <REMINDER_CRON_SECRET>`. Do not expose that secret to the browser.

Email/WhatsApp/SMS/push remain unavailable until their provider credentials, sender identity, and compliance requirements are configured. WhatsApp reminders use an approved business-initiated message template; configure its exact approved name, language, and four body placeholders (event, time, location, Maps link). Push also requires HTTPS and the VAPID public key passed to `LifeFlowNotifications.enablePush(publicKey)`.

### Browser services
- `Updated/live-calendar.js`: owner/member/event/invitation operations and realtime event subscriptions.
- `Updated/calendar-notifications.js`: per-user channel preferences, push registration, and in-app notification feed.
- `/service-worker.js`: background push display and click-through.
- Existing local-only events and encrypted workspace sync are not silently uploaded. The owner must explicitly publish an event to a shared calendar.

### Current integration boundary
This release adds the database, RLS policies, Edge Functions, and browser service primitives. The interactive Calendar UI for creating shared calendars, managing the **Other Calendars** list, invitations, role changes, guest management, and channel preferences still needs to be wired to these services. The Supabase migration, Edge Function deployment, provider secrets, and scheduled invocation are external setup steps; this repository cannot apply them to the hosted Supabase project by itself.
