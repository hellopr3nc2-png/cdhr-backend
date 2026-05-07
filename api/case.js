/**
 * api/case.js
 * ─────────────────────────────────────────────────────────
 * GET /api/case?id=CDHR-XXXXX
 *
 * Returns case details for the given Case ID.
 * Used by: admin dashboard, frontend case lookup, WhatsApp bot, etc.
 * ─────────────────────────────────────────────────────────
 */

import { storeGet } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = (req.query.id || '').toUpperCase().trim();

  if (!id) {
    return res.status(400).json({ error: 'Missing ?id= parameter' });
  }

  try {
    const record = await storeGet(`case:${id}`);

    if (!record) {
      return res.status(404).json({
        error: 'Case not found',
        caseId: id,
        hint: 'Case IDs are case-insensitive and expire after 90 days.',
      });
    }

    return res.status(200).json(record);
  } catch (err) {
    console.error('[CDHR case lookup error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
