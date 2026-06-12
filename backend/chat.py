import json
import uuid
import aiosqlite
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from database import get_alert_with_report, get_chat_messages, save_message, init_db
from models import ChatMessage
from config import settings
import anthropic

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


@router.post("/alerts/{alert_id}/chat")
async def chat(alert_id: str, req: ChatRequest):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        alert_row = await get_alert_with_report(db, alert_id)
        if not alert_row:
            raise HTTPException(status_code=404, detail="Alert not found")
        history = await get_chat_messages(db, alert_id)
        user_msg = ChatMessage(
            id=str(uuid.uuid4()),
            alert_id=alert_id,
            role="user",
            content=req.message,
            timestamp=datetime.utcnow(),
        )
        await save_message(db, user_msg)

    kill_chain: list = []
    if alert_row.get("kill_chain"):
        try:
            kill_chain = json.loads(alert_row["kill_chain"])
        except Exception:
            kill_chain = []

    system = f"""You are a SOC analyst assistant helping investigate a security alert in Splunk.

Alert: {alert_row['title']}
Severity: {alert_row['severity']}
MITRE Tactic: {alert_row.get('mitre_tactic', 'Unknown')}
Summary: {alert_row.get('summary', '')}
Kill Chain: {kill_chain}
Confidence: {alert_row.get('confidence', 0)}%

Answer concisely. If referencing a Splunk search, prefix it with "[Searching Splunk: <spl>]" on its own line."""

    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": req.message})

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def generate():
        full_response = ""
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                full_response += text
                yield f"data: {json.dumps({'text': text})}\n\n"

        async with aiosqlite.connect(settings.db_path) as db:
            await save_message(db, ChatMessage(
                id=str(uuid.uuid4()),
                alert_id=alert_id,
                role="assistant",
                content=full_response,
                timestamp=datetime.utcnow(),
            ))
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
