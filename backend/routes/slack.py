import hashlib
import hmac
import json
import time
import urllib.parse
import aiosqlite
import uuid
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from database import update_action_log_status, init_db, save_feedback
from models import FeedbackEntry
from slack_webhook import send_slack
from config import settings

router = APIRouter()


def _verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    """Verify the request came from Slack using signing secret."""
    if not settings.slack_signing_secret:
        return True  # Skip verification if secret not configured
    # Reject requests older than 5 minutes
    if abs(time.time() - int(timestamp)) > 300:
        return False
    sig_basestring = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(
        settings.slack_signing_secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256,
    ).hexdigest()  # type: ignore[attr-defined]
    return hmac.compare_digest(expected, signature)


@router.post("/slack/action")
async def slack_action(request: Request):
    body = await request.body()

    # Verify Slack signature
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "0")
    signature = request.headers.get("X-Slack-Signature", "")
    if settings.slack_signing_secret and not _verify_slack_signature(body, timestamp, signature):
        raise HTTPException(status_code=403, detail="Invalid Slack signature")

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

    # response_url lets us update the original message (replace the buttons)
    response_url = payload.get("response_url", "")

    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)

        if action_id in ("approve_action", "dismiss_action"):
            log_id = value.get("log_id", "")
            decision = value.get("decision", "dismissed")
            result = f"Analyst {decision} via Slack"
            await update_action_log_status(db, log_id, decision, result)

            # Get the original message text from payload for context
            original_text = ""
            for block in payload.get("message", {}).get("blocks", []):
                if block.get("type") == "section":
                    original_text = block.get("text", {}).get("text", "")
                    break

            if decision == "approved":
                updated_card = {
                    "replace_original": True,
                    "blocks": [
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": original_text or "🔒 Action request"},
                        },
                        {
                            "type": "context",
                            "elements": [{"type": "mrkdwn", "text": "✅ *Approved* by analyst via Slack"}],
                        },
                    ],
                }
            else:
                updated_card = {
                    "replace_original": True,
                    "blocks": [
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": original_text or "🔒 Action request"},
                        },
                        {
                            "type": "context",
                            "elements": [{"type": "mrkdwn", "text": "✗ *Dismissed* by analyst via Slack"}],
                        },
                    ],
                }

            # Update the original message to replace buttons with status
            if response_url:
                import httpx
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.post(response_url, json=updated_card)
            else:
                # Fallback: send new confirmation
                msg = "✅ Action approved and executed." if decision == "approved" else "✗ Action dismissed."
                await send_slack({"text": msg})

        elif action_id == "false_positive":
            title = value.get("title", "unknown")
            entry = FeedbackEntry(
                id=str(uuid.uuid4()),
                alert_id="unknown",
                pattern="false_positive",
                analyst_action="marked_false_positive",
                outcome="false_positive",
                created_at=datetime.utcnow(),
            )
            await save_feedback(db, entry)
            if response_url:
                import httpx
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.post(response_url, json={
                        "replace_original": True,
                        "blocks": [
                            {"type": "section", "text": {"type": "mrkdwn", "text": f"Alert: *{title}*"}},
                            {"type": "context", "elements": [{"type": "mrkdwn", "text": "✓ Marked as false positive"}]},
                        ],
                    })

    return {"ok": True}
