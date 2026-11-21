const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS", "access-control-allow-headers": "authorization, content-type" };
const response = (body, status=200) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors } });
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function cleanEvents(input) {
  if (!Array.isArray(input) || input.length > 2000) throw new Error("A shared calendar can contain up to 2,000 events.");
  return input.map(e => {
    const start = new Date(e.startAt), end = new Date(e.endAt);
    const title = String(e.title || "").trim();
    if (!title || title.length > 160 || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error("An event has invalid title or dates.");
    return { id: String(e.id || crypto.randomUUID()).slice(0,100), title, startAt: start.toISOString(), endAt: end.toISOString(), allDay: !!e.allDay, location: String(e.location || "").slice(0,300), description: String(e.description || "").slice(0,1000), updatedAt: new Date().toISOString() };
  });
}
export default {
 async fetch(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!env.CALENDAR_SHARES) return response({ error: "KV binding CALENDAR_SHARES is not configured." }, 503);
  const url = new URL(request.url), match = url.pathname.match(/^\\/calendar\\/([a-zA-Z0-9_-]{12,80})$/);
  if (!match) return response({ error: "Not found." }, 404);
  const id = match[1], key = "calendar:" + id;
  const auth = (request.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
  if (!auth || auth.length < 24 || auth.length > 200) return response({ error: "A valid share key is required." }, 401);
  const tokenHash = await digest(auth);
  if (request.method === "PUT") {
    let body; try { body = await request.json(); } catch { return response({ error: "Invalid JSON." }, 400); }
    if (!body || typeof body.ownerHash !== "string" || body.ownerHash !== tokenHash) return response({ error: "Only the calendar owner can update this feed." }, 403);
    let existing = await env.CALENDAR_SHARES.get(key, "json");
    if (!existing) {
      if (body.create !== true || typeof body.readHash !== "string") return response({ error: "Share does not exist." }, 404);
      existing = { ownerHash: tokenHash, readHash: body.readHash, title: String(body.title || "Shared calendar").slice(0,100), events: [], updatedAt: new Date().toISOString() };
    } else if (existing.ownerHash !== tokenHash) return response({ error: "Owner key is invalid." }, 403);
    try { existing.events = cleanEvents(body.events); } catch (e) { return response({ error: e.message }, 400); }
    existing.title = String(body.title || existing.title || "Shared calendar").slice(0,100);
    existing.updatedAt = new Date().toISOString();
    await env.CALENDAR_SHARES.put(key, JSON.stringify(existing));
    return response({ ok: true, updatedAt: existing.updatedAt, eventCount: existing.events.length });
  }
  if (request.method === "GET") {
    const data = await env.CALENDAR_SHARES.get(key, "json");
    if (!data) return response({ error: "This shared calendar is no longer available." }, 404);
    if (data.readHash !== tokenHash) return response({ error: "Share link is invalid or has been revoked." }, 403);
    return response({ id, title: data.title, events: data.events, updatedAt: data.updatedAt });
  }
  if (request.method === "DELETE") {
    const data = await env.CALENDAR_SHARES.get(key, "json");
    if (!data) return response({ ok: true });
    if (data.ownerHash !== tokenHash) return response({ error: "Only the owner can revoke this link." }, 403);
    await env.CALENDAR_SHARES.delete(key);
    return response({ ok: true });
  }
  return response({ error: "Method not allowed." }, 405);
 }
};
