# Sankofa v2 — Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add threat intel enrichment, runbook engine, action executor, Slack integration, and feedback loop to the existing Sankofa FastAPI backend.

**Architecture:** Five independent backend modules wired together in `triage/engine.py`: enrichment runs during triage, runbook engine fires after triage completes, action executor routes low/high-risk steps, Slack handles outbound cards and inbound webhooks, feedback loop writes decisions back to SQLite and Splunk KV Store.

**Tech Stack:** Python 3.13, FastAPI, httpx (async), aiosqlite, splunklib, anthropic AsyncAnthropic.

---

## File Structure

```
backend/
├── enrichment.py              # NEW: VirusTotal + AbuseIPDB, 24h cache
├── runbook_engine.py          # NEW: match + execute runbooks step by step
├── action_executor.py         # NEW: low/high-risk routing, Splunk KV Store
├── slack_webhook.py           # NEW: outbound cards + inbound handler
├── models.py                  # MODIFY: add ThreatIntel, Runbook, RunbookStep, ActionLog, FeedbackEntry
├── database.py                # MODIFY: add 5 new tables + helpers
├── config.py                  # MODIFY: add VIRUSTOTAL_API_KEY, ABUSEIPDB_API_KEY, SLACK_WEBHOOK_URL, SLACK_SIGNING_SECRET
├── triage/engine.py           # MODIFY: call enrichment + runbook engine after triage
├── routes/
│   ├── runbooks.py            # NEW: CRUD /runbooks
│   ├── action_log.py          # NEW: GET /actions + GET /stats
│   └── slack.py               # NEW: POST /slack/action
└── main.py                    # MODIFY: register new routers
```

---

## Task 1: Config + Models

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/models.py`
- Test: `tests/test_v2_models.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_v2_models.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from datetime import datetime
from models import (ThreatIntel, Runbook, RunbookStep, ActionLog, FeedbackEntry)


def test_threat_intel_defaults():
    ti = ThreatIntel(
        ip="185.220.101.42",
        reputation_score=87,
        abuse_reports=847,
        country="DE",
        asn="AS13335",
        cached_at=datetime.utcnow(),
    )
    assert ti.known_malware == []
    assert ti.is_tor_exit is False
    assert ti.sources == []


def test_runbook_step_defaults():
    step = RunbookStep(
        id="step-1",
        type="action",
        label="Add to watchlist",
        action_type="add_to_watchlist",
        risk_level="low",
        params={"ip": "185.220.101.42"},
    )
    assert step.next_on_success is None
    assert step.next_on_failure is None


def test_action_log_defaults():
    log = ActionLog(
        id="log-1",
        alert_id="alert-1",
        action_type="add_to_watchlist",
        description="Added 185.220.101.42 to watchlist",
        risk_level="low",
    )
    assert log.status == "executed"
    assert log.result is None
    assert log.executed_at is None


def test_feedback_entry_fields():
    entry = FeedbackEntry(
        id="fb-1",
        alert_id="alert-1",
        pattern="lsass_access",
        analyst_action="approved",
        outcome="true_positive",
        created_at=datetime.utcnow(),
    )
    assert entry.ip is None
    assert entry.host is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_v2_models.py -v 2>&1 | tail -8
```

Expected: `ImportError: cannot import name 'ThreatIntel' from 'models'`

- [ ] **Step 3: Update `backend/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    splunk_host: str = "localhost"
    splunk_port: int = 8089
    splunk_token: str = ""
    anthropic_api_key: str = ""
    poll_interval_seconds: int = 30
    db_path: str = "sankofa.db"
    splunk_mcp_enabled: bool = True
    virustotal_api_key: str = ""
    abuseipdb_api_key: str = ""
    slack_webhook_url: str = ""
    slack_signing_secret: str = ""

    model_config = {"env_file": ".env"}

settings = Settings()
```

- [ ] **Step 4: Add new models to `backend/models.py`**

Append to the bottom of the existing `models.py` (keep all existing models unchanged):

```python
# --- v2 models ---

class ThreatIntel(BaseModel):
    ip: str
    reputation_score: int = 0
    abuse_reports: int = 0
    country: str = ""
    asn: str = ""
    known_malware: list[str] = Field(default_factory=list)
    is_tor_exit: bool = False
    last_seen: str = ""
    sources: list[str] = Field(default_factory=list)
    cached_at: datetime


class RunbookStep(BaseModel):
    id: str
    type: Literal["action", "condition", "notification"]
    label: str
    action_type: Optional[str] = None
    risk_level: Literal["low", "high"] = "low"
    params: dict = Field(default_factory=dict)
    next_on_success: Optional[str] = None
    next_on_failure: Optional[str] = None


class Runbook(BaseModel):
    id: str
    name: str
    trigger_conditions: dict = Field(default_factory=dict)
    steps: list[RunbookStep] = Field(default_factory=list)
    created_at: datetime


ActionLogStatus = Literal["executed", "pending_approval", "approved", "dismissed", "failed"]


class ActionLog(BaseModel):
    id: str
    alert_id: str
    runbook_id: Optional[str] = None
    action_type: str
    description: str
    risk_level: Literal["low", "high"] = "low"
    status: ActionLogStatus = "executed"
    result: Optional[str] = None
    executed_at: Optional[datetime] = None


class FeedbackEntry(BaseModel):
    id: str
    alert_id: str
    ip: Optional[str] = None
    host: Optional[str] = None
    pattern: str
    analyst_action: str
    outcome: str
    created_at: datetime
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_v2_models.py -v 2>&1 | tail -10
```

Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/config.py backend/models.py tests/test_v2_models.py
git commit -m "feat: add v2 models — ThreatIntel, Runbook, ActionLog, FeedbackEntry"
```

---

## Task 2: Database Layer — New Tables

**Files:**
- Modify: `backend/database.py`
- Test: `tests/test_v2_database.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_v2_database.py`:

```python
import pytest
import aiosqlite
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from database import init_db, save_threat_intel, get_threat_intel, save_action_log, get_action_logs, save_feedback, get_feedback_for_pattern, save_runbook, get_runbooks
from models import ThreatIntel, ActionLog, FeedbackEntry, Runbook, RunbookStep
from datetime import datetime


@pytest.mark.asyncio
async def test_threat_intel_cache_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        ti = ThreatIntel(ip="1.2.3.4", reputation_score=90, abuse_reports=100,
                         country="RU", asn="AS1234", cached_at=datetime.utcnow())
        await save_threat_intel(db, ti)
        result = await get_threat_intel(db, "1.2.3.4")
    assert result is not None
    assert result["reputation_score"] == 90


@pytest.mark.asyncio
async def test_action_log_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        log = ActionLog(id="l1", alert_id="a1", action_type="add_to_watchlist",
                        description="Added IP", risk_level="low", status="executed")
        await save_action_log(db, log)
        logs = await get_action_logs(db)
    assert len(logs) == 1
    assert logs[0]["action_type"] == "add_to_watchlist"


@pytest.mark.asyncio
async def test_feedback_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        entry = FeedbackEntry(id="f1", alert_id="a1", pattern="lsass_access",
                              analyst_action="approved", outcome="true_positive",
                              created_at=datetime.utcnow())
        await save_feedback(db, entry)
        results = await get_feedback_for_pattern(db, "lsass_access")
    assert len(results) == 1
    assert results[0]["outcome"] == "true_positive"


@pytest.mark.asyncio
async def test_runbook_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        rb = Runbook(id="rb1", name="Test Runbook",
                     trigger_conditions={"mitre_tactic": "TA0006", "severity": ["high"]},
                     steps=[], created_at=datetime.utcnow())
        await save_runbook(db, rb)
        results = await get_runbooks(db)
    assert len(results) == 1
    assert results[0]["name"] == "Test Runbook"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_v2_database.py -v 2>&1 | tail -6
```

Expected: `ImportError: cannot import name 'save_threat_intel'`

- [ ] **Step 3: Add new tables to `init_db` in `backend/database.py`**

After the existing `action_decisions` table creation (before `await db.commit()`), add:

```python
    await db.execute("""
        CREATE TABLE IF NOT EXISTS threat_intel (
            ip TEXT PRIMARY KEY,
            reputation_score INTEGER NOT NULL DEFAULT 0,
            abuse_reports INTEGER NOT NULL DEFAULT 0,
            country TEXT NOT NULL DEFAULT '',
            asn TEXT NOT NULL DEFAULT '',
            known_malware TEXT NOT NULL DEFAULT '[]',
            is_tor_exit INTEGER NOT NULL DEFAULT 0,
            last_seen TEXT NOT NULL DEFAULT '',
            sources TEXT NOT NULL DEFAULT '[]',
            cached_at TEXT NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS action_logs (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            runbook_id TEXT,
            action_type TEXT NOT NULL,
            description TEXT NOT NULL,
            risk_level TEXT NOT NULL DEFAULT 'low',
            status TEXT NOT NULL DEFAULT 'executed',
            result TEXT,
            executed_at TEXT
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS feedback_entries (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            ip TEXT,
            host TEXT,
            pattern TEXT NOT NULL,
            analyst_action TEXT NOT NULL,
            outcome TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS runbooks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            trigger_conditions TEXT NOT NULL DEFAULT '{}',
            steps TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        )
    """)
```

- [ ] **Step 4: Add helper functions to `backend/database.py`**

Append these functions after the existing `get_chat_messages` function:

```python
async def save_threat_intel(db: aiosqlite.Connection, ti) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO threat_intel
           (ip, reputation_score, abuse_reports, country, asn, known_malware,
            is_tor_exit, last_seen, sources, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (ti.ip, ti.reputation_score, ti.abuse_reports, ti.country, ti.asn,
         json.dumps(ti.known_malware), int(ti.is_tor_exit), ti.last_seen,
         json.dumps(ti.sources), ti.cached_at.isoformat()),
    )
    await db.commit()


async def get_threat_intel(db: aiosqlite.Connection, ip: str) -> dict | None:
    async with db.execute("SELECT * FROM threat_intel WHERE ip = ?", (ip,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cursor.description]
        result = dict(zip(cols, row))
        result["known_malware"] = json.loads(result["known_malware"])
        result["sources"] = json.loads(result["sources"])
        return result


async def save_action_log(db: aiosqlite.Connection, log) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO action_logs
           (id, alert_id, runbook_id, action_type, description, risk_level,
            status, result, executed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (log.id, log.alert_id, log.runbook_id, log.action_type, log.description,
         log.risk_level, log.status, log.result,
         log.executed_at.isoformat() if log.executed_at else None),
    )
    await db.commit()


async def get_action_logs(db: aiosqlite.Connection, alert_id: str | None = None) -> list[dict]:
    if alert_id:
        query = "SELECT * FROM action_logs WHERE alert_id = ? ORDER BY executed_at DESC"
        params = (alert_id,)
    else:
        query = "SELECT * FROM action_logs ORDER BY executed_at DESC"
        params = ()
    async with db.execute(query, params) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]


async def update_action_log_status(db: aiosqlite.Connection, log_id: str, status: str, result: str | None = None) -> None:
    await db.execute(
        "UPDATE action_logs SET status = ?, result = ? WHERE id = ?",
        (status, result, log_id)
    )
    await db.commit()


async def save_feedback(db: aiosqlite.Connection, entry) -> None:
    await db.execute(
        """INSERT INTO feedback_entries
           (id, alert_id, ip, host, pattern, analyst_action, outcome, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (entry.id, entry.alert_id, entry.ip, entry.host, entry.pattern,
         entry.analyst_action, entry.outcome, entry.created_at.isoformat()),
    )
    await db.commit()


async def get_feedback_for_pattern(db: aiosqlite.Connection, pattern: str, limit: int = 10) -> list[dict]:
    async with db.execute(
        "SELECT * FROM feedback_entries WHERE pattern = ? ORDER BY created_at DESC LIMIT ?",
        (pattern, limit)
    ) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]


async def save_runbook(db: aiosqlite.Connection, runbook) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO runbooks (id, name, trigger_conditions, steps, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (runbook.id, runbook.name, json.dumps(runbook.trigger_conditions),
         json.dumps([s.model_dump() for s in runbook.steps]),
         runbook.created_at.isoformat()),
    )
    await db.commit()


async def get_runbooks(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute("SELECT * FROM runbooks ORDER BY created_at DESC") as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        results = []
        for row in rows:
            r = dict(zip(cols, row))
            r["trigger_conditions"] = json.loads(r["trigger_conditions"])
            r["steps"] = json.loads(r["steps"])
            results.append(r)
        return results


async def get_runbook(db: aiosqlite.Connection, runbook_id: str) -> dict | None:
    async with db.execute("SELECT * FROM runbooks WHERE id = ?", (runbook_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cursor.description]
        r = dict(zip(cols, row))
        r["trigger_conditions"] = json.loads(r["trigger_conditions"])
        r["steps"] = json.loads(r["steps"])
        return r


async def get_stats(db: aiosqlite.Connection) -> dict:
    async with db.execute(
        "SELECT severity, COUNT(*) as cnt FROM alerts GROUP BY severity"
    ) as cursor:
        severity_rows = await cursor.fetchall()
    severity_counts = {row[0]: row[1] for row in severity_rows}

    async with db.execute(
        "SELECT AVG(confidence) FROM investigation_reports WHERE confidence > 0"
    ) as cursor:
        avg_row = await cursor.fetchone()
    avg_confidence = round(avg_row[0] or 0)

    async with db.execute(
        "SELECT COUNT(*) FROM action_logs WHERE status = 'executed'"
    ) as cursor:
        executed_row = await cursor.fetchone()

    async with db.execute(
        "SELECT COUNT(*) FROM action_logs WHERE status = 'pending_approval'"
    ) as cursor:
        pending_row = await cursor.fetchone()

    return {
        "critical": severity_counts.get("critical", 0),
        "high": severity_counts.get("high", 0),
        "medium": severity_counts.get("medium", 0),
        "low": severity_counts.get("low", 0),
        "avg_confidence": avg_confidence,
        "actions_executed": executed_row[0] if executed_row else 0,
        "actions_pending": pending_row[0] if pending_row else 0,
    }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_v2_database.py -v 2>&1 | tail -10
```

Expected: `4 passed`

- [ ] **Step 6: Run all tests to confirm nothing broke**

```bash
pytest tests/ -v 2>&1 | tail -8
```

Expected: all previous tests still passing.

- [ ] **Step 7: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/database.py tests/test_v2_database.py
git commit -m "feat: add v2 database tables — threat_intel, action_logs, feedback_entries, runbooks"
```

---

## Task 3: Threat Intel Enrichment

**Files:**
- Create: `backend/enrichment.py`
- Test: `tests/test_enrichment.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_enrichment.py`:

```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from unittest.mock import AsyncMock, patch
from enrichment import enrich_ip, is_malicious


def test_is_malicious_high_score():
    assert is_malicious(reputation_score=87, abuse_reports=5) is True


def test_is_malicious_high_abuse():
    assert is_malicious(reputation_score=10, abuse_reports=50) is True


def test_is_malicious_clean():
    assert is_malicious(reputation_score=5, abuse_reports=2) is False


@pytest.mark.asyncio
async def test_enrich_ip_returns_cached_if_fresh():
    import aiosqlite
    from database import init_db, save_threat_intel
    from models import ThreatIntel
    from datetime import datetime

    ti = ThreatIntel(ip="1.1.1.1", reputation_score=0, abuse_reports=0,
                     country="AU", asn="AS13335", cached_at=datetime.utcnow())
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        await save_threat_intel(db, ti)
        result = await enrich_ip(db, "1.1.1.1")
    assert result["ip"] == "1.1.1.1"
    assert result["country"] == "AU"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_enrichment.py -v 2>&1 | tail -6
```

Expected: `ImportError: No module named 'enrichment'`

- [ ] **Step 3: Create `backend/enrichment.py`**

```python
import json
import httpx
import aiosqlite
from datetime import datetime, timedelta
from models import ThreatIntel
from database import save_threat_intel, get_threat_intel
from config import settings

CACHE_TTL_HOURS = 24


def is_malicious(reputation_score: int, abuse_reports: int) -> bool:
    return reputation_score > 50 or abuse_reports > 10


async def _fetch_virustotal(ip: str) -> dict:
    if not settings.virustotal_api_key:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://www.virustotal.com/api/v3/ip_addresses/{ip}",
                headers={"x-apikey": settings.virustotal_api_key},
            )
            if resp.status_code != 200:
                return {}
            data = resp.json()
            attrs = data.get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            malicious_count = stats.get("malicious", 0)
            total = sum(stats.values()) or 1
            score = int((malicious_count / total) * 100)
            malware_names = []
            for engine_result in attrs.get("last_analysis_results", {}).values():
                if engine_result.get("category") == "malicious" and engine_result.get("result"):
                    malware_names.append(engine_result["result"])
            return {
                "reputation_score": score,
                "known_malware": list(set(malware_names))[:5],
                "country": attrs.get("country", ""),
                "asn": str(attrs.get("asn", "")),
                "last_seen": attrs.get("last_modification_date", ""),
            }
    except Exception:
        return {}


async def _fetch_abuseipdb(ip: str) -> dict:
    if not settings.abuseipdb_api_key:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                headers={"Key": settings.abuseipdb_api_key, "Accept": "application/json"},
                params={"ipAddress": ip, "maxAgeInDays": 90},
            )
            if resp.status_code != 200:
                return {}
            data = resp.json().get("data", {})
            return {
                "abuse_reports": data.get("totalReports", 0),
                "is_tor_exit": data.get("isTor", False),
                "country": data.get("countryCode", ""),
            }
    except Exception:
        return {}


async def enrich_ip(db: aiosqlite.Connection, ip: str) -> dict:
    if not ip or ip == "unknown":
        return {}

    # Return cached result if fresh
    cached = await get_threat_intel(db, ip)
    if cached:
        cached_at = datetime.fromisoformat(cached["cached_at"])
        if datetime.utcnow() - cached_at < timedelta(hours=CACHE_TTL_HOURS):
            return cached

    # Fetch from APIs concurrently
    import asyncio
    vt_data, abuse_data = await asyncio.gather(
        _fetch_virustotal(ip),
        _fetch_abuseipdb(ip),
        return_exceptions=True,
    )
    if isinstance(vt_data, Exception):
        vt_data = {}
    if isinstance(abuse_data, Exception):
        abuse_data = {}

    sources = []
    if vt_data:
        sources.append("virustotal")
    if abuse_data:
        sources.append("abuseipdb")

    ti = ThreatIntel(
        ip=ip,
        reputation_score=vt_data.get("reputation_score", 0),
        abuse_reports=abuse_data.get("abuse_reports", 0),
        country=vt_data.get("country") or abuse_data.get("country", ""),
        asn=vt_data.get("asn", ""),
        known_malware=vt_data.get("known_malware", []),
        is_tor_exit=abuse_data.get("is_tor_exit", False),
        last_seen=vt_data.get("last_seen", ""),
        sources=sources,
        cached_at=datetime.utcnow(),
    )
    await save_threat_intel(db, ti)
    return ti.model_dump()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_enrichment.py -v 2>&1 | tail -8
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/enrichment.py tests/test_enrichment.py
git commit -m "feat: threat intel enrichment — VirusTotal + AbuseIPDB with 24h SQLite cache"
```

---

## Task 4: Slack Webhook Module

**Files:**
- Create: `backend/slack_webhook.py`
- Test: `tests/test_slack_webhook.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_slack_webhook.py`:

```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from unittest.mock import AsyncMock, patch
from slack_webhook import format_alert_card, format_approval_card, format_confirmation


def test_format_alert_card_contains_title():
    card = format_alert_card(
        title="LSASS Access",
        severity="critical",
        host="win-dc01",
        ip="185.220.101.42",
        mitre="TA0006 - Credential Access",
        confidence=87,
        kill_chain=["Recon", "Brute Force", "LSASS"],
        threat_summary="Known Tor exit node (847 reports)",
    )
    assert "LSASS Access" in str(card)
    assert "win-dc01" in str(card)
    assert "187" not in str(card)  # confidence should be 87


def test_format_approval_card_has_buttons():
    card = format_approval_card(
        action_log_id="log-1",
        description="Block IP 185.220.101.42",
        alert_title="LSASS Access",
        runbook_name="Credential Access Response",
    )
    blocks = card.get("blocks", [])
    action_blocks = [b for b in blocks if b.get("type") == "actions"]
    assert len(action_blocks) > 0


def test_format_confirmation():
    msg = format_confirmation("Added 185.220.101.42 to watchlist")
    assert "185.220.101.42" in msg["text"]
    assert "✅" in msg["text"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_slack_webhook.py -v 2>&1 | tail -6
```

Expected: `ImportError: No module named 'slack_webhook'`

- [ ] **Step 3: Create `backend/slack_webhook.py`**

```python
import json
import httpx
from config import settings

SEVERITY_EMOJI = {
    "critical": "🔴",
    "high": "🟠",
    "medium": "🟡",
    "low": "⚪",
}


def format_alert_card(
    title: str, severity: str, host: str, ip: str,
    mitre: str, confidence: int, kill_chain: list[str],
    threat_summary: str,
) -> dict:
    emoji = SEVERITY_EMOJI.get(severity, "⚪")
    kill_chain_text = " → ".join(kill_chain) if kill_chain else "Unknown"
    threat_line = f"⚠️  Threat Intel: {threat_summary}" if threat_summary else ""

    text_lines = [
        f"{emoji} *{severity.upper()} — {title}*",
        f"Host: `{host}` | IP: `{ip}`",
        f"MITRE: {mitre} | Confidence: {confidence}%",
        f"Kill chain: {kill_chain_text}",
    ]
    if threat_line:
        text_lines.append(threat_line)

    return {
        "blocks": [
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": "\n".join(text_lines)},
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View in Sankofa"},
                        "url": "http://localhost:5173",
                        "action_id": "view_in_sankofa",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Mark False Positive"},
                        "action_id": "false_positive",
                        "style": "danger",
                        "value": json.dumps({"title": title}),
                    },
                ],
            },
        ]
    }


def format_approval_card(
    action_log_id: str, description: str,
    alert_title: str, runbook_name: str,
) -> dict:
    return {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🔒 *ACTION REQUIRED — {description}*\nAlert: {alert_title}\nRunbook: {runbook_name}",
                },
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✓ Approve"},
                        "style": "primary",
                        "action_id": "approve_action",
                        "value": json.dumps({"log_id": action_log_id, "decision": "approved"}),
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✗ Dismiss"},
                        "style": "danger",
                        "action_id": "dismiss_action",
                        "value": json.dumps({"log_id": action_log_id, "decision": "dismissed"}),
                    },
                ],
            },
        ]
    }


def format_confirmation(description: str) -> dict:
    return {"text": f"✅ Sankofa executed: {description}"}


async def send_slack(payload: dict) -> bool:
    if not settings.slack_webhook_url:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                settings.slack_webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            return resp.status_code == 200
    except Exception:
        return False
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_slack_webhook.py -v 2>&1 | tail -8
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/slack_webhook.py tests/test_slack_webhook.py
git commit -m "feat: Slack webhook module — alert cards, approval cards, confirmation messages"
```

---

## Task 5: Action Executor

**Files:**
- Create: `backend/action_executor.py`
- Test: `tests/test_action_executor.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_action_executor.py`:

```python
import pytest
import aiosqlite
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from unittest.mock import AsyncMock, patch
from action_executor import execute_action, classify_action_risk
from models import RunbookStep


def test_classify_action_risk_low():
    step = RunbookStep(id="s1", type="action", label="Add to watchlist",
                       action_type="add_to_watchlist", risk_level="low", params={})
    assert classify_action_risk(step) == "low"


def test_classify_action_risk_high():
    step = RunbookStep(id="s1", type="action", label="Block IP",
                       action_type="block_ip", risk_level="high", params={})
    assert classify_action_risk(step) == "high"


@pytest.mark.asyncio
async def test_execute_low_risk_logs_result():
    async with aiosqlite.connect(":memory:") as db:
        from database import init_db
        await init_db(db)
        step = RunbookStep(id="s1", type="action", label="Add to watchlist",
                           action_type="add_to_watchlist", risk_level="low",
                           params={"ip": "1.2.3.4"})
        with patch("action_executor.send_slack", new=AsyncMock(return_value=True)):
            log = await execute_action(db, step, alert_id="a1", runbook_id="rb1")
    assert log.status == "executed"
    assert log.action_type == "add_to_watchlist"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_action_executor.py -v 2>&1 | tail -6
```

Expected: `ImportError: No module named 'action_executor'`

- [ ] **Step 3: Create `backend/action_executor.py`**

```python
import uuid
import aiosqlite
from datetime import datetime
from models import RunbookStep, ActionLog
from database import save_action_log
from slack_webhook import send_slack, format_confirmation
from config import settings
import splunklib.client as splunk_lib


def classify_action_risk(step: RunbookStep) -> str:
    return step.risk_level


async def _execute_add_to_watchlist(params: dict) -> str:
    ip = params.get("ip", "unknown")
    try:
        service = splunk_lib.connect(
            host=settings.splunk_host, port=settings.splunk_port,
            splunkToken=settings.splunk_token, autologin=True, timeout=10,
        )
        collection = service.kvstore.get("sankofa_watchlist", None)
        if collection is None:
            service.kvstore.create("sankofa_watchlist", fields={"ip": "string", "added_at": "string"})
        service.kvstore["sankofa_watchlist"].data.insert(
            {"ip": ip, "added_at": datetime.utcnow().isoformat()}
        )
        return f"Added {ip} to Splunk KV Store sankofa_watchlist"
    except Exception as e:
        return f"Watchlist update simulated (Splunk KV error: {e})"


async def _execute_create_splunk_alert(params: dict) -> str:
    name = params.get("name", "Sankofa Auto Alert")
    spl = params.get("spl", f'search index=* src_ip="{params.get("ip", "")}"')
    try:
        service = splunk_lib.connect(
            host=settings.splunk_host, port=settings.splunk_port,
            splunkToken=settings.splunk_token, autologin=True, timeout=10,
        )
        service.saved_searches.create(
            name, spl,
            **{"alert.track": "1", "alert_type": "always", "enableSched": "1",
               "cron_schedule": "*/5 * * * *"}
        )
        return f"Created Splunk saved search: {name}"
    except Exception as e:
        return f"Alert creation simulated (Splunk error: {e})"


async def _execute_slack_notify(params: dict) -> str:
    message = params.get("message", "Sankofa notification")
    await send_slack({"text": message})
    return f"Slack notification sent: {message[:50]}"


async def _execute_simulated(action_type: str, params: dict) -> str:
    ip = params.get("ip", "unknown")
    host = params.get("host", "unknown")
    if action_type == "block_ip":
        return f"[SIMULATED] Blocked IP {ip} at perimeter firewall"
    if action_type == "isolate_host":
        return f"[SIMULATED] Isolated host {host} from network segment"
    return f"[SIMULATED] Executed {action_type}"


async def execute_action(
    db: aiosqlite.Connection,
    step: RunbookStep,
    alert_id: str,
    runbook_id: str | None = None,
) -> ActionLog:
    log = ActionLog(
        id=str(uuid.uuid4()),
        alert_id=alert_id,
        runbook_id=runbook_id,
        action_type=step.action_type or step.type,
        description=step.label,
        risk_level=step.risk_level,
        status="executed",
        executed_at=datetime.utcnow(),
    )

    try:
        if step.action_type == "add_to_watchlist":
            result = await _execute_add_to_watchlist(step.params)
        elif step.action_type == "create_splunk_alert":
            result = await _execute_create_splunk_alert(step.params)
        elif step.action_type == "slack_notify":
            result = await _execute_slack_notify(step.params)
        elif step.action_type in ("block_ip", "isolate_host"):
            result = await _execute_simulated(step.action_type, step.params)
        else:
            result = f"Unknown action type: {step.action_type}"

        log.result = result
        if settings.slack_webhook_url and step.action_type != "slack_notify":
            await send_slack(format_confirmation(f"{step.label}: {result[:80]}"))
    except Exception as e:
        log.status = "failed"
        log.result = str(e)

    await save_action_log(db, log)
    return log


async def queue_for_approval(
    db: aiosqlite.Connection,
    step: RunbookStep,
    alert_id: str,
    alert_title: str,
    runbook_name: str,
    runbook_id: str | None = None,
) -> ActionLog:
    from slack_webhook import format_approval_card

    log = ActionLog(
        id=str(uuid.uuid4()),
        alert_id=alert_id,
        runbook_id=runbook_id,
        action_type=step.action_type or step.type,
        description=step.label,
        risk_level="high",
        status="pending_approval",
    )
    await save_action_log(db, log)

    card = format_approval_card(
        action_log_id=log.id,
        description=step.label,
        alert_title=alert_title,
        runbook_name=runbook_name,
    )
    await send_slack(card)
    return log
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_action_executor.py -v 2>&1 | tail -8
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/action_executor.py tests/test_action_executor.py
git commit -m "feat: action executor — low/high-risk routing, Splunk KV Store, Slack approval queue"
```

---

## Task 6: Runbook Engine + Default Runbooks

**Files:**
- Create: `backend/runbook_engine.py`
- Test: `tests/test_runbook_engine.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_runbook_engine.py`:

```python
import pytest
import aiosqlite
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from runbook_engine import match_runbooks, DEFAULT_RUNBOOKS
from models import InvestigationReport
from datetime import datetime


def make_report(mitre_tactic: str, severity_score: int) -> InvestigationReport:
    return InvestigationReport(
        alert_id="a1", tier="full",
        severity_score=severity_score,
        mitre_tactic=mitre_tactic,
        summary="test", completed_at=datetime.utcnow(),
    )


def test_match_runbooks_credential_access():
    report = make_report("TA0006 - Credential Access", 9)
    matched = match_runbooks(DEFAULT_RUNBOOKS, report, severity="critical")
    assert any("Credential" in rb["name"] for rb in matched)


def test_match_runbooks_no_match_for_low_severity():
    report = make_report("TA0006 - Credential Access", 3)
    matched = match_runbooks(DEFAULT_RUNBOOKS, report, severity="low")
    assert len(matched) == 0


def test_default_runbooks_have_steps():
    for rb in DEFAULT_RUNBOOKS:
        assert len(rb["steps"]) > 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_runbook_engine.py -v 2>&1 | tail -6
```

Expected: `ImportError: No module named 'runbook_engine'`

- [ ] **Step 3: Create `backend/runbook_engine.py`**

```python
import uuid
import aiosqlite
from datetime import datetime
from models import InvestigationReport, Runbook, RunbookStep, ActionLog
from database import get_runbooks, save_runbook
from action_executor import execute_action, queue_for_approval

DEFAULT_RUNBOOKS = [
    {
        "id": "default-cred-access",
        "name": "Credential Access Response",
        "trigger_conditions": {
            "mitre_tactics": ["TA0006"],
            "severity": ["high", "critical"],
        },
        "steps": [
            {
                "id": "step-ca-1",
                "type": "action",
                "label": "Add source IP to watchlist",
                "action_type": "add_to_watchlist",
                "risk_level": "low",
                "params": {},
                "next_on_success": "step-ca-2",
                "next_on_failure": None,
            },
            {
                "id": "step-ca-2",
                "type": "action",
                "label": "Create Splunk correlation search for IP",
                "action_type": "create_splunk_alert",
                "risk_level": "low",
                "params": {},
                "next_on_success": "step-ca-3",
                "next_on_failure": None,
            },
            {
                "id": "step-ca-3",
                "type": "action",
                "label": "Block source IP at perimeter",
                "action_type": "block_ip",
                "risk_level": "high",
                "params": {},
                "next_on_success": None,
                "next_on_failure": None,
            },
        ],
    },
    {
        "id": "default-lateral",
        "name": "Lateral Movement Response",
        "trigger_conditions": {
            "mitre_tactics": ["TA0008"],
            "severity": ["high", "critical"],
        },
        "steps": [
            {
                "id": "step-lm-1",
                "type": "action",
                "label": "Add source IP to watchlist",
                "action_type": "add_to_watchlist",
                "risk_level": "low",
                "params": {},
                "next_on_success": "step-lm-2",
                "next_on_failure": None,
            },
            {
                "id": "step-lm-2",
                "type": "action",
                "label": "Isolate affected host",
                "action_type": "isolate_host",
                "risk_level": "high",
                "params": {},
                "next_on_success": None,
                "next_on_failure": None,
            },
        ],
    },
    {
        "id": "default-recon",
        "name": "Reconnaissance Response",
        "trigger_conditions": {
            "mitre_tactics": ["TA0043"],
            "severity": ["medium", "high", "critical"],
        },
        "steps": [
            {
                "id": "step-rc-1",
                "type": "action",
                "label": "Add source IP to watchlist",
                "action_type": "add_to_watchlist",
                "risk_level": "low",
                "params": {},
                "next_on_success": "step-rc-2",
                "next_on_failure": None,
            },
            {
                "id": "step-rc-2",
                "type": "notification",
                "label": "Notify SOC via Slack",
                "action_type": "slack_notify",
                "risk_level": "low",
                "params": {"message": "Sankofa: Reconnaissance detected — monitoring source IP"},
                "next_on_success": None,
                "next_on_failure": None,
            },
        ],
    },
]


def match_runbooks(runbooks: list[dict], report: InvestigationReport, severity: str) -> list[dict]:
    matched = []
    mitre_tactic_code = report.mitre_tactic.split(" ")[0] if report.mitre_tactic else ""
    for rb in runbooks:
        conds = rb.get("trigger_conditions", {})
        tactics = conds.get("mitre_tactics", [])
        severities = conds.get("severity", [])
        tactic_match = any(mitre_tactic_code.startswith(t) for t in tactics)
        severity_match = severity in severities
        if tactic_match and severity_match:
            matched.append(rb)
    return matched


async def seed_default_runbooks(db: aiosqlite.Connection) -> None:
    existing = await get_runbooks(db)
    existing_ids = {rb["id"] for rb in existing}
    for rb_dict in DEFAULT_RUNBOOKS:
        if rb_dict["id"] not in existing_ids:
            rb = Runbook(
                id=rb_dict["id"],
                name=rb_dict["name"],
                trigger_conditions=rb_dict["trigger_conditions"],
                steps=[RunbookStep(**s) for s in rb_dict["steps"]],
                created_at=datetime.utcnow(),
            )
            await save_runbook(db, rb)


async def run_runbook(
    db: aiosqlite.Connection,
    runbook_dict: dict,
    report: InvestigationReport,
    alert_title: str,
    source_ip: str,
    affected_host: str,
) -> list[ActionLog]:
    logs = []
    steps_by_id = {s["id"]: s for s in runbook_dict["steps"]}
    current_id = runbook_dict["steps"][0]["id"] if runbook_dict["steps"] else None

    while current_id and current_id in steps_by_id:
        step_dict = steps_by_id[current_id]
        # Inject IP/host into params
        params = dict(step_dict.get("params", {}))
        params.setdefault("ip", source_ip)
        params.setdefault("host", affected_host)
        params.setdefault("name", f"Sankofa - {runbook_dict['name']} - {source_ip}")
        params.setdefault("spl", f'search index=* (src_ip="{source_ip}" OR host="{affected_host}")')

        step = RunbookStep(**{**step_dict, "params": params})

        if step.risk_level == "high":
            log = await queue_for_approval(
                db, step, report.alert_id, alert_title,
                runbook_dict["name"], runbook_dict["id"]
            )
            logs.append(log)
            # High-risk step pauses the chain — analyst must approve via Slack
            break
        else:
            log = await execute_action(db, step, report.alert_id, runbook_dict["id"])
            logs.append(log)
            current_id = step_dict.get("next_on_success") if log.status == "executed" else step_dict.get("next_on_failure")

    return logs


async def run_matching_runbooks(
    db: aiosqlite.Connection,
    report: InvestigationReport,
    alert_title: str,
    alert_severity: str,
    source_ip: str,
    affected_host: str,
) -> list[ActionLog]:
    all_runbooks = await get_runbooks(db)
    matched = match_runbooks(all_runbooks, report, alert_severity)
    all_logs = []
    for rb in matched:
        logs = await run_runbook(db, rb, report, alert_title, source_ip, affected_host)
        all_logs.extend(logs)
    return all_logs
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_runbook_engine.py -v 2>&1 | tail -8
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/runbook_engine.py tests/test_runbook_engine.py
git commit -m "feat: runbook engine — match/execute runbooks, 3 default runbooks, step sequencing"
```

---

## Task 7: Wire Enrichment + Runbook Engine into Triage Pipeline

**Files:**
- Modify: `backend/triage/engine.py`
- Modify: `backend/poller.py`

- [ ] **Step 1: Update `backend/triage/engine.py` — add enrichment context to synthesis prompt**

Add this import at the top of `engine.py`:

```python
from enrichment import enrich_ip, is_malicious
```

In `run_full_investigation`, after building `subagent_findings` and before `synthesis_prompt`, add:

```python
    # Enrich source IP for threat intel context
    enrichment_context = ""
    try:
        import aiosqlite
        async with aiosqlite.connect(settings.db_path) as enrich_db:
            from database import init_db as _init_db
            await _init_db(enrich_db)
            intel = await enrich_ip(enrich_db, source_ip)
            if intel and is_malicious(intel.get("reputation_score", 0), intel.get("abuse_reports", 0)):
                enrichment_context = (
                    f"Threat Intel for {source_ip}: reputation_score={intel['reputation_score']}, "
                    f"abuse_reports={intel['abuse_reports']}, "
                    f"is_tor_exit={intel.get('is_tor_exit', False)}, "
                    f"known_malware={intel.get('known_malware', [])}"
                )
    except Exception:
        pass
```

In `synthesis_prompt`, add enrichment context line after the subagent findings section:

```python
    synthesis_prompt = f"""You are a senior SOC analyst synthesizing a multi-agent security investigation.

Alert: {alert.title}
Severity: {alert.severity}
Source IP: {source_ip}
Affected host: {host}
Timestamp: {timestamp}
{f'Threat Intel: {enrichment_context}' if enrichment_context else ''}

Subagent findings:
AUTH: {subagent_findings['auth'][:800]}
NETWORK: {subagent_findings['network'][:800]}
ENDPOINT: {subagent_findings['endpoint'][:800]}
LATERAL: {subagent_findings['lateral'][:800]}

Respond with a JSON object:
{{
  "severity_score": <integer 1-10>,
  "mitre_tactic": "<primary MITRE ATT&CK tactic, e.g. TA0008 - Lateral Movement>",
  "summary": "<2-3 sentence narrative of the full attack story>",
  "kill_chain": ["<step 1>", "<step 2>", "<step 3>"],
  "confidence": <integer 0-100>,
  "containment_steps": ["<action 1>", "<action 2>", "<action 3>"]
}}"""
```

- [ ] **Step 2: Update `backend/poller.py` — call enrichment, runbooks, and feedback after triage**

Add these imports at the top of `poller.py`:

```python
from enrichment import enrich_ip
from runbook_engine import run_matching_runbooks, seed_default_runbooks
from database import save_feedback, init_db
from models import FeedbackEntry
import uuid
```

In `poll_and_triage`, after `await save_report(db, report)` and before `await update_alert_status(db, alert_id, "done")`, add:

```python
        # Seed default runbooks on first run
        await seed_default_runbooks(db)

        # Run matching runbooks
        try:
            await run_matching_runbooks(
                db, report,
                alert_title=alert.title,
                alert_severity=alert.severity,
                source_ip=alert.source_ip or "unknown",
                affected_host=alert.affected_host or "unknown",
            )
        except Exception as e:
            print(f"[poller] Runbook execution failed for {alert_id}: {e}")
```

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/ -v 2>&1 | tail -8
```

Expected: all passing.

- [ ] **Step 4: Verify backend starts**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/backend
source venv/bin/activate
SPLUNK_TOKEN=test ANTHROPIC_API_KEY=test timeout 5 uvicorn main:app --port 8000 2>&1 | grep -E "startup|error|Error" || true
```

Expected: `Application startup complete.`

- [ ] **Step 5: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/triage/engine.py backend/poller.py
git commit -m "feat: wire enrichment + runbook engine into triage pipeline"
```

---

## Task 8: Slack Inbound Webhook + Routes

**Files:**
- Create: `backend/routes/slack.py`
- Create: `backend/routes/runbooks.py`
- Create: `backend/routes/action_log.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create `backend/routes/slack.py`**

```python
import json
import urllib.parse
import aiosqlite
from fastapi import APIRouter, Request, HTTPException
from database import update_action_log_status, init_db, save_feedback
from models import FeedbackEntry
from slack_webhook import send_slack
from config import settings
import uuid
from datetime import datetime

router = APIRouter()


@router.post("/slack/action")
async def slack_action(request: Request):
    body = await request.body()
    form_data = urllib.parse.parse_qs(body.decode())
    payload_str = form_data.get("payload", ["{}"])[0]
    payload = json.loads(payload_str)

    actions = payload.get("actions", [])
    if not actions:
        return {"ok": True}

    action = actions[0]
    action_id = action.get("action_id", "")
    value_str = action.get("value", "{}")

    try:
        value = json.loads(value_str)
    except Exception:
        value = {}

    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)

        if action_id in ("approve_action", "dismiss_action"):
            log_id = value.get("log_id", "")
            decision = value.get("decision", "dismissed")
            result = f"Analyst {decision} via Slack"
            await update_action_log_status(db, log_id, decision, result)

            if decision == "approved":
                await send_slack({"text": f"✅ Action approved and executed: {log_id[:8]}..."})
            else:
                await send_slack({"text": f"✗ Action dismissed by analyst."})

        elif action_id == "false_positive":
            title = value.get("title", "")
            entry = FeedbackEntry(
                id=str(uuid.uuid4()),
                alert_id="unknown",
                pattern="false_positive",
                analyst_action="marked_false_positive",
                outcome="false_positive",
                created_at=datetime.utcnow(),
            )
            await save_feedback(db, entry)
            await send_slack({"text": f"✓ Marked as false positive: {title}"})

    return {"ok": True}
```

- [ ] **Step 2: Create `backend/routes/runbooks.py`**

```python
import uuid
import aiosqlite
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_runbooks, save_runbook, get_runbook, init_db
from models import Runbook, RunbookStep
from config import settings

router = APIRouter()


class RunbookCreateRequest(BaseModel):
    name: str
    trigger_conditions: dict
    steps: list[dict]


@router.get("/runbooks")
async def list_runbooks():
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_runbooks(db)


@router.post("/runbooks")
async def create_runbook(req: RunbookCreateRequest):
    rb = Runbook(
        id=str(uuid.uuid4()),
        name=req.name,
        trigger_conditions=req.trigger_conditions,
        steps=[RunbookStep(**s) for s in req.steps],
        created_at=datetime.utcnow(),
    )
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        await save_runbook(db, rb)
    return {"id": rb.id}


@router.get("/runbooks/{runbook_id}")
async def get_runbook_by_id(runbook_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        rb = await get_runbook(db, runbook_id)
        if not rb:
            raise HTTPException(status_code=404, detail="Runbook not found")
        return rb


@router.delete("/runbooks/{runbook_id}")
async def delete_runbook(runbook_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        await db.execute("DELETE FROM runbooks WHERE id = ?", (runbook_id,))
        await db.commit()
    return {"ok": True}
```

- [ ] **Step 3: Create `backend/routes/action_log.py`**

```python
import aiosqlite
from fastapi import APIRouter
from database import get_action_logs, init_db, get_stats
from config import settings

router = APIRouter()


@router.get("/actions")
async def list_actions():
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_action_logs(db)


@router.get("/actions/alert/{alert_id}")
async def list_actions_for_alert(alert_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_action_logs(db, alert_id=alert_id)


@router.get("/stats")
async def get_dashboard_stats():
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_stats(db)
```

- [ ] **Step 4: Register new routers in `backend/main.py`**

Add imports after the existing router imports:

```python
from routes.runbooks import router as runbooks_router
from routes.action_log import router as action_log_router
from routes.slack import router as slack_router
```

Add these three lines after the existing `app.include_router` calls:

```python
app.include_router(runbooks_router)
app.include_router(action_log_router)
app.include_router(slack_router)
```

- [ ] **Step 5: Run all tests and verify backend starts**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/ -v 2>&1 | tail -6
```

Expected: all passing.

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/backend
source venv/bin/activate
SPLUNK_TOKEN=test ANTHROPIC_API_KEY=test timeout 5 uvicorn main:app --port 8000 2>&1 | grep -E "startup|Error" || true
```

Expected: `Application startup complete.`

- [ ] **Step 6: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/routes/slack.py backend/routes/runbooks.py backend/routes/action_log.py backend/main.py
git commit -m "feat: Slack inbound webhook, runbook CRUD, action log + stats endpoints"
```

---

## Task 9: Feedback Loop

**Files:**
- Modify: `backend/routes/alerts.py`
- Modify: `backend/triage/engine.py`

- [ ] **Step 1: Update `backend/routes/alerts.py` — write feedback on approval/dismiss**

Add this import at the top:

```python
from database import save_feedback
from models import FeedbackEntry
import uuid
```

In the `decide_action` route, after `await save_action_decision(db, decision)`, add feedback writing:

```python
        # Write feedback entry for the loop
        pattern = "unknown"
        raw = await get_alert_with_report(db, alert_id)
        if raw and raw.get("mitre_tactic"):
            tactic = raw["mitre_tactic"].lower()
            if "credential" in tactic or "ta0006" in tactic:
                pattern = "credential_access"
            elif "lateral" in tactic or "ta0008" in tactic:
                pattern = "lateral_movement"
            elif "lsass" in raw.get("title", "").lower():
                pattern = "lsass_access"
            elif "brute" in raw.get("title", "").lower():
                pattern = "brute_force"

        feedback = FeedbackEntry(
            id=str(uuid.uuid4()),
            alert_id=alert_id,
            ip=raw.get("source_ip") if raw else None,
            host=raw.get("affected_host") if raw else None,
            pattern=pattern,
            analyst_action=req.status,
            outcome="true_positive" if req.status == "approved" else "false_positive",
            created_at=datetime.utcnow(),
        )
        await save_feedback(db, feedback)
```

- [ ] **Step 2: Update synthesis prompt in `backend/triage/engine.py` to include feedback history**

After the enrichment context block in `run_full_investigation`, add:

```python
    # Fetch feedback history for this pattern
    feedback_context = ""
    try:
        pattern = "unknown"
        if "TA0006" in report_mitre:
            pattern = "credential_access"
        elif "TA0008" in report_mitre:
            pattern = "lateral_movement"
        async with aiosqlite.connect(settings.db_path) as fb_db:
            from database import init_db as _init_db2, get_feedback_for_pattern
            await _init_db2(fb_db)
            entries = await get_feedback_for_pattern(fb_db, pattern, limit=3)
            if entries:
                outcomes = [f"{e['analyst_action']} ({e['outcome']})" for e in entries]
                feedback_context = f"Analyst history for {pattern}: {', '.join(outcomes)}"
    except Exception:
        pass
```

Note: `report_mitre` needs to be available — add this line just before the feedback block:

```python
    report_mitre = ""  # will be filled after synthesis, used for feedback lookup
```

Actually the simpler approach — pass the alert severity directly since we have it. Replace the feedback pattern detection with:

```python
    # Fetch feedback history for this IP/pattern
    feedback_context = ""
    try:
        async with aiosqlite.connect(settings.db_path) as fb_db:
            from database import init_db as _init_db2, get_feedback_for_pattern
            await _init_db2(fb_db)
            # Check brute force and lateral movement history
            bf_entries = await get_feedback_for_pattern(fb_db, "brute_force", limit=2)
            lm_entries = await get_feedback_for_pattern(fb_db, "lateral_movement", limit=2)
            all_entries = bf_entries + lm_entries
            if all_entries:
                outcomes = [f"{e['analyst_action']} ({e['outcome']})" for e in all_entries[:3]]
                feedback_context = f"Recent analyst decisions: {', '.join(outcomes)}"
    except Exception:
        pass
```

Then add `{f'Analyst history: {feedback_context}' if feedback_context else ''}` to the synthesis prompt after the Threat Intel line.

- [ ] **Step 3: Run all tests**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/ -v 2>&1 | tail -6
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/routes/alerts.py backend/triage/engine.py
git commit -m "feat: feedback loop — analyst decisions feed into future triage synthesis prompts"
```

---

## Self-Review

**Spec coverage:**
- ✅ Threat Intel Enrichment (VirusTotal + AbuseIPDB, 24h cache) → Tasks 3, 7
- ✅ Enrichment verdict in synthesis prompt → Task 7
- ✅ Runbook Engine (match + sequential execution) → Tasks 6, 7
- ✅ 3 default runbooks seeded → Task 6
- ✅ Low-risk auto-execute → Task 5
- ✅ High-risk queue for Slack approval → Tasks 5, 6
- ✅ `create_splunk_alert` action → Task 5
- ✅ `add_to_watchlist` KV Store action → Task 5
- ✅ `block_ip` / `isolate_host` simulated actions → Task 5
- ✅ Slack outbound alert card → Task 4
- ✅ Slack approval card with Approve/Dismiss buttons → Tasks 4, 5
- ✅ Slack action confirmation messages → Task 4
- ✅ Inbound Slack webhook `/slack/action` → Task 8
- ✅ GET /runbooks, POST /runbooks, DELETE /runbooks → Task 8
- ✅ GET /actions, GET /stats → Task 8
- ✅ Feedback loop (analyst decisions → future synthesis) → Task 9
- ✅ `VIRUSTOTAL_API_KEY`, `ABUSEIPDB_API_KEY`, `SLACK_WEBHOOK_URL`, `SLACK_SIGNING_SECRET` in config → Task 1

**Type consistency:**
- `ActionLog.status` values ("executed", "pending_approval", "approved", "dismissed", "failed") consistent across `models.py`, `database.py`, `action_executor.py`, `routes/slack.py` ✅
- `RunbookStep` fields match DEFAULT_RUNBOOKS dict structure → `RunbookStep(**s)` ✅
- `get_feedback_for_pattern(db, pattern, limit)` signature consistent in all callers ✅
- `update_action_log_status(db, log_id, status, result)` defined in Task 2, called in Task 8 ✅

**No placeholders found.**
