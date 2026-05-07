/**
 * lib/data.js
 * ─────────────────────────────────────────────────────────
 * Static reference data + utilities used across the USSD flow.
 * ─────────────────────────────────────────────────────────
 */

// ── LGA → Unit coordinator directory ─────────────────────────
export const UNITS = {
  '1': { lga: 'Itu',         coordinator: 'Barr. Emmanuel Okon',   phone: '+234-803-111-2001' },
  '2': { lga: 'Ibiono Ibom', coordinator: 'Mrs. Grace Udo',        phone: '+234-803-111-2002' },
  '3': { lga: 'Ikot Ekpene', coordinator: 'Barr. Sunday Nkemelu',  phone: '+234-803-111-2003' },
  '4': { lga: 'Etinan',      coordinator: 'Mr. Peter Effiong',     phone: '+234-803-111-2004' },
  '5': { lga: 'Abak',        coordinator: 'Mrs. Blessing Akpan',   phone: '+234-803-111-2005' },
  '6': { lga: 'Uruan',       coordinator: 'Barr. Victor Ewa',      phone: '+234-803-111-2006' },
  '7': { lga: 'Obio Offot',  coordinator: 'Mr. James Ekwere',      phone: '+234-803-111-2007' },
  '8': { lga: 'Obot Akara',  coordinator: 'Mrs. Rose Nkanga',      phone: '+234-803-111-2008' },
};

// ── Violation types ───────────────────────────────────────────
export const VIOLATIONS = {
  '1': 'Illegal Arrest / Detention',
  '2': 'Police Brutality',
  '3': 'Land Grabbing',
  '4': 'Gender-Based Violence',
  '5': 'Unlawful Eviction',
  '6': 'Other',
};

// ── Rights content ────────────────────────────────────────────
export const RIGHTS = {
  '1': `YOUR RIGHTS IF ARRESTED:\n\n` +
       `- You must be told why you\n  are being arrested\n` +
       `- You have the right to\n  remain silent\n` +
       `- You must be charged or\n  released within 24-48hrs\n` +
       `- You have the right to\n  speak with a lawyer\n` +
       `- You CANNOT be tortured\n\n` +
       `CDHR Hotline: 0800-CDHR-LAW`,

  '2': `YOUR RIGHTS IN LAND SEIZURE:\n\n` +
       `- No one can seize your land\n  without a valid court order\n` +
       `- Demand to see any govt\n  acquisition notice in writing\n` +
       `- You are entitled to\n  fair compensation\n` +
       `- Document everything:\n  photos, dates, witnesses\n\n` +
       `CDHR Hotline: 0800-CDHR-LAW`,

  '3': `IF YOU FACE DOMESTIC VIOLENCE:\n\n` +
       `- You have the right to\n  safety — leave if you can\n` +
       `- Violence Against Persons\n  Act (VAPP) protects you\n` +
       `- You can get a restraining\n  order from a magistrate\n` +
       `- CDHR can provide a safe\n  legal referral discreetly\n\n` +
       `CDHR Hotline: 0800-CDHR-LAW`,

  '4': `CDHR AKWA IBOM HOTLINES:\n\n` +
       `Main Office:  +234-803-CDHR-01\n` +
       `Legal Aid:    0800-CDHR-LAW\n` +
       `GBV Support:  +234-803-CDHR-02\n` +
       `Emergency:    +234-803-CDHR-911\n\n` +
       `Office: 14 Nwaniba Road,\n        Uyo, Akwa Ibom State\n\n` +
       `Mon-Fri: 8am - 5pm`,
};

// ── Case ID generator ─────────────────────────────────────────
let _counter = 20000;  // seeds the numeric part; real apps use atomic increments

export function generateCaseId(prefix = 'CDHR') {
  _counter += 1;
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `${prefix}-${rand}`;
}

export function generateEmergencyId() {
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `CDHR-EMG-${seq}`;
}
