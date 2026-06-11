import json
from datetime import datetime
from models import Alert, InvestigationReport


def classify_severity_from_score(score: int) -> str:
    if score >= 8:
        return "critical"
    if score >= 6:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


def build_fast_triage_prompt(alert: Alert) -> str:
    return f"""You are a SOC analyst triaging a Splunk security alert.

Alert title: {alert.title}
Severity level: {alert.severity}
Source IP: {alert.source_ip or 'unknown'}
Affected host: {alert.affected_host or 'unknown'}
Timestamp: {alert.timestamp.isoformat()}
Raw event: {json.dumps(alert.raw_event)[:500]}

Respond with a JSON object containing exactly these fields:
{{
  "severity_score": <integer 1-10>,
  "mitre_tactic": "<MITRE ATT&CK tactic code and name, e.g. TA0001 - Initial Access>",
  "summary": "<exactly two sentences describing the threat and immediate risk>"
}}"""


def parse_fast_triage_response(alert_id: str, response_text: str) -> InvestigationReport:
    text = response_text.strip()
    start = text.find("{")
    end = text.rfind("}") + 1
    data = json.loads(text[start:end])
    return InvestigationReport(
        alert_id=alert_id,
        tier="fast",
        severity_score=int(data["severity_score"]),
        mitre_tactic=data["mitre_tactic"],
        summary=data["summary"],
        completed_at=datetime.utcnow(),
    )
