/**
 * lib/store.js
 * ─────────────────────────────────────────────────────────────
 * Thin storage layer.
 *
 * Production  → Vercel KV (Redis-backed, persists across requests)
 * Development → In-memory Map (resets on restart, fine for local dev)
 *
 * To enable Vercel KV:
 *   1. vercel env pull
 *   2. vercel kv create cdhr-cases
 *   3. vercel kv link cdhr-cases
 * The env vars KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN are
 * injected automatically after linking.
 * ─────────────────────────────────────────────────────────────
 */

let kv = null;

async function getKV() {
  if (kv) return kv;
  // Only attempt import if the env var is present (i.e. KV linked)
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const mod = await import('@vercel/kv');
      kv = mod.kv;
      return kv;
    } catch {
      // package not installed or not available — fall through to memory
    }
  }
  return null;
}

// ── In-memory fallback (single-process only) ──────────────────
const memStore = new Map();

export async function storeSet(key, value, exSeconds = 60 * 60 * 24 * 30) {
  const client = await getKV();
  if (client) {
    await client.set(key, JSON.stringify(value), { ex: exSeconds });
  } else {
    memStore.set(key, { value, expires: Date.now() + exSeconds * 1000 });
  }
}

export async function storeGet(key) {
  const client = await getKV();
  if (client) {
    const raw = await client.get(key);
    if (raw === null) return null;
    // Vercel KV auto-parses JSON strings
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { memStore.delete(key); return null; }
  return entry.value;
      }
                       
