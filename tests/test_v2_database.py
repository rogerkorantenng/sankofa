import pytest
import aiosqlite
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from database import init_db, save_threat_intel, get_threat_intel, save_action_log, get_action_logs, save_feedback, get_feedback_for_pattern, save_runbook, get_runbooks
from models import ThreatIntel, ActionLog, FeedbackEntry, Runbook, RunbookStep
from datetime import datetime


@pytest.mark.asyncio
async def test_threat_intel_cache_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        ti = ThreatIntel(ip="1.2.3.4", reputation_score=90, abuse_reports=100,
                         country="RU", asn="AS1234", cached_at=datetime.utcnow())
        await save_threat_intel(db, ti)
        result = await get_threat_intel(db, "1.2.3.4")
    assert result is not None
    assert result["reputation_score"] == 90


@pytest.mark.asyncio
async def test_action_log_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        log = ActionLog(id="l1", alert_id="a1", action_type="add_to_watchlist",
                        description="Added IP", risk_level="low", status="executed")
        await save_action_log(db, log)
        logs = await get_action_logs(db)
    assert len(logs) == 1
    assert logs[0]["action_type"] == "add_to_watchlist"


@pytest.mark.asyncio
async def test_feedback_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        entry = FeedbackEntry(id="f1", alert_id="a1", pattern="lsass_access",
                              analyst_action="approved", outcome="true_positive",
                              created_at=datetime.utcnow())
        await save_feedback(db, entry)
        results = await get_feedback_for_pattern(db, "lsass_access")
    assert len(results) == 1
    assert results[0]["outcome"] == "true_positive"


@pytest.mark.asyncio
async def test_runbook_roundtrip():
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        rb = Runbook(id="rb1", name="Test Runbook",
                     trigger_conditions={"mitre_tactics": ["TA0006"], "severity": ["high"]},
                     steps=[], created_at=datetime.utcnow())
        await save_runbook(db, rb)
        results = await get_runbooks(db)
    assert len(results) == 1
    assert results[0]["name"] == "Test Runbook"
