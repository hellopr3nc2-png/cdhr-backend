/**
 * api/cases.js
 * ─────────────────────────────────────────────────────────
 * GET /api/cases?limit=20&urgent=true
 *
 * Returns the most recent case index entries.
 * Intended for CDHR internal admin use.
 *
 * Query params:
 *   limit  – max entries to return (default 20, max 100)
 *   urgent – if "true", filters to urgent/emergency cases only
 * ─────────────────────────────────────────────────────────
 */

import { storeGet } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit  = Math.min(parseInt(req.query.limit  || '20', 10), 100);
  const urgent = req.query.urgent === 'true';

  try {
    let list = await storeGet('cases:list') || [];

    if (urgent) {
      list = list.filter(c => c.urgent);
    }

    list = list.slice(0, limit);

    return res.status(200).json({
      total: list.length,
      cases: list,
    });
  } catch (err) {
    console.error('[CDHR cases list error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
