import asyncio
import json
from datetime import datetime
from models import Alert, InvestigationReport
from triage.fast_triage import build_fast_triage_prompt, parse_fast_triage_response
from triage.subagents import (
    run_auth_agent, run_network_agent,
    run_endpoint_agent, run_lateral_agent,
)
from config import settings
import anthropic


def route_alert(alert: Alert) -> str:
    return "fast" if alert.severity in ("low", "medium") else "full"


async def run_fast_triage(alert: Alert) -> InvestigationReport:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = build_fast_triage_prompt(alert)
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_fast_triage_response(alert.id, message.content[0].text)


async def run_full_investigation(alert: Alert) -> InvestigationReport:
    timestamp = alert.timestamp.isoformat()
    source_ip = alert.source_ip or "unknown"
    host = alert.affected_host or "unknown"

    results = await asyncio.gather(
        run_auth_agent(source_ip, host, timestamp),
        run_network_agent(source_ip, timestamp),
        run_endpoint_agent(host, timestamp),
        run_lateral_agent(host, timestamp),
        return_exceptions=True,
    )
    auth_result, network_result, endpoint_result, lateral_result = results

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

    synthesis_prompt = f"""You are a senior SOC analyst synthesizing a multi-agent security investigation.

Alert: {alert.title}
Severity: {alert.severity}
Source IP: {source_ip}
Affected host: {host}
Timestamp: {timestamp}

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

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": synthesis_prompt}],
    )
    text = message.content[0].text.strip()
    start = text.find("{")
    end = text.rfind("}") + 1
    data = json.loads(text[start:end])

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


async def triage_alert(alert: Alert) -> InvestigationReport:
    tier = route_alert(alert)
    if tier == "fast":
        return await run_fast_triage(alert)
    return await run_full_investigation(alert)
