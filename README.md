# Sankofa — Agentic SOC Triage for Splunk

> "Go back and get it" — learn from past threats to protect the future.

Sankofa is an AI-powered SOC triage dashboard that auto-investigates Splunk security alerts using a multi-agent system, so analysts focus only on what matters.

## The Problem

SOC analysts face two compounding problems:
1. **Alert volume** — too many alerts to investigate manually; critical threats get buried in noise
2. **Investigation toil** — each alert requires 20–40 minutes of manual SPL queries, log correlation, and external lookups before a severity decision can be made

## What Sankofa Does

- **Polls Splunk** for fired alerts every 30 seconds via the Splunk REST API and `splunklib` (Splunk Developer Tools)
- **Tiers investigations** automatically: low/medium alerts get fast triage (~10s), high/critical trigger a full multi-agent parallel investigation
- **Four specialized subagents** run in parallel for high/critical alerts: Auth, Network, Endpoint, and Lateral Movement — each queries Splunk and returns findings
- **Supervisor synthesizes** findings into a kill chain, confidence score (0–100), MITRE ATT&CK mapping, and containment steps
- **Live dashboard** shows a severity-ranked alert queue with real-time status via WebSocket
- **Chat interface** lets analysts ask follow-up questions about any alert with streaming responses

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │   Alert Queue Panel  │  │   Investigation Sidebar  │  │
│  │  (live, prioritized) │  │  (report + chat)         │  │
│  └──────────┬──────────┘  └────────────┬─────────────┘  │
└─────────────┼──────────────────────────┼────────────────┘
              │ WebSocket / REST         │ SSE streaming
┌─────────────▼──────────────────────────▼────────────────┐
│                  FastAPI Backend                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ Alert Poller │  │ Triage Engine │  │  Chat API    │  │
│  │ (APScheduler)│  │  Supervisor   │  │  (streaming) │  │
│  └──────┬───────┘  └──────┬────────┘  └──────┬───────┘  │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │ parallel          │
          │        ┌────────┴─────────┐         │
          │        │ Four Subagents   │         │
          │        │ Auth | Network   │         │
          │        │ Endpoint|Lateral │         │
          │        └────────┬─────────┘         │
          │                 │                   │
┌─────────▼─────────────────▼───────────────────▼──────────┐
│                    Splunk Enterprise                       │
│   REST API (/services/search, /services/alerts)           │
│   splunklib Python SDK (Splunk Developer Tools)           │
└────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────┐
│  Anthropic Claude  │
│  Haiku (subagents) │
│  Sonnet (chat)     │
└────────────────────┘
```

## Triage Flow

```
Alert received
     │
     ▼
Classify severity
     │
     ├── low/medium ──► FastTriageAgent ──► score + MITRE + summary (~10s)
     │
     └── high/critical ──► Parallel subagents:
                              ├── AuthAgent    (WinEventLog:Security)
                              ├── NetworkAgent (firewall/netflow)
                              ├── EndpointAgent (sysmon/osquery)
                              └── LateralAgent  (lateral movement)
                           └──► Supervisor synthesizes:
                                  kill chain + confidence + containment steps (~30s)
```

## Splunk Integration

- **Splunk REST API** — alert polling, SPL search execution via `splunklib`
- **Splunk Developer Tools** — `splunk-sdk-python` (develop branch) with `splunklib.ai` agent framework
- **SPL queries** — each subagent generates targeted SPL for its domain (auth, network, endpoint, lateral)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Python 3.13 |
| Splunk | splunklib (Python SDK) + REST API |
| LLM | Anthropic Claude (Haiku for speed, Sonnet for chat) |
| Database | SQLite via aiosqlite |
| Scheduler | APScheduler |
| Frontend | React 18 + Vite + Tailwind + Zustand + Framer Motion |

## Setup

```bash
# 1. Clone and create .env
cp .env.example backend/.env
# Edit backend/.env with your SPLUNK_TOKEN and ANTHROPIC_API_KEY

# 2. Backend
cd backend
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Click **seed demo** to load sample alerts and watch the multi-agent triage run live.

## Demo Data

`seed/bots_alerts.json` contains 5 realistic BOTS-style alerts spanning:
- Credential dumping (LSASS access) — **Critical**
- Lateral movement (SMB to internal host) — **High**
- Suspicious PowerShell execution — **High**
- Brute force login attempts — **Medium**
- Port scan from external IP — **Low**

## Hackathon

**Splunk Agentic Ops Hackathon** — Track: Security

Prize targets: Best of Security · Best Use of Splunk Developer Tools · Grand Prize
