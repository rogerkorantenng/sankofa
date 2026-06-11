import json
import uuid
import aiosqlite
from datetime import datetime
from fastapi import APIRouter, HTTPException
from database import get_alerts, get_alert_with_report, save_alert, init_db
from models import Alert
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
        for field in ("kill_chain", "containment_steps", "subagent_findings"):
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
