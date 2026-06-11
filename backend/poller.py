import json
import uuid
import asyncio
import aiosqlite
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from splunk_client import SplunkClient
from models import Alert
from database import save_alert, update_alert_status, save_report, init_db
from triage.engine import triage_alert
from config import settings

scheduler = AsyncIOScheduler()

SEVERITY_MAP = {"1": "critical", "2": "high", "3": "medium", "4": "low", "5": "low"}


async def poll_and_triage() -> None:
    try:
        client = SplunkClient()
        raw_alerts = client.get_triggered_alerts()
    except Exception as e:
        print(f"[poller] Splunk connection failed: {e}")
        raw_alerts = []

    async with aiosqlite.connect(settings.db_path) as db:
        await init_db(db)
        for raw in raw_alerts:
            alert_id = str(uuid.uuid5(
                uuid.NAMESPACE_URL,
                raw.get("sid", raw.get("title", str(raw)))
            ))
            severity = SEVERITY_MAP.get(str(raw.get("severity", "3")), "medium")
            alert = Alert(
                id=alert_id,
                title=raw.get("title", "Untitled Alert"),
                severity=severity,
                source_ip=raw.get("src_ip") or raw.get("src") or None,
                affected_host=raw.get("dest") or raw.get("host") or None,
                timestamp=datetime.utcnow(),
                raw_event=raw,
                status="pending",
            )
            await save_alert(db, alert)
            await update_alert_status(
                db, alert_id,
                "investigating" if severity in ("high", "critical") else "triaging"
            )

        async with db.execute(
            "SELECT id FROM alerts WHERE status IN ('pending', 'triaging', 'investigating')"
        ) as cursor:
            pending_ids = [row[0] async for row in cursor]

    for alert_id in pending_ids:
        async with aiosqlite.connect(settings.db_path) as db:
            async with db.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    continue
                cols = [d[0] for d in cursor.description]
                alert_dict = dict(zip(cols, row))

        alert = Alert(
            id=alert_dict["id"],
            title=alert_dict["title"],
            severity=alert_dict["severity"],
            source_ip=alert_dict["source_ip"],
            affected_host=alert_dict["affected_host"],
            timestamp=datetime.fromisoformat(alert_dict["timestamp"]),
            raw_event=json.loads(alert_dict["raw_event"]),
            status=alert_dict["status"],
        )

        try:
            report = await triage_alert(alert)
        except Exception as e:
            print(f"[poller] Triage failed for {alert_id}: {e}")
            continue

        async with aiosqlite.connect(settings.db_path) as db:
            await save_report(db, report)
            await update_alert_status(db, alert_id, "done")


def start_scheduler() -> None:
    scheduler.add_job(
        poll_and_triage, "interval",
        seconds=settings.poll_interval_seconds,
        id="poller",
        max_instances=1,
    )
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
