/* ============================== cloud save (Supabase REST) ==============================
   Tiny durable backup layer on top of localStorage. Pure fetch, no SDK.
   Every call is wrapped so it NEVER throws into gameplay: on any network error,
   timeout, or bad response it resolves null/false and the game keeps running on
   localStorage offline. The anon key is the public/anon role — safe to embed. */

const SUPABASE_URL = 'https://qdpkuzvnxaatebdgbvmx.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcGt1enZueGFhdGViZGdidm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDY5MzksImV4cCI6MjA5Njc4MjkzOX0.JwlhKdAexzRd6cUzbGvXeaPZJRiFVQDeeunw7FnWhkE';

const BASE = `${SUPABASE_URL}/rest/v1/saves`;
const AUTH = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
const TIMEOUT_MS = 5000;

// fetch with an abort-based timeout; resolves the Response, or throws (caught by callers)
async function timedFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Read the save blob for a code. Returns the stored `data` object, or null if
// missing / unreachable / errored. Never throws.
export async function cloudLoad(code) {
  if (!code) return null;
  try {
    const res = await timedFetch(`${BASE}?code=eq.${encodeURIComponent(code)}&select=data`, {
      headers: AUTH,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return (Array.isArray(rows) && rows[0] && rows[0].data) ? rows[0].data : null;
  } catch (e) {
    return null;
  }
}

// Upsert the save blob for a code (merge-duplicates on the `code` primary key).
// Returns true on success, false on any failure. Never throws.
export async function cloudSave(code, dataObj) {
  if (!code) return false;
  try {
    const res = await timedFetch(BASE, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ code, data: dataObj, updated_at: new Date().toISOString() }]),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
