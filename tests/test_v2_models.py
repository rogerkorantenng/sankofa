import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from datetime import datetime
from models import (ThreatIntel, Runbook, RunbookStep, ActionLog, FeedbackEntry)


def test_threat_intel_defaults():
    ti = ThreatIntel(
        ip="185.220.101.42",
        reputation_score=87,
        abuse_reports=847,
        country="DE",
        asn="AS13335",
        cached_at=datetime.utcnow(),
    )
    assert ti.known_malware == []
    assert ti.is_tor_exit is False
    assert ti.sources == []


def test_runbook_step_defaults():
    step = RunbookStep(
        id="step-1",
        type="action",
        label="Add to watchlist",
        action_type="add_to_watchlist",
        risk_level="low",
        params={"ip": "185.220.101.42"},
    )
    assert step.next_on_success is None
    assert step.next_on_failure is None


def test_action_log_defaults():
    log = ActionLog(
        id="log-1",
        alert_id="alert-1",
        action_type="add_to_watchlist",
        description="Added 185.220.101.42 to watchlist",
        risk_level="low",
    )
    assert log.status == "executed"
    assert log.result is None
    assert log.executed_at is None


def test_feedback_entry_fields():
    entry = FeedbackEntry(
        id="fb-1",
        alert_id="alert-1",
        pattern="lsass_access",
        analyst_action="approved",
        outcome="true_positive",
        created_at=datetime.utcnow(),
    )
    assert entry.ip is None
    assert entry.host is None
