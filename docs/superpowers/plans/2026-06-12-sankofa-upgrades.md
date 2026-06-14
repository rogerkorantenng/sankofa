# Sankofa Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Sankofa from a working prototype to a competitive hackathon entry by wiring in MCP, adding auditability, human approval gates, a connected attack narrative, and Splunk app packaging.

**Architecture:** Five independent upgrades applied to the existing FastAPI + React codebase. Each task is self-contained — MCP wiring adds a new `mcp_client.py`, auditability extends `subagents.py` and `InvestigationReport`, approval gate adds a new DB table + endpoint + UI component, narrative replaces seed data, and packaging creates a `splunk_app/` directory.

**Tech Stack:** Python 3.13, FastAPI, mcp>=1.27.2, splunklib, anthropic AsyncAnthropic, React 18, Vite, Tailwind, Zustand, SQLite/aiosqlite.

---

## File Structure (new/modified)

```
sankofa/
├── backend/
│   ├── mcp_client.py              # NEW: MCP Server connection + tool execution
│   ├── triage/
│   │   ├── subagents.py           # MODIFY: record spl_queries per subagent
│   │   └── engine.py              # MODIFY: pass mcp_client to subagents, include queries in report
│   ├── models.py                  # MODIFY: add spl_queries to InvestigationReport; add ActionDecision
│   ├── database.py                # MODIFY: add action_decisions table; save/get action decisions
│   └── routes/
│       └── alerts.py              # MODIFY: add POST /alerts/{id}/actions/{idx}/decide
├── frontend/src/
│   ├── types.ts                   # MODIFY: add spl_queries, ActionDecision
│   ├── api.ts                     # MODIFY: add decideAction()
│   └── components/
│       ├── ReportCard.tsx         # MODIFY: show spl_queries per subagent + approval gate UI
│       └── AuditTrail.tsx         # NEW: collapsible SPL evidence per subagent
├── seed/
│   └── campaign_alerts.json       # NEW: 5-alert connected attack campaign
└── splunk_app/
    ├── app.conf                   # NEW: Splunk app metadata
    ├── default/
    │   └── savedsearches.conf     # NEW: saved searches for the app
    └── appserver/static/
        └── dashboard.json         # NEW: Dashboard Studio v2 JSON
```

---

## Task 1: Wire Splunk MCP Server into Agent Reasoning

**Files:**
- Create: `backend/mcp_client.py`
- Modify: `backend/triage/subagents.py`
- Modify: `backend/config.py`
- Test: `tests/test_mcp_client.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_mcp_client.py`:

```python
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from unittest.mock import AsyncMock, patch, MagicMock
from mcp_client import MCPClient, MCPToolResult


def test_mcp_tool_result_fields():
    result = MCPToolResult(tool_name="run_splunk_query", output="test output", spl_used="search index=*")
    assert result.tool_name == "run_splunk_query"
    assert result.output == "test output"
    assert result.spl_used == "search index=*"


@pytest.mark.asyncio
async def test_mcp_client_falls_back_on_connection_error():
    with patch("mcp_client.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post.side_effect = Exception("connection refused")
        client = MCPClient(base_url="https://localhost:8089/services/mcp", token="test")
        result = await client.run_splunk_query("search index=*")
    assert "unavailable" in result.output.lower() or "error" in result.output.lower()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_mcp_client.py -v
```

Expected: `ImportError: No module named 'mcp_client'`

- [ ] **Step 3: Create `backend/mcp_client.py`**

```python
import json
from dataclasses import dataclass, field
import httpx
from config import settings


@dataclass
class MCPToolResult:
    tool_name: str
    output: str
    spl_used: str = ""


class MCPClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def _call_tool(self, tool_name: str, arguments: dict) -> str:
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
            "id": 1,
        }
        try:
            async with httpx.AsyncClient(verify=False, timeout=15) as client:
                resp = await client.post(
                    f"{self.base_url}",
                    headers=self.headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                result = data.get("result", {})
                content = result.get("content", [])
                if content and isinstance(content, list):
                    return content[0].get("text", str(result))
                return str(result)
        except Exception as e:
            return f"MCP unavailable: {e}"

    async def run_splunk_query(self, spl: str, earliest: str = "-30m") -> MCPToolResult:
        output = await self._call_tool(
            "run_splunk_query",
            {"query": spl, "earliest_time": earliest, "latest_time": "now"},
        )
        return MCPToolResult(tool_name="run_splunk_query", output=output, spl_used=spl)

    async def generate_spl(self, natural_language: str) -> MCPToolResult:
        output = await self._call_tool(
            "generate_spl",
            {"query": natural_language},
        )
        return MCPToolResult(tool_name="generate_spl", output=output, spl_used=output)


def get_mcp_client() -> MCPClient:
    return MCPClient(
        base_url=f"https://{settings.splunk_host}:{settings.splunk_port}/services/mcp",
        token=settings.splunk_token,
    )
```

- [ ] **Step 4: Add `splunk_mcp_enabled` to `backend/config.py`**

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

    model_config = {"env_file": ".env"}

settings = Settings()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/test_mcp_client.py -v
```

Expected:
```
tests/test_mcp_client.py::test_mcp_tool_result_fields PASSED
tests/test_mcp_client.py::test_mcp_client_falls_back_on_connection_error PASSED
```

- [ ] **Step 6: Update `backend/triage/subagents.py` — use MCP for SPL generation**

Replace the top of `subagents.py` (imports and `_run_spl`) with MCP-aware version. Each agent now calls `mcp_client.generate_spl()` to get the SPL query from natural language (demonstrating MCP tool use), then runs it:

```python
"""
Four specialized subagents that each query Splunk via MCP and direct REST,
returning structured findings with full SPL audit trails.
"""
import asyncio
import json
import anthropic
import splunklib.client as splunk_lib
import splunklib.results as splunk_results
from config import settings
from mcp_client import MCPClient, MCPToolResult, get_mcp_client


def _make_anthropic() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


def _make_service() -> splunk_lib.Service:
    return splunk_lib.connect(
        host=settings.splunk_host,
        port=settings.splunk_port,
        splunkToken=settings.splunk_token,
        autologin=True,
        timeout=10,
    )


def _run_spl(service: splunk_lib.Service, spl: str, earliest: str = "-30m") -> str:
    try:
        job = service.jobs.create(spl, exec_mode="blocking",
                                  earliest_time=earliest, latest_time="now",
                                  count=20, timeout=10)
        reader = splunk_results.JSONResultsReader(job.results(output_mode="json", count=20))
        rows = [item for item in reader if isinstance(item, dict)]
        if not rows:
            return "No results found."
        lines = [row.get("_raw", str(row))[:200] for row in rows[:20]]
        return "\n".join(lines)
    except Exception as e:
        return f"Search error: {e}"


async def _mcp_generate_and_run(
    mcp: MCPClient, service: splunk_lib.Service,
    natural_language: str, fallback_spl: str
) -> tuple[str, str]:
    """Use MCP to generate SPL from natural language, then run it. Returns (results, spl_used)."""
    if settings.splunk_mcp_enabled:
        gen_result = await mcp.generate_spl(natural_language)
        spl = gen_result.output.strip()
        # If MCP returned a real SPL (starts with search or |), use it; else fall back
        if spl and (spl.lower().startswith("search") or spl.startswith("|")):
            results = await asyncio.to_thread(_run_spl, service, spl)
            return results, f"[MCP generated] {spl}"
    # Fallback to hardcoded SPL
    results = await asyncio.to_thread(_run_spl, service, fallback_spl)
    return results, fallback_spl
```

Then update each of the four agent functions to use `_mcp_generate_and_run` and return a dict with `findings`, `indicators`, and `spl_query`:

```python
async def run_auth_agent(source_ip: str, affected_host: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)
    earliest = "-30m"

    nl_query = (
        f"Find authentication events involving source IP {source_ip} "
        f"or host {affected_host} in the last 30 minutes"
    )
    fallback_spl = (
        f'search index=* (sourcetype="WinEventLog:Security" OR sourcetype="linux_secure") '
        f'(src_ip="{source_ip}" OR host="{affected_host}") '
        f'earliest={earliest} latest=now | head 20 | table _time, EventCode, Account_Name, src_ip, host, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are a security analyst. Analyze these authentication log events for threats.
Source IP: {source_ip}, Affected host: {affected_host}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = json.loads(message.content[0].text) if message.content[0].text.strip().startswith("{") else {"findings": message.content[0].text, "indicators": []}
    result["spl_query"] = spl_used
    return result


async def run_network_agent(source_ip: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)
    earliest = "-30m"

    nl_query = f"Find network flows from or to source IP {source_ip} in the last 30 minutes"
    fallback_spl = (
        f'search index=* (sourcetype="firewall" OR sourcetype="pan:traffic" OR sourcetype="cisco:asa") '
        f'(src="{source_ip}" OR dest="{source_ip}") '
        f'earliest={earliest} latest=now | head 20 | table _time, src, dest, dpt, action, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are a network security analyst. Analyze these network flow events.
Source IP: {source_ip}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = json.loads(message.content[0].text) if message.content[0].text.strip().startswith("{") else {"findings": message.content[0].text, "indicators": []}
    result["spl_query"] = spl_used
    return result


async def run_endpoint_agent(affected_host: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)
    earliest = "-30m"

    nl_query = f"Find suspicious process and file activity on host {affected_host} in the last 30 minutes"
    fallback_spl = (
        f'search index=* (sourcetype="WinEventLog:System" OR sourcetype="sysmon" OR sourcetype="osquery") '
        f'host="{affected_host}" '
        f'earliest={earliest} latest=now | head 20 | table _time, host, EventCode, Process_Name, Process_Command_Line, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are an endpoint forensics analyst. Analyze these process and system events.
Affected host: {affected_host}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = json.loads(message.content[0].text) if message.content[0].text.strip().startswith("{") else {"findings": message.content[0].text, "indicators": []}
    result["spl_query"] = spl_used
    return result


async def run_lateral_agent(affected_host: str, timestamp: str) -> dict:
    mcp = get_mcp_client()
    service = await asyncio.to_thread(_make_service)
    earliest = "-30m"

    nl_query = f"Find lateral movement from host {affected_host} to other internal hosts in the last 30 minutes"
    fallback_spl = (
        f'search index=* sourcetype="WinEventLog:Security" '
        f'(EventCode=4648 OR EventCode=4624) host="{affected_host}" '
        f'earliest={earliest} latest=now | head 20 | table _time, EventCode, Account_Name, Target_Server_Name, Logon_Type, _raw'
    )
    raw_results, spl_used = await _mcp_generate_and_run(mcp, service, nl_query, fallback_spl)

    client = _make_anthropic()
    prompt = f"""You are a threat hunter specializing in lateral movement detection.
Affected host: {affected_host}, Alert time: {timestamp}

Raw log events:
{raw_results[:2000]}

Respond with JSON only:
{{"findings": "<2-3 sentence analysis>", "indicators": ["<indicator 1>", "<indicator 2>"], "other_hosts": ["<host 1>"]}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = json.loads(message.content[0].text) if message.content[0].text.strip().startswith("{") else {"findings": message.content[0].text, "indicators": [], "other_hosts": []}
    result["spl_query"] = spl_used
    return result
```

- [ ] **Step 7: Run all existing tests to confirm nothing broke**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/ -v 2>&1 | tail -8
```

Expected: `14 passed`

- [ ] **Step 8: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/mcp_client.py backend/config.py backend/triage/subagents.py tests/test_mcp_client.py
git commit -m "feat: wire Splunk MCP Server into agent reasoning with NL→SPL generation"
```

---

## Task 2: Auditability — Record SPL Queries + Show in UI

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/database.py`
- Modify: `backend/triage/engine.py`
- Modify: `backend/routes/alerts.py`
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/components/AuditTrail.tsx`
- Modify: `frontend/src/components/ReportCard.tsx`

- [ ] **Step 1: Update `backend/models.py` — add `spl_queries` to `InvestigationReport`**

Replace `InvestigationReport` class:

```python
class InvestigationReport(BaseModel):
    alert_id: str
    tier: TierType
    severity_score: int
    mitre_tactic: str
    summary: str
    kill_chain: list[str] = Field(default_factory=list)
    confidence: int = 0
    containment_steps: list[str] = Field(default_factory=list)
    subagent_findings: dict = Field(default_factory=dict)
    spl_queries: dict = Field(default_factory=dict)  # {"auth": "search ...", "network": "...", ...}
    completed_at: datetime
```

- [ ] **Step 2: Update `backend/database.py` — add `spl_queries` column**

Add `spl_queries TEXT NOT NULL DEFAULT '{}'` to the `investigation_reports` table in `init_db`, and update `save_report` and `get_alert_with_report`:

In `init_db`, replace the `investigation_reports` CREATE TABLE statement:

```python
    await db.execute("""
        CREATE TABLE IF NOT EXISTS investigation_reports (
            alert_id TEXT PRIMARY KEY,
            tier TEXT NOT NULL,
            severity_score INTEGER NOT NULL,
            mitre_tactic TEXT NOT NULL,
            summary TEXT NOT NULL,
            kill_chain TEXT NOT NULL DEFAULT '[]',
            confidence INTEGER NOT NULL DEFAULT 0,
            containment_steps TEXT NOT NULL DEFAULT '[]',
            subagent_findings TEXT NOT NULL DEFAULT '{}',
            spl_queries TEXT NOT NULL DEFAULT '{}',
            completed_at TEXT NOT NULL
        )
    """)
```

Replace `save_report`:

```python
async def save_report(db: aiosqlite.Connection, report: InvestigationReport) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO investigation_reports
           (alert_id, tier, severity_score, mitre_tactic, summary, kill_chain,
            confidence, containment_steps, subagent_findings, spl_queries, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (report.alert_id, report.tier, report.severity_score, report.mitre_tactic,
         report.summary, json.dumps(report.kill_chain), report.confidence,
         json.dumps(report.containment_steps), json.dumps(report.subagent_findings),
         json.dumps(report.spl_queries), report.completed_at.isoformat()),
    )
    await db.commit()
```

Replace `get_alert_with_report` query:

```python
async def get_alert_with_report(db: aiosqlite.Connection, alert_id: str) -> dict | None:
    async with db.execute("""
        SELECT a.*, r.tier, r.severity_score, r.mitre_tactic, r.summary,
               r.kill_chain, r.confidence, r.containment_steps,
               r.subagent_findings, r.spl_queries,
               r.completed_at as report_completed_at
        FROM alerts a
        LEFT JOIN investigation_reports r ON a.id = r.alert_id
        WHERE a.id = ?
    """, (alert_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cursor.description]
        return dict(zip(cols, row))
```

- [ ] **Step 3: Update `backend/triage/engine.py` — extract `spl_queries` from subagent results**

In `run_full_investigation`, after `asyncio.gather`, replace the `subagent_findings` dict construction:

```python
    def safe_findings(r: object) -> dict:
        if isinstance(r, Exception):
            return {"findings": f"Agent error: {r}", "indicators": [], "spl_query": ""}
        if isinstance(r, dict):
            return r
        return {"findings": str(r), "indicators": [], "spl_query": ""}

    auth_f = safe_findings(auth_result)
    network_f = safe_findings(network_result)
    endpoint_f = safe_findings(endpoint_result)
    lateral_f = safe_findings(lateral_result)

    subagent_findings = {
        "auth": auth_f.get("findings", ""),
        "network": network_f.get("findings", ""),
        "endpoint": endpoint_f.get("findings", ""),
        "lateral": lateral_f.get("findings", ""),
    }
    spl_queries = {
        "auth": auth_f.get("spl_query", ""),
        "network": network_f.get("spl_query", ""),
        "endpoint": endpoint_f.get("spl_query", ""),
        "lateral": lateral_f.get("spl_query", ""),
    }
```

Then pass `spl_queries` into the `InvestigationReport` constructor:

```python
    return InvestigationReport(
        alert_id=alert.id,
        tier="full",
        severity_score=int(data["severity_score"]),
        mitre_tactic=data["mitre_tactic"],
        summary=data["summary"],
        kill_chain=data.get("kill_chain", []),
        confidence=int(data.get("confidence", 0)),
        containment_steps=data.get("containment_steps", []),
        subagent_findings=subagent_findings,
        spl_queries=spl_queries,
        completed_at=datetime.utcnow(),
    )
```

- [ ] **Step 4: Update `backend/routes/alerts.py` — parse `spl_queries` JSON in `get_alert`**

In `get_alert`, add `spl_queries` to the JSON-parsed fields:

```python
        for field in ("kill_chain", "containment_steps", "subagent_findings", "spl_queries"):
            if row.get(field):
                try:
                    row[field] = json.loads(row[field])
                except Exception:
                    pass
```

- [ ] **Step 5: Update `frontend/src/types.ts` — add `spl_queries`**

Add to `AlertDetail`:

```ts
export interface AlertDetail extends Alert {
  kill_chain: string[] | null
  containment_steps: string[] | null
  subagent_findings: Record<string, string> | null
  spl_queries: Record<string, string> | null
  report_completed_at: string | null
}
```

- [ ] **Step 6: Create `frontend/src/components/AuditTrail.tsx`**

```tsx
import { useState } from "react"

const AGENT_LABELS: Record<string, string> = {
  auth: "Auth Agent",
  network: "Network Agent",
  endpoint: "Endpoint Agent",
  lateral: "Lateral Movement Agent",
}

export function AuditTrail({
  findings,
  queries,
}: {
  findings: Record<string, string>
  queries: Record<string, string>
}) {
  const agents = Object.keys(findings).filter((k) => findings[k])
  if (!agents.length) return null

  return (
    <div className="mt-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Evidence Trail
      </h3>
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentEvidence
            key={agent}
            label={AGENT_LABELS[agent] ?? agent}
            finding={findings[agent]}
            spl={queries?.[agent] ?? ""}
          />
        ))}
      </div>
    </div>
  )
}

function AgentEvidence({
  label,
  finding,
  spl,
}: {
  label: string
  finding: string
  spl: string
}) {
  const [open, setOpen] = useState(false)
  const isMcp = spl.startsWith("[MCP generated]")
  const displaySpl = isMcp ? spl.replace("[MCP generated] ", "") : spl

  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-200">{label}</span>
          {isMcp && (
            <span className="text-xs bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded font-mono">
              MCP
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 bg-gray-900">
          <p className="text-xs text-gray-300 leading-relaxed">{finding}</p>
          {spl && (
            <div>
              <p className="text-xs text-gray-500 mb-1 font-mono">SPL Query:</p>
              <pre className="text-xs text-blue-300 font-mono bg-gray-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {displaySpl}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Update `frontend/src/components/ReportCard.tsx` — add AuditTrail**

Add import and render `AuditTrail` after the kill chain:

```tsx
import type { AlertDetail } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { KillChainTimeline } from "./KillChainTimeline"
import { AuditTrail } from "./AuditTrail"

export function ReportCard({ alert }: { alert: AlertDetail }) {
  const score = alert.severity_score ?? 0
  const confidence = alert.confidence ?? 0
  const killChain = alert.kill_chain ?? []
  const steps = alert.containment_steps ?? []
  const findings = alert.subagent_findings ?? {}
  const queries = alert.spl_queries ?? {}

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-medium text-sm">{alert.title}</p>
          {alert.mitre_tactic && (
            <span className="inline-block mt-1 text-xs bg-gray-700 text-blue-300 px-2 py-0.5 rounded">
              {alert.mitre_tactic}
            </span>
          )}
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Severity Score</span>
          <span>{score}/10</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-red-500"
            style={{ width: `${score * 10}%` }}
          />
        </div>
      </div>

      {alert.tier === "full" && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Confidence</span>
            <span>{confidence}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-blue-500"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      )}

      {alert.summary && (
        <p className="text-xs text-gray-300 leading-relaxed">{alert.summary}</p>
      )}

      {alert.status !== "done" && (
        <p className="text-xs text-blue-400 animate-pulse">
          {alert.status === "investigating"
            ? "Deep investigation in progress..."
            : "Triaging..."}
        </p>
      )}

      <KillChainTimeline steps={killChain} />

      {Object.keys(findings).length > 0 && (
        <AuditTrail findings={findings} queries={queries} />
      )}

      {steps.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Containment Steps
          </h3>
          <ul className="space-y-1">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-200">
                <span className="text-green-400 mt-0.5">✓</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Delete old DB, run tests**

```bash
rm -f /home/rogerkorantenng/dev/Hackathons/sankofa/backend/sankofa.db
rm -f /home/rogerkorantenng/dev/Hackathons/sankofa/sankofa.db
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/ -v 2>&1 | tail -8
```

Expected: `14 passed` (existing tests unaffected; new `spl_queries` field has a default)

- [ ] **Step 9: Verify TypeScript**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/models.py backend/database.py backend/triage/engine.py backend/routes/alerts.py \
  frontend/src/types.ts frontend/src/components/AuditTrail.tsx frontend/src/components/ReportCard.tsx
git commit -m "feat: add SPL audit trail — every subagent records its query, shown in ReportCard"
```

---

## Task 3: Human Approval Gate for Containment Steps

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/database.py`
- Modify: `backend/routes/alerts.py`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/components/ReportCard.tsx`

- [ ] **Step 1: Add `ActionDecision` model to `backend/models.py`**

```python
ActionDecisionStatus = Literal["pending", "approved", "dismissed"]

class ActionDecision(BaseModel):
    id: str
    alert_id: str
    action_index: int
    action_text: str
    status: ActionDecisionStatus = "pending"
    decided_at: datetime | None = None
```

- [ ] **Step 2: Add `action_decisions` table and helpers to `backend/database.py`**

Add to `init_db` after `chat_messages` table:

```python
    await db.execute("""
        CREATE TABLE IF NOT EXISTS action_decisions (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            action_index INTEGER NOT NULL,
            action_text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            decided_at TEXT
        )
    """)
```

Add two new functions at the end of `database.py`:

```python
async def save_action_decision(db: aiosqlite.Connection, decision: ActionDecision) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO action_decisions
           (id, alert_id, action_index, action_text, status, decided_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (decision.id, decision.alert_id, decision.action_index,
         decision.action_text, decision.status,
         decision.decided_at.isoformat() if decision.decided_at else None),
    )
    await db.commit()


async def get_action_decisions(db: aiosqlite.Connection, alert_id: str) -> list[dict]:
    async with db.execute(
        "SELECT * FROM action_decisions WHERE alert_id = ? ORDER BY action_index ASC",
        (alert_id,)
    ) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]
```

- [ ] **Step 3: Add `POST /alerts/{alert_id}/actions/{action_index}/decide` to `backend/routes/alerts.py`**

Add these imports at the top of `alerts.py`:

```python
import uuid
from datetime import datetime
from database import get_alerts, get_alert_with_report, save_alert, init_db, save_action_decision, get_action_decisions
from models import Alert, ActionDecision
```

Add these routes:

```python
class DecideRequest(BaseModel):
    status: str  # "approved" | "dismissed"
    action_text: str


@router.post("/alerts/{alert_id}/actions/{action_index}/decide")
async def decide_action(alert_id: str, action_index: int, req: DecideRequest):
    if req.status not in ("approved", "dismissed"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'dismissed'")
    decision = ActionDecision(
        id=str(uuid.uuid4()),
        alert_id=alert_id,
        action_index=action_index,
        action_text=req.action_text,
        status=req.status,
        decided_at=datetime.utcnow(),
    )
    async with aiosqlite.connect(settings.db_path) as db:
        await save_action_decision(db, decision)
    return {"ok": True, "status": req.status}


@router.get("/alerts/{alert_id}/actions")
async def get_actions(alert_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        return await get_action_decisions(db, alert_id)
```

- [ ] **Step 4: Update `frontend/src/types.ts` — add `ActionDecision`**

```ts
export type ActionDecisionStatus = "pending" | "approved" | "dismissed"

export interface ActionDecision {
  id: string
  alert_id: string
  action_index: number
  action_text: string
  status: ActionDecisionStatus
  decided_at: string | null
}
```

- [ ] **Step 5: Update `frontend/src/api.ts` — add `decideAction` and `getActions`**

```ts
import type { AlertDetail, ActionDecision } from "./types"

export async function decideAction(
  alertId: string,
  actionIndex: number,
  actionText: string,
  status: "approved" | "dismissed"
): Promise<void> {
  const res = await fetch(`/alerts/${alertId}/actions/${actionIndex}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, action_text: actionText }),
  })
  if (!res.ok) throw new Error("Decision failed")
}

export async function getActions(alertId: string): Promise<ActionDecision[]> {
  const res = await fetch(`/alerts/${alertId}/actions`)
  if (!res.ok) throw new Error("Failed to fetch actions")
  return res.json()
}
```

- [ ] **Step 6: Update containment steps section in `frontend/src/components/ReportCard.tsx`**

Replace the containment steps `ul` block with an interactive approval component:

```tsx
import { useState, useEffect } from "react"
import { decideAction, getActions } from "../api"
import type { ActionDecision } from "../types"

// Inside ReportCard, replace the containment steps section:
      {steps.length > 0 && (
        <ContainmentActions alertId={alert.id} steps={steps} />
      )}
```

Add `ContainmentActions` as a new component at the bottom of `ReportCard.tsx`:

```tsx
function ContainmentActions({
  alertId,
  steps,
}: {
  alertId: string
  steps: string[]
}) {
  const [decisions, setDecisions] = useState<Record<number, "pending" | "approved" | "dismissed">>({})

  useEffect(() => {
    getActions(alertId)
      .then((actions) => {
        const map: Record<number, "pending" | "approved" | "dismissed"> = {}
        actions.forEach((a) => { map[a.action_index] = a.status })
        setDecisions(map)
      })
      .catch(() => {})
  }, [alertId])

  async function decide(index: number, text: string, status: "approved" | "dismissed") {
    await decideAction(alertId, index, text, status)
    setDecisions((prev) => ({ ...prev, [index]: status }))
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Containment Actions
      </h3>
      <ul className="space-y-2">
        {steps.map((step, i) => {
          const status = decisions[i] ?? "pending"
          return (
            <li key={i} className="border border-gray-700 rounded p-2">
              <p className="text-xs text-gray-200 mb-2">{step}</p>
              {status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(i, step, "approved").catch(console.error)}
                    className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => decide(i, step, "dismissed").catch(console.error)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
                  >
                    ✗ Dismiss
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-medium ${status === "approved" ? "text-green-400" : "text-gray-500"}`}>
                  {status === "approved" ? "✓ Approved" : "✗ Dismissed"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 7: Delete old DB, run tests, verify TypeScript**

```bash
rm -f /home/rogerkorantenng/dev/Hackathons/sankofa/backend/sankofa.db
rm -f /home/rogerkorantenng/dev/Hackathons/sankofa/sankofa.db
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/ -v 2>&1 | tail -5
cd frontend && npx tsc --noEmit
```

Expected: `14 passed`, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add backend/models.py backend/database.py backend/routes/alerts.py \
  frontend/src/types.ts frontend/src/api.ts frontend/src/components/ReportCard.tsx
git commit -m "feat: human approval gate — containment steps are approvable actions with audit log"
```

---

## Task 4: Connected Attack Campaign Seed Data

**Files:**
- Create: `seed/campaign_alerts.json`
- Modify: `backend/routes/alerts.py`

- [ ] **Step 1: Create `seed/campaign_alerts.json`**

```json
[
  {
    "title": "Reconnaissance — Port Scan from External IP",
    "severity": "4",
    "sid": "campaign-001",
    "src_ip": "185.220.101.42",
    "dest": "192.168.1.1",
    "campaign_step": 1,
    "campaign_note": "Attacker begins by scanning the perimeter firewall",
    "_raw": "action=blocked src=185.220.101.42 dest=192.168.1.1 dpt=22,80,443,8080,3389,445 flags=SYN proto=TCP bytes=0"
  },
  {
    "title": "Credential Access — Brute Force Against Administrator",
    "severity": "3",
    "sid": "campaign-002",
    "src_ip": "185.220.101.42",
    "dest": "win-dc01",
    "campaign_step": 2,
    "campaign_note": "After finding port 3389 open, attacker brute forces RDP",
    "_raw": "EventCode=4625 Account_Name=administrator Source_Network_Address=185.220.101.42 Failure_Reason=Unknown_user_name_or_bad_password Logon_Type=10 count=47"
  },
  {
    "title": "Credential Dumping — LSASS Memory Access on Domain Controller",
    "severity": "1",
    "sid": "campaign-003",
    "src_ip": "185.220.101.42",
    "dest": "win-dc01",
    "campaign_step": 3,
    "campaign_note": "Brute force succeeded. Attacker now dumps credentials from LSASS",
    "_raw": "EventCode=4656 Object_Name=\\Device\\HarddiskVolume2\\Windows\\System32\\lsass.exe Access_Mask=0x1fffff Process_Name=C:\\Windows\\System32\\cmd.exe Account_Name=administrator"
  },
  {
    "title": "Lateral Movement — SMB Connection to Finance Server",
    "severity": "2",
    "sid": "campaign-004",
    "src_ip": "185.220.101.42",
    "dest": "win-finance01",
    "campaign_step": 4,
    "campaign_note": "With stolen credentials, attacker pivots to the finance server",
    "_raw": "EventCode=4648 Account_Name=svc_backup Target_Server_Name=win-finance01 Process_Name=C:\\Windows\\System32\\net.exe Logon_Type=3 src_ip=win-dc01"
  },
  {
    "title": "C2 Beacon — Suspicious Outbound HTTPS to Rare External IP",
    "severity": "2",
    "sid": "campaign-005",
    "src_ip": "192.168.10.50",
    "dest": "91.108.4.200",
    "campaign_step": 5,
    "campaign_note": "Malware establishes C2 channel. Attacker now has persistent access",
    "_raw": "action=allowed src=192.168.10.50 dest=91.108.4.200 dpt=443 proto=HTTPS bytes=2847 duration=300 repeat_count=12 url_category=unknown"
  }
]
```

- [ ] **Step 2: Update `backend/routes/alerts.py` — add `/alerts/seed/campaign` endpoint**

Add below the existing `seed_alerts` route:

```python
@router.post("/alerts/seed/campaign")
async def seed_campaign():
    import asyncio
    import pathlib

    seed_path = pathlib.Path(__file__).parent.parent.parent / "seed" / "campaign_alerts.json"
    with open(seed_path) as f:
        raw_alerts = json.load(f)

    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        for raw in raw_alerts:
            alert_id = str(uuid.uuid5(uuid.NAMESPACE_URL, raw["sid"]))
            severity = SEVERITY_MAP.get(str(raw.get("severity", "3")), "medium")
            alert = Alert(
                id=alert_id,
                title=raw["title"],
                severity=severity,
                source_ip=raw.get("src_ip"),
                affected_host=raw.get("dest"),
                timestamp=datetime.utcnow(),
                raw_event=raw,
                status="pending",
            )
            await save_alert(db, alert)

    from poller import poll_and_triage
    asyncio.create_task(poll_and_triage())

    return {"seeded": len(raw_alerts), "campaign": True}
```

- [ ] **Step 3: Update `frontend/src/api.ts` — add `seedCampaign`**

```ts
export async function seedCampaign(): Promise<{ seeded: number }> {
  const res = await fetch(`/alerts/seed/campaign`, { method: "POST" })
  if (!res.ok) throw new Error("Campaign seed failed")
  return res.json()
}
```

- [ ] **Step 4: Update `frontend/src/components/AlertQueue.tsx` — add campaign seed button**

In the header div, add a second button next to "seed demo":

```tsx
import { fetchAlert, seedAlerts, seedCampaign } from "../api"

// In the header div, replace the single button with:
      <div className="flex gap-2">
        <button
          onClick={() => seedCampaign().catch(console.error)}
          className="text-xs text-purple-400 hover:text-white border border-purple-700 hover:border-purple-400 px-2 py-1 rounded transition-colors"
        >
          ▶ campaign
        </button>
        <button
          onClick={() => seedAlerts().catch(console.error)}
          className="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-2 py-1 rounded transition-colors"
        >
          seed demo
        </button>
      </div>
```

- [ ] **Step 5: Run tests and verify TypeScript**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
source backend/venv/bin/activate
pytest tests/ -v 2>&1 | tail -5
cd frontend && npx tsc --noEmit
```

Expected: `14 passed`, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add seed/campaign_alerts.json backend/routes/alerts.py \
  frontend/src/api.ts frontend/src/components/AlertQueue.tsx
git commit -m "feat: add connected 5-alert attack campaign — recon→brute force→cred dump→lateral→C2"
```

---

## Task 5: Splunk App Packaging

**Files:**
- Create: `splunk_app/app.conf`
- Create: `splunk_app/default/savedsearches.conf`
- Create: `splunk_app/appserver/static/dashboard.json`
- Create: `splunk_app/README`
- Create: `package_app.sh`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p /home/rogerkorantenng/dev/Hackathons/sankofa/splunk_app/default
mkdir -p /home/rogerkorantenng/dev/Hackathons/sankofa/splunk_app/appserver/static
mkdir -p /home/rogerkorantenng/dev/Hackathons/sankofa/splunk_app/metadata
```

- [ ] **Step 2: Create `splunk_app/app.conf`**

```ini
[launcher]
author=Sankofa Team
description=Agentic SOC Triage — auto-investigates Splunk alerts using a multi-agent AI system
version=1.0.0

[package]
id=sankofa
check_for_updates=false

[ui]
is_visible=true
label=Sankofa SOC Triage

[install]
is_configured=true
build=1
```

- [ ] **Step 3: Create `splunk_app/metadata/default.meta`**

```ini
[]
access = read : [ * ], write : [ admin, power ]
export = system
```

- [ ] **Step 4: Create `splunk_app/default/savedsearches.conf`**

```ini
[Sankofa - Detect Brute Force]
search = index=* (sourcetype="WinEventLog:Security") EventCode=4625 | stats count by src_ip, Account_Name | where count > 10 | eval severity=2, title="Brute Force - ".Account_Name." from ".src_ip
dispatch.earliest_time = -15m
dispatch.latest_time = now
alert.track = 1
alert.severity = 3
enableSched = 1
cron_schedule = */5 * * * *
alert_type = number of events
alert_comparator = greater than
alert_threshold = 0
counttype = number of events
relation = greater than
quantity = 0
action.email.useNSSubject = 1

[Sankofa - Detect Lateral Movement]
search = index=* sourcetype="WinEventLog:Security" (EventCode=4648 OR EventCode=4624) Logon_Type=3 | stats count by Account_Name, Target_Server_Name | where count > 3
dispatch.earliest_time = -15m
dispatch.latest_time = now
alert.track = 1
alert.severity = 2
enableSched = 1
cron_schedule = */5 * * * *
alert_type = number of events
alert_comparator = greater than
alert_threshold = 0
counttype = number of events
relation = greater than
quantity = 0

[Sankofa - Detect LSASS Access]
search = index=* sourcetype="WinEventLog:Security" EventCode=4656 Object_Name="*lsass*"
dispatch.earliest_time = -15m
dispatch.latest_time = now
alert.track = 1
alert.severity = 1
enableSched = 1
cron_schedule = */2 * * * *
alert_type = number of events
alert_comparator = greater than
alert_threshold = 0
counttype = number of events
relation = greater than
quantity = 0
```

- [ ] **Step 5: Create `splunk_app/appserver/static/dashboard.json`**

```json
{
  "visualizations": {
    "alert_count": {
      "type": "splunk.singlevalue",
      "dataSources": {
        "primary": "alert_count_ds"
      },
      "options": {
        "majorColor": "#EF4444",
        "majorFontSize": 48
      },
      "title": "Active Alerts"
    },
    "severity_chart": {
      "type": "splunk.bar",
      "dataSources": {
        "primary": "severity_ds"
      },
      "options": {
        "seriesColors": ["#EF4444", "#F97316", "#EAB308", "#6B7280"]
      },
      "title": "Alerts by Severity"
    },
    "alert_table": {
      "type": "splunk.table",
      "dataSources": {
        "primary": "alert_table_ds"
      },
      "title": "Recent Alerts"
    }
  },
  "dataSources": {
    "alert_count_ds": {
      "type": "ds.search",
      "options": {
        "query": "| inputlookup sankofa_alerts.csv | stats count",
        "queryParameters": {
          "earliest": "-24h",
          "latest": "now"
        }
      }
    },
    "severity_ds": {
      "type": "ds.search",
      "options": {
        "query": "| inputlookup sankofa_alerts.csv | stats count by severity",
        "queryParameters": {
          "earliest": "-24h",
          "latest": "now"
        }
      }
    },
    "alert_table_ds": {
      "type": "ds.search",
      "options": {
        "query": "| inputlookup sankofa_alerts.csv | table title severity status mitre_tactic severity_score | sort -severity_score",
        "queryParameters": {
          "earliest": "-24h",
          "latest": "now"
        }
      }
    }
  },
  "layout": {
    "type": "grid",
    "options": {},
    "structure": [
      {
        "item": "alert_count",
        "type": "block",
        "position": {"x": 0, "y": 0, "w": 200, "h": 150}
      },
      {
        "item": "severity_chart",
        "type": "block",
        "position": {"x": 200, "y": 0, "w": 600, "h": 150}
      },
      {
        "item": "alert_table",
        "type": "block",
        "position": {"x": 0, "y": 150, "w": 800, "h": 300}
      }
    ],
    "globalInputs": []
  },
  "title": "Sankofa SOC Triage",
  "description": "Multi-agent alert triage powered by Splunk + Claude AI",
  "defaults": {}
}
```

- [ ] **Step 6: Create `splunk_app/README`**

```
Sankofa — Agentic SOC Triage for Splunk
========================================

Installation:
1. Upload sankofa.spl via Splunk Web -> Apps -> Install from file
2. Configure the Sankofa backend (see main README.md)
3. Set SPLUNK_TOKEN in backend/.env to a token with search permissions

Saved Searches:
- Sankofa - Detect Brute Force (fires every 5min)
- Sankofa - Detect Lateral Movement (fires every 5min)
- Sankofa - Detect LSASS Access (fires every 2min)

Dashboard:
- Sankofa SOC Triage (Apps -> Sankofa SOC Triage)
```

- [ ] **Step 7: Create `package_app.sh`**

```bash
#!/bin/bash
set -e
cd /home/rogerkorantenng/dev/Hackathons/sankofa
tar -czf sankofa.spl \
  --transform 's|^splunk_app|sankofa|' \
  splunk_app/
echo "Created sankofa.spl"
ls -lh sankofa.spl
```

- [ ] **Step 8: Package the app**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
chmod +x package_app.sh
./package_app.sh
```

Expected output:
```
Created sankofa.spl
-rw-r--r-- 1 ... sankofa.spl
```

- [ ] **Step 9: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add splunk_app/ package_app.sh sankofa.spl
git commit -m "feat: Splunk app packaging — app.conf, saved searches, Dashboard Studio, sankofa.spl"
```

---

## Self-Review

**Spec coverage:**
- ✅ MCP Server wired into agent reasoning → Task 1
- ✅ SPL audit trail per subagent → Task 2
- ✅ Show audit trail in ReportCard UI → Task 2
- ✅ Human approval gate for containment steps → Task 3
- ✅ Backend records approval decisions → Task 3
- ✅ Connected attack campaign seed data → Task 4
- ✅ Campaign seed button in UI → Task 4
- ✅ Splunk app directory structure → Task 5
- ✅ app.conf + savedsearches.conf → Task 5
- ✅ Dashboard Studio JSON → Task 5
- ✅ Packaged as .spl tarball → Task 5

**Type consistency:**
- `ActionDecision` defined in `models.py` Task 3, `types.ts` Task 3, used in `api.ts` Task 3 ✅
- `spl_queries: dict` in `InvestigationReport` (Task 2) matches `spl_queries: Record<string, string> | null` in `AlertDetail` (Task 2) ✅
- `decideAction` / `getActions` defined in `api.ts` Task 3, consumed in `ReportCard.tsx` Task 3 ✅
- `seedCampaign` defined in `api.ts` Task 4, imported in `AlertQueue.tsx` Task 4 ✅

**No placeholders found.**
