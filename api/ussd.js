/**
 * api/ussd.js
 * ═══════════════════════════════════════════════════════════
 * CDHR Justice Line — USSD Flow Engine
 * Deployed as a Vercel Serverless Function
 *
 * ── API CONTRACT ─────────────────────────────────────────────
 *
 * POST /api/ussd
 * Content-Type: application/json
 *
 * Request body:
 * {
 *   "sessionId": "unique-session-id",   // required — identifies this USSD session
 *   "phoneNumber": "+2348031234567",     // optional — caller's MSISDN
 *   "text": "1*2*Itu*Brief description" // the full input chain (Africa's Talking style)
 *                                        // OR just the latest input for step-by-step mode
 * }
 *
 * Response body:
 * {
 *   "message": "CON Welcome to CDHR...\n1. Report...", // CON = continue, END = terminal
 *   "sessionId": "..."
 * }
 *
 * The message prefix follows Africa's Talking USSD convention:
 *   CON <text>   → session continues, input box shown
 *   END <text>   → session ends, only OK button shown
 *
 * ── FRONTEND / SIMULATOR USAGE ───────────────────────────────
 * The included CDHR frontend simulator calls this API directly.
 * It sends { sessionId, text } and reads message back.
 * ═══════════════════════════════════════════════════════════
 */

import { storeGet, storeSet } from '../lib/store.js';
import {
  UNITS, VIOLATIONS, RIGHTS,
  generateCaseId, generateEmergencyId
} from '../lib/data.js';

// ── Session TTL: 5 minutes (USSD sessions are short-lived) ───
const SESSION_TTL = 300;
// ── Case TTL: 90 days ────────────────────────────────────────
const CASE_TTL = 60 * 60 * 24 * 90;

// ── Vercel serverless entry point ────────────────────────────
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'CDHR Justice Line USSD Backend',
      status: 'running',
      version: '1.0.0',
      endpoints: {
        ussd: 'POST /api/ussd  { sessionId, text, phoneNumber? }',
        case: 'GET  /api/case?id=CDHR-XXXXX',
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;

  // If body is a string (some proxies), parse it
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { sessionId, phoneNumber = '', text = '' } = body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const response = await handleUssd({ sessionId, phoneNumber, text });
    return res.status(200).json(response);
  } catch (err) {
    console.error('[CDHR USSD Error]', err);
    return res.status(500).json({
      message: 'END Service temporarily unavailable.\nPlease call:\n0800-CDHR-LAW',
      sessionId
    });
  }
}

// ════════════════════════════════════════════════════════════
//  USSD FLOW ENGINE
// ════════════════════════════════════════════════════════════

async function handleUssd({ sessionId, phoneNumber, text }) {
  // Parse the input chain: Africa's Talking sends cumulative inputs joined by *
  // e.g. first tap = "1", second tap = "1*2", third = "1*2*3"
  const inputs = text ? text.split('*').map(s => s.trim()).filter(Boolean) : [];

  // Load or initialise session
  const sessionKey = `session:${sessionId}`;
  let session = await storeGet(sessionKey) || {
    step:        'main',
    data:        {},   // collected data (lga, violationType, etc.)
    phoneNumber: phoneNumber || '',
    createdAt:   new Date().toISOString(),
  };

  // Route to step handler
  const result = await routeStep(session, inputs);

  // Save updated session (unless terminal)
  if (!result.end) {
    session.step = result.nextStep;
    session.data = result.data || session.data;
    await storeSet(sessionKey, session, SESSION_TTL);
  } else {
    // Clean up session on END
    await storeSet(sessionKey, null, 1);
  }

  const prefix = result.end ? 'END' : 'CON';
  return {
    message:   `${prefix} ${result.text}`,
    sessionId,
    ...(result.caseId && { caseId: result.caseId }),
  };
}

// ════════════════════════════════════════════════════════════
//  STEP ROUTER
// ════════════════════════════════════════════════════════════

async function routeStep(session, inputs) {
  const step = session.step;

  // ── MAIN MENU ─────────────────────────────────────────────
  if (step === 'main') {
    if (inputs.length === 0) {
      return { text: mainMenu(), nextStep: 'main', end: false };
    }
    const choice = inputs[inputs.length - 1];
    switch (choice) {
      case '1': return { text: reportViolationMenu(), nextStep: 'report_type', end: false };
      case '2': return { text: 'Enter your Case ID:\n(e.g. CDHR-12345)', nextStep: 'check_case', end: false };
      case '3': return { text: knowYourRightsMenu(), nextStep: 'rights', end: false };
      case '4': return { text: findUnitMenu(), nextStep: 'find_unit', end: false };
      case '5': return await emergencyStart(session);
      default:  return { text: `Invalid option "${choice}".\n\n` + mainMenu(), nextStep: 'main', end: false };
    }
  }

  // ── REPORT FLOW ───────────────────────────────────────────
  if (step === 'report_type') {
    const choice = inputs[inputs.length - 1];
    if (!VIOLATIONS[choice]) {
      return { text: `Invalid option.\n\n` + reportViolationMenu(), nextStep: 'report_type', end: false };
    }
    return {
      text: lgaMenu('Step 2 of 4: Select your LGA:'),
      nextStep:  'report_lga',
      data: { ...session.data, violationType: VIOLATIONS[choice] },
      end: false,
    };
  }

  if (step === 'report_lga') {
    const choice = inputs[inputs.length - 1];
    if (!UNITS[choice]) {
      return { text: `Invalid LGA.\n\n` + lgaMenu('Step 2 of 4: Select your LGA:'), nextStep: 'report_lga', end: false };
    }
    return {
      text: 'Step 3 of 4:\nBriefly describe the incident.\n(Max 160 chars)\n\nType your description:',
      nextStep: 'report_desc',
      data: { ...session.data, lga: UNITS[choice].lga, lgaKey: choice },
      end: false,
    };
  }

  if (step === 'report_desc') {
    const desc = inputs[inputs.length - 1] || '(No description provided)';
    return {
      text: 'Step 4 of 4 (optional):\nEnter your phone number\nfor follow-up, or press\n0 to skip:',
      nextStep: 'report_phone',
      data: { ...session.data, description: desc.substring(0, 160) },
      end: false,
    };
  }

  if (step === 'report_phone') {
    const raw = inputs[inputs.length - 1] || '';
    const phone = raw === '0' ? session.phoneNumber || 'Anonymous' : sanitizePhone(raw);
    const caseId = generateCaseId();

    // Persist case to store
    await saveCase({
      caseId,
      type:        'VIOLATION',
      violationType: session.data.violationType,
      lga:         session.data.lga,
      description: session.data.description,
      phone,
      status:      'Under Review',
      urgent:      false,
      createdAt:   new Date().toISOString(),
    });

    return {
      text: `✓ Report Registered\n\nCase ID: ${caseId}\nType: ${session.data.violationType}\nLGA: ${session.data.lga}\n\nOur legal team will\ncontact you within 24hrs.\n\nSave your Case ID to\ncheck status later.`,
      nextStep: 'done',
      caseId,
      end: true,
    };
  }

  // ── CHECK CASE STATUS ─────────────────────────────────────
  if (step === 'check_case') {
    const caseId = (inputs[inputs.length - 1] || '').toUpperCase().trim();
    if (!caseId) {
      return { text: 'Enter your Case ID:\n(e.g. CDHR-12345)', nextStep: 'check_case', end: false };
    }

    const record = await storeGet(`case:${caseId}`);
    if (!record) {
      return {
        text: `Case ID not found:\n${caseId}\n\nPlease check the ID\nand try again, or call:\n0800-CDHR-LAW`,
        nextStep: 'done',
        end: true,
      };
    }

    return {
      text: formatCaseStatus(record),
      nextStep: 'done',
      end: true,
    };
  }

  // ── KNOW YOUR RIGHTS ──────────────────────────────────────
  if (step === 'rights') {
    const choice = inputs[inputs.length - 1];
    if (!RIGHTS[choice]) {
      return { text: `Invalid option.\n\n` + knowYourRightsMenu(), nextStep: 'rights', end: false };
    }
    return { text: RIGHTS[choice], nextStep: 'done', end: true };
  }

  // ── FIND YOUR UNIT ────────────────────────────────────────
  if (step === 'find_unit') {
    const choice = inputs[inputs.length - 1];
    const unit = UNITS[choice];
    if (!unit) {
      return { text: `Invalid LGA.\n\n` + findUnitMenu(), nextStep: 'find_unit', end: false };
    }
    return {
      text: `CDHR Unit: ${unit.lga}\n\nCoordinator:\n${unit.coordinator}\n\nPhone:\n${unit.phone}\n\nFor emergencies, select\noption 5 from main menu.`,
      nextStep: 'done',
      end: true,
    };
  }

  // ── EMERGENCY ─────────────────────────────────────────────
  if (step === 'emergency_detained') {
    const choice = inputs[inputs.length - 1];
    const detained = choice === '1';
    const phone = session.phoneNumber || 'Unknown';
    const caseId = generateEmergencyId();

    await saveCase({
      caseId,
      type:      'EMERGENCY',
      detained,
      phone,
      lga:       session.data.lga || 'Unknown',
      status:    'Escalated',
      urgent:    true,
      createdAt: new Date().toISOString(),
    });

    const detainedMsg = detained
      ? 'You have been flagged as\ncurrently detained.\nLawyer dispatched NOW.'
      : 'A legal advisor will\ncall you shortly.';

    return {
      text: `⚠ ALERT LOGGED URGENTLY\n\nCase ID: ${caseId}\n\n${detainedMsg}\n\nEmergency line:\n+234-803-CDHR-911\n\nDo NOT resist or argue\nuntil lawyer arrives.`,
      nextStep: 'done',
      caseId,
      end: true,
    };
  }

  // ── FALLBACK: reset to main ───────────────────────────────
  return { text: mainMenu(), nextStep: 'main', end: false };
}

// ════════════════════════════════════════════════════════════
//  EMERGENCY HELPER (checks for LGA before asking detained?)
// ════════════════════════════════════════════════════════════

async function emergencyStart(session) {
  return {
    text: `⚠ EMERGENCY LEGAL AID\n\nThis will be logged\nas URGENT.\n\nAre you currently detained?\n1. Yes\n2. No`,
    nextStep: 'emergency_detained',
    data: { ...session.data, type: 'EMERGENCY' },
    end: false,
  };
}

// ════════════════════════════════════════════════════════════
//  CASE PERSISTENCE
// ════════════════════════════════════════════════════════════

async function saveCase(record) {
  const key = `case:${record.caseId}`;
  await storeSet(key, record, CASE_TTL);

  // Also maintain an index list (best-effort; ignore errors)
  try {
    const listKey = 'cases:list';
    const list = await storeGet(listKey) || [];
    list.unshift({ caseId: record.caseId, createdAt: record.createdAt, urgent: record.urgent });
    if (list.length > 500) list.length = 500; // cap index size
    await storeSet(listKey, list, CASE_TTL);
  } catch { /* non-critical */ }
}

// ════════════════════════════════════════════════════════════
//  TEXT HELPERS
// ════════════════════════════════════════════════════════════

function mainMenu() {
  return (
    `Welcome to CDHR Akwa Ibom\n` +
    `Comm. for the Defence\nof Human Rights\n\n` +
    `1. Report a Violation\n` +
    `2. Check Case Status\n` +
    `3. Know Your Rights\n` +
    `4. Find Your Unit\n` +
    `5. Emergency Legal Aid`
  );
}

function reportViolationMenu() {
  return (
    `Select violation type:\n\n` +
    `1. Illegal Arrest/Detention\n` +
    `2. Police Brutality\n` +
    `3. Land Grabbing\n` +
    `4. Gender-Based Violence\n` +
    `5. Unlawful Eviction\n` +
    `6. Other`
  );
}

function knowYourRightsMenu() {
  return (
    `Know Your Rights:\n\n` +
    `1. Arrested? Your rights\n` +
    `2. Land seizure? Rights\n` +
    `3. Domestic violence?\n` +
    `4. CDHR Hotlines`
  );
}

function findUnitMenu() {
  return (
    `Select your LGA:\n\n` +
    `1. Itu\n` +
    `2. Ibiono Ibom\n` +
    `3. Ikot Ekpene\n` +
    `4. Etinan\n` +
    `5. Abak\n` +
    `6. Uruan\n` +
    `7. Obio Offot\n` +
    `8. Obot Akara`
  );
}

function lgaMenu(header) {
  return (
    `${header}\n\n` +
    `1. Itu\n` +
    `2. Ibiono Ibom\n` +
    `3. Ikot Ekpene\n` +
    `4. Etinan\n` +
    `5. Abak\n` +
    `6. Uruan\n` +
    `7. Obio Offot\n` +
    `8. Obot Akara`
  );
}

function formatCaseStatus(record) {
  const statusEmoji = {
    'Under Review': '🔵',
    'In Progress':  '🟡',
    'Resolved':     '🟢',
    'Escalated':    '🔴',
  };
  const emoji = statusEmoji[record.status] || '⚪';
  const date  = record.createdAt ? record.createdAt.substring(0, 10) : 'Unknown';

  let text = `Case: ${record.caseId}\n\n` +
             `Status: ${emoji} ${record.status}\n`;

  if (record.violationType) text += `Type: ${record.violationType}\n`;
  if (record.lga)           text += `LGA: ${record.lga}\n`;
  if (record.urgent)        text += `⚠ URGENT FLAG\n`;
  text += `Filed: ${date}\n\n` +
          `For updates, call:\n0800-CDHR-LAW`;

  return text;
}

function sanitizePhone(raw) {
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.length >= 10) return `+${cleaned.startsWith('234') ? cleaned : '234' + cleaned.slice(-10)}`;
  return cleaned || 'Not provided';
}

