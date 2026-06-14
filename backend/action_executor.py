import uuid
import aiosqlite
from datetime import datetime
from models import RunbookStep, ActionLog
from database import save_action_log
from slack_webhook import send_slack, format_confirmation, format_approval_card
from config import settings
import splunklib.client as splunk_lib


def classify_action_risk(step: RunbookStep) -> str:
    return step.risk_level


async def _execute_add_to_watchlist(params: dict) -> str:
    ip = params.get("ip", "unknown")
    try:
        service = splunk_lib.connect(
            host=settings.splunk_host, port=settings.splunk_port,
            splunkToken=settings.splunk_token, scheme="https",  timeout=10,
        )
        try:
            service.kvstore["sankofa_watchlist"].data.insert(
                {"ip": ip, "added_at": datetime.utcnow().isoformat()}
            )
        except Exception:
            # KV store may not exist yet — create it
            service.kvstore.create("sankofa_watchlist",
                                   fields={"ip": "string", "added_at": "string"})
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
            splunkToken=settings.splunk_token, scheme="https",  timeout=10,
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
