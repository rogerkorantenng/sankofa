import pytest
import aiosqlite
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from unittest.mock import AsyncMock, patch
from action_executor import execute_action, classify_action_risk
from models import RunbookStep


def test_classify_action_risk_low():
    step = RunbookStep(id="s1", type="action", label="Add to watchlist",
                       action_type="add_to_watchlist", risk_level="low", params={})
    assert classify_action_risk(step) == "low"


def test_classify_action_risk_high():
    step = RunbookStep(id="s1", type="action", label="Block IP",
                       action_type="block_ip", risk_level="high", params={})
    assert classify_action_risk(step) == "high"


@pytest.mark.asyncio
async def test_execute_low_risk_logs_result():
    async with aiosqlite.connect(":memory:") as db:
        from database import init_db
        await init_db(db)
        step = RunbookStep(id="s1", type="action", label="Add to watchlist",
                           action_type="add_to_watchlist", risk_level="low",
                           params={"ip": "1.2.3.4"})
        with patch("action_executor.send_slack", new=AsyncMock(return_value=True)):
            log = await execute_action(db, step, alert_id="a1", runbook_id="rb1")
    assert log.status == "executed"
    assert log.action_type == "add_to_watchlist"
