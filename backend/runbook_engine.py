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
            break
        else:
            log = await execute_action(db, step, report.alert_id, runbook_dict["id"])
            logs.append(log)
            current_id = (
                step_dict.get("next_on_success")
                if log.status == "executed"
                else step_dict.get("next_on_failure")
            )

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
