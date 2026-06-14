# Sankofa v2 — Design Spec
**Date:** 2026-06-14
**Product Identity:** Autonomous response engine — the AI SOC analyst that works at 3am.

---

## Product Vision

Sankofa sits between your SIEM and your analysts. Alert fires → Sankofa investigates → enriches with threat intel → executes runbook → acts autonomously on low-risk steps → gates on human for high-risk via Slack → closes the loop. Gets smarter with every investigation.

---

## Architecture

```
Splunk (alert source)
    ↓ poll every 30s
Alert Poller
    ↓
Triage Engine (4 subagents: Auth, Network, Endpoint, Lateral)
    + Threat Intel Enrichment (VirusTotal + AbuseIPDB)
    ↓
Runbook Engine — matches alert to runbook by MITRE tactic + severity
    ↓
Action Executor
    ├── Low-risk  → execute autonomously → log to Action Log
    └── High-risk → post Slack card with Approve/Dismiss buttons
                 → analyst responds in Slack
                 → webhook back to /slack/action
                 → execute → log to Action Log
    ↓
Feedback Store (SQLite + Splunk KV Store sankofa_threat_intel)
    → informs future triage for same IP/host/pattern
    ↓
Frontend
    ├── Graph View (D3 network) ↔ Timeline View (switcher)
    ├── Stats Bar (live counts, top banner)
    ├── ReportCard (enrichment panel auto-expands if malicious)
    ├── Global Action Log (slide-in panel, top nav icon)
    └── Visual Runbook Builder (/runbooks page, reactflow editor)
```

---

## New Backend Files

| File | Responsibility |
|---|---|
| `backend/enrichment.py` | VirusTotal + AbuseIPDB calls, 24h cache in SQLite |
| `backend/runbook_engine.py` | Load/match/execute runbooks, step sequencing |
| `backend/action_executor.py` | Low/high-risk routing, Splunk KV Store writes |
| `backend/slack_webhook.py` | Outbound Slack cards + inbound interactive webhook |
| `backend/routes/runbooks.py` | CRUD: GET/POST/PUT/DELETE /runbooks |
| `backend/routes/action_log.py` | GET /actions (global log) |
| `backend/routes/slack.py` | POST /slack/action (Slack interactive webhook) |

---

## New Frontend Files

| File | Responsibility |
|---|---|
| `frontend/src/components/GraphView.tsx` | D3 force-directed network diagram |
| `frontend/src/components/TimelineView.tsx` | Horizontal swimlane by severity |
| `frontend/src/components/ViewSwitcher.tsx` | Graph/Timeline toggle, Framer Motion |
| `frontend/src/components/StatsBar.tsx` | Live stats top banner |
| `frontend/src/components/EnrichmentPanel.tsx` | Threat intel cards, auto-expands if malicious |
| `frontend/src/components/ActionLog.tsx` | Slide-in global action log panel |
| `frontend/src/components/RunbookBuilder.tsx` | reactflow visual editor |
| `frontend/src/pages/Runbooks.tsx` | Runbook management page |

---

## Data Models

### ThreatIntel
```python
ThreatIntel:
  ip: str
  reputation_score: int        # 0-100, higher = more malicious
  abuse_reports: int           # AbuseIPDB count
  country: str
  asn: str
  known_malware: list[str]     # VirusTotal malware families
  is_tor_exit: bool
  last_seen: str
  sources: list[str]           # ["virustotal", "abuseipdb"]
  cached_at: datetime
```

### Runbook + RunbookStep
```python
RunbookStep:
  id: str
  type: "action" | "condition" | "notification"
  label: str
  action_type: str | None      # "create_splunk_alert" | "add_to_watchlist" |
                               # "slack_notify" | "block_ip" | "isolate_host"
  risk_level: "low" | "high"
  params: dict
  next_on_success: str | None
  next_on_failure: str | None

Runbook:
  id: str
  name: str
  trigger_conditions: dict     # {"mitre_tactic": "TA0006", "severity": ["high","critical"]}
  steps: list[RunbookStep]
  created_at: datetime
```

### ActionLog
```python
ActionLog:
  id: str
  alert_id: str
  runbook_id: str | None
  action_type: str
  description: str
  risk_level: "low" | "high"
  status: "executed" | "pending_approval" | "approved" | "dismissed" | "failed"
  result: str | None
  executed_at: datetime | None
```

### FeedbackEntry
```python
FeedbackEntry:
  id: str
  alert_id: str
  ip: str | None
  host: str | None
  pattern: str                 # "lsass_access" | "brute_force" | "lateral_movement"
  analyst_action: str
  outcome: str                 # "true_positive" | "false_positive"
  created_at: datetime
```

---

## Feature Designs

### 1. Threat Intel Enrichment
- Called automatically during triage for every `source_ip`
- APIs: VirusTotal v3 (`/api/v3/ip_addresses/{ip}`), AbuseIPDB v2 (`/api/v2/check`)
- Cache results in SQLite `threat_intel` table for 24h — no repeat calls for same IP
- Threshold: `reputation_score > 50` OR `abuse_reports > 10` → `EnrichmentPanel` auto-expands
- If clean → panel stays collapsed, no UI noise
- Enrichment verdict folds into the supervisor synthesis prompt: "This IP has reputation_score=87, 847 abuse reports, known Tor exit node"

### 2. Runbook Engine
- On triage completion, match alert to runbooks by `trigger_conditions.mitre_tactic` + `trigger_conditions.severity`
- Execute steps sequentially:
  - `risk_level="low"` → execute immediately, log result to `ActionLog`
  - `risk_level="high"` → pause, post Slack card with Approve/Dismiss buttons, wait for webhook
- Built-in action implementations:
  - `create_splunk_alert`: POST to Splunk `/services/saved/searches`
  - `add_to_watchlist`: PUT to Splunk KV Store `sankofa_watchlist`
  - `slack_notify`: POST to Slack incoming webhook
  - `block_ip`: writes to `ActionLog` as simulated + Splunk alert action (demo)
  - `isolate_host`: writes to `ActionLog` as simulated (demo)
- 3 built-in default runbooks seeded on first run:
  1. "Credential Access Response" — triggers on TA0006, severity high/critical
  2. "Lateral Movement Response" — triggers on TA0008, severity high/critical
  3. "Reconnaissance Response" — triggers on TA0043, severity medium+

### 3. Slack Integration
- **Outbound alert card** (every high/critical alert):
  ```
  🔴 CRITICAL — Credential Dumping (LSASS)
  Host: win-dc01 | IP: 185.220.101.42
  MITRE: TA0006 - Credential Access | Confidence: 87%
  Kill chain: Recon → Brute Force → LSASS Access
  ⚠️  Threat Intel: Known Tor exit node (847 abuse reports)
  [View in Sankofa]  [Mark as False Positive]
  ```
- **Runbook approval card** (high-risk step pending):
  ```
  🔒 ACTION REQUIRED — Block IP 185.220.101.42
  Alert: Credential Dumping — win-dc01
  Runbook: Credential Access Response, Step 3
  [✓ Approve]  [✗ Dismiss]
  ```
- **Action confirmation** (low-risk executed):
  ```
  ✅ Sankofa executed: Added 185.220.101.42 to watchlist
  Created correlation search: "Sankofa - Track 185.220.101.42"
  ```
- **Inbound webhook**: POST `/slack/action` with `payload` JSON → parse action → execute or cancel → post follow-up message

### 4. Visual Runbook Builder
- Library: `reactflow` (Apache 2.0, production-grade, 20k+ GitHub stars)
- Node types:
  - **Trigger** (green): alert type + severity conditions
  - **Condition** (blue): if/else branch on enrichment score, confidence, etc.
  - **Action** (orange): action type dropdown + risk level toggle + params
  - **Notification** (purple): Slack message content
- Connections: drag between node handles
- Save → POST `/runbooks` → stored in SQLite
- `/runbooks` page accessible from top nav "Runbooks" link

### 5. Dual View Mode
- **Graph View** (D3 force-directed):
  - Nodes: IPs and hosts, color = severity (red/orange/yellow/gray), size = confidence score
  - Edges: connections between source_ip and dest host per alert
  - Animates as new alerts arrive via WebSocket
  - Click node → opens investigation sidebar for that alert
- **Timeline View** (horizontal swimlane):
  - 4 rows: Critical / High / Medium / Low
  - Alert cards placed by timestamp on each row
  - Campaign alerts connected by a thread line showing attack progression
  - Click card → opens investigation sidebar
- **ViewSwitcher**: two icon buttons top-right, Framer Motion fade+scale transition (200ms)

### 6. Stats Bar
- Fixed top banner below nav:
  ```
  ● 3 CRITICAL  ● 2 HIGH  ● 1 MEDIUM  ● 1 LOW  |  avg confidence 79%  |  4 actions executed  |  2 pending approval
  ```
- Data from a new `GET /stats` endpoint that queries SQLite
- Updates every 5s via polling (not WebSocket — reduces complexity)

### 7. Global Action Log
- Slide-in panel from right, z-index over main content
- Triggered by clock/log icon in top nav
- Chronological list, newest first
- Each row: timestamp, alert title chip, action description, status badge
  - Green = executed, Yellow = pending, Red = failed, Gray = dismissed
- Accessible from any view without losing current state

### 8. Feedback Loop
- Every analyst decision (approve/dismiss in UI or Slack) writes a `FeedbackEntry` to SQLite
- `runbook_engine.py` queries feedback before executing: "For LSASS alerts, analyst approved isolation 8/8 times → auto-escalate confidence"
- Supervisor synthesis prompt includes last 3 feedback entries for same pattern: "Previous analyst response: approved IP block 3 times for this subnet"
- Writes summary to Splunk KV Store `sankofa_threat_intel` on each approval: `{ip, pattern, outcome, count}`

---

## New Config (.env additions)
```
VIRUSTOTAL_API_KEY=
ABUSEIPDB_API_KEY=
SLACK_WEBHOOK_URL=
SLACK_SIGNING_SECRET=
```

---

## Out of Scope (v3)
- Multi-tenant / user roles
- API-first / multi-SIEM support
- Fine-tuning pipeline
- Mobile app
