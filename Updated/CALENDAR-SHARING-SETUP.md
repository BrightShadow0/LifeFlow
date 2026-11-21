# LifeFlow optional live calendar relay

Snapshot sharing works directly in LifeFlow and does not need this service.

Live shared calendars use a small Cloudflare Worker with a KV namespace. Neither participant creates a LifeFlow account. Each shared calendar has separate owner and read-only keys. Only a SHA-256 hash of each key is stored by the Worker. The read key is carried in the share link fragment, which browsers do not send to the web server as part of the HTTP request.

## One-time setup

1. Create or sign in to a Cloudflare account.
2. Install Wrangler and authenticate it with `npx wrangler login`.
3. From the repository root, create the KV namespace:

   ```sh
   npx wrangler kv namespace create CALENDAR_SHARES
   ```

4. Copy the returned namespace ID into `Updated/wrangler.toml`, replacing `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.
5. Deploy the Worker:

   ```sh
   npx wrangler deploy --config Updated/wrangler.toml
   ```

6. Copy the deployed Worker URL, for example `https://lifeflow-calendar-share.<your-subdomain>.workers.dev`.
7. In LifeFlow, open Calendar, choose Share calendar, then Live sharing. Paste the Worker URL and save it.

## Sharing

- The owner creates a live link from LifeFlow and sends it to the recipient.
- When the recipient opens the link, LifeFlow automatically adds the shared calendar as read-only.
- The owner's browser republishes changes after a local event is saved or deleted.
- Subscribers refresh automatically about once a minute while LifeFlow is open, and can also refresh manually.
- The owner can also update or revoke the link from the live-sharing panel.
- Snapshot sharing remains available without Cloudflare.

## Privacy and limitations

- Shared calendars are public to anyone who has the read link. Treat it like a password and only send it to intended recipients.
- Do not include sensitive event details in a public link.
- Revoking deletes the feed from KV. Subscribers will no longer be able to refresh it.
- Live updates are not pushed instantly. The recipient refreshes the feed to see changes.
- This relay stores calendar event data. It is not an account system and does not sync private LifeFlow data.
