# CDHR Justice Line — Backend

**Committee for the Defence of Human Rights, Akwa Ibom**
USSD Simulation Backend · Vercel Serverless

---

## Project Structure

```
cdhr-backend/
├── api/
│   ├── ussd.js       ← Main USSD flow engine  (POST /api/ussd)
│   ├── case.js       ← Case lookup            (GET  /api/case?id=CDHR-XXXXX)
│   └── cases.js      ← Admin cases list       (GET  /api/cases?limit=20)
├── lib/
│   ├── store.js      ← Storage abstraction (Vercel KV → in-memory fallback)
│   └── data.js       ← Units, violations, rights content, ID generator
├── public/
│   └── index.html    ← CDHR USSD simulator frontend
├── package.json
├── vercel.json
└── README.md
```

---

## Deploy to Vercel (Step by Step)

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy (first time)
```bash
cd cdhr-backend
vercel
```
Follow the prompts:
- **Set up and deploy?** → Y
- **Which scope?** → your account
- **Link to existing project?** → N
- **Project name?** → `cdhr-justice-line` (or whatever you like)
- **Directory?** → `./` (the current folder)

Your app will be live at something like:
`https://cdhr-justice-line.vercel.app`

### 4. (Optional but recommended) Enable Vercel KV for case persistence

Without KV, cases are stored in-memory and will reset when the function cold-starts.
With KV, all cases persist for 90 days.

```bash
# Create a KV store
vercel kv create cdhr-cases

# Link it to your project
vercel kv link cdhr-cases

# Pull env vars to local
vercel env pull

# Redeploy with KV enabled
vercel --prod
```

### 5. Deploy updates
```bash
vercel --prod
```

---

## API Reference

### `POST /api/ussd`
The core USSD session handler.

**Request:**
```json
{
  "sessionId": "uuid-per-call",
  "phoneNumber": "+2348031234567",
  "text": "1"
}
```

**Response:**
```json
{
  "message": "CON Select violation type:\n1. Illegal Arrest...",
  "sessionId": "uuid-per-call"
}
```

Message prefix:
- `CON` → session continues (show input)
- `END` → session ends (show OK button only)

---

### `GET /api/case?id=CDHR-XXXXX`
Returns case details.

**Response (found):**
```json
{
  "caseId": "CDHR-43812",
  "type": "VIOLATION",
  "violationType": "Police Brutality",
  "lga": "Itu",
  "description": "Officers detained me...",
  "phone": "+2348031234567",
  "status": "Under Review",
  "urgent": false,
  "createdAt": "2026-05-07T14:22:00.000Z"
}
```

**Response (not found):** `404`

---

### `GET /api/cases?limit=20&urgent=true`
Returns list of recent case IDs.

```json
{
  "total": 3,
  "cases": [
    { "caseId": "CDHR-EMG-4412", "createdAt": "...", "urgent": true },
    { "caseId": "CDHR-38291",    "createdAt": "...", "urgent": false }
  ]
}
```

---

## Menu Flow

```
Main Menu
├── 1. Report a Violation
│   ├── Select violation type (6 options)
│   ├── Select LGA (8 options)
│   ├── Describe incident (free text, 160 chars)
│   ├── Phone number (optional, 0 to skip)
│   └── END → Case ID generated (CDHR-XXXXX)
│
├── 2. Check Case Status
│   ├── Enter Case ID
│   └── END → Status + details returned
│
├── 3. Know Your Rights
│   ├── 1. Arrested? Your rights
│   ├── 2. Land seizure? Your rights
│   ├── 3. Domestic violence? Your rights
│   └── 4. CDHR Hotlines
│
├── 4. Find Your Unit
│   ├── Select LGA (8 options)
│   └── END → Coordinator name + phone
│
└── 5. Emergency Legal Aid
    ├── Are you currently detained? (1=Yes / 2=No)
    └── END → URGENT case logged (CDHR-EMG-XXXXX)
```

---

## Local Development

```bash
npm install
vercel dev
```

The frontend at `public/index.html` will call `http://localhost:3000/api/ussd` automatically.

---

## Case Status Values

| Status        | Meaning                                  |
|---------------|------------------------------------------|
| Under Review  | Newly filed, not yet assigned            |
| In Progress   | Assigned to a CDHR legal officer         |
| Escalated     | Referred to court / external authority   |
| Resolved      | Case closed with outcome                 |

To update a case status (e.g. from your admin dashboard or manually):
```bash
# Using Vercel KV CLI
vercel kv set case:CDHR-43812 '{"status":"In Progress", ...}'
```

---

## Notes

- Sessions expire after **5 minutes** (standard USSD timeout)
- Cases expire after **90 days**
- The in-memory store works fine for demos; enable KV before real deployment
- `public/index.html` is the CDHR USSD simulator frontend — no changes needed

