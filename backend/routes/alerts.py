import json
import uuid
import aiosqlite
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import (get_alerts, get_alert_with_report, save_alert, init_db,
                      save_action_decision, get_action_decisions, save_feedback)
from models import Alert, ActionDecision, FeedbackEntry
from config import settings

router = APIRouter()

SEVERITY_MAP = {"1": "critical", "2": "high", "3": "medium", "4": "low", "5": "low"}


@router.get("/alerts")
async def list_alerts():
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_alerts(db)


@router.get("/alerts/{alert_id}")
async def get_alert(alert_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        row = await get_alert_with_report(db, alert_id)
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        for field in ("kill_chain", "containment_steps", "subagent_findings", "spl_queries"):
            if row.get(field):
                try:
                    row[field] = json.loads(row[field])
                except Exception:
                    pass
        return row


@router.post("/alerts/seed")
async def seed_alerts():
    import asyncio
    import pathlib

    seed_path = pathlib.Path(__file__).parent.parent.parent / "seed" / "bots_alerts.json"
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

    return {"seeded": len(raw_alerts)}


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


class DecideRequest(BaseModel):
    status: str
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
        await init_db(db)
        await save_action_decision(db, decision)
        # Write feedback entry for the loop
        raw = await get_alert_with_report(db, alert_id)
        pattern = "unknown"
        if raw:
            title_lower = raw.get("title", "").lower()
            mitre = raw.get("mitre_tactic", "").lower()
            if "lsass" in title_lower or "credential" in mitre or "ta0006" in mitre:
                pattern = "credential_access"
            elif "lateral" in title_lower or "ta0008" in mitre:
                pattern = "lateral_movement"
            elif "brute" in title_lower:
                pattern = "brute_force"
            elif "recon" in title_lower or "scan" in title_lower or "ta0043" in mitre:
                pattern = "reconnaissance"
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
    return {"ok": True, "status": req.status}


@router.get("/alerts/{alert_id}/actions")
async def get_actions(alert_id: str):
    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        return await get_action_decisions(db, alert_id)
