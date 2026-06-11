import pytest
import aiosqlite
from database import init_db
from models import Alert, InvestigationReport, ChatMessage
from datetime import datetime


@pytest.mark.asyncio
async def test_init_db_creates_tables():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        async with db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ) as cursor:
            tables = {row[0] async for row in cursor}
    assert "alerts" in tables
    assert "investigation_reports" in tables
    assert "chat_messages" in tables


@pytest.mark.asyncio
async def test_alert_model_validation():
    alert = Alert(
        id="test-001",
        title="Brute force attempt",
        severity="high",
        source_ip="192.168.1.45",
        affected_host="win-dc01",
        timestamp=datetime.utcnow(),
        raw_event={"_raw": "test event"},
        status="pending",
    )
    assert alert.severity == "high"
    assert alert.status == "pending"


def test_investigation_report_defaults():
    report = InvestigationReport(
        alert_id="test-001",
        tier="fast",
        severity_score=7,
        mitre_tactic="TA0006 - Credential Access",
        summary="Brute force attack detected from external IP.",
        completed_at=datetime.utcnow(),
    )
    assert report.kill_chain == []
    assert report.confidence == 0
    assert report.containment_steps == []
    assert report.subagent_findings == {}
