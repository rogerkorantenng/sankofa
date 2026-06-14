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
    text_lines = [
        f"{emoji} *{severity.upper()} — {title}*",
        f"Host: `{host}` | IP: `{ip}`",
        f"MITRE: {mitre} | Confidence: {confidence}%",
        f"Kill chain: {kill_chain_text}",
    ]
    if threat_summary:
        text_lines.append(f"⚠️  Threat Intel: {threat_summary}")

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
