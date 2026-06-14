import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from runbook_engine import match_runbooks, DEFAULT_RUNBOOKS
from models import InvestigationReport
from datetime import datetime


def make_report(mitre_tactic: str, severity_score: int) -> InvestigationReport:
    return InvestigationReport(
        alert_id="a1", tier="full",
        severity_score=severity_score,
        mitre_tactic=mitre_tactic,
        summary="test", completed_at=datetime.utcnow(),
    )


def test_match_runbooks_credential_access():
    report = make_report("TA0006 - Credential Access", 9)
    matched = match_runbooks(DEFAULT_RUNBOOKS, report, severity="critical")
    assert any("Credential" in rb["name"] for rb in matched)


def test_match_runbooks_no_match_for_low_severity():
    report = make_report("TA0006 - Credential Access", 3)
    matched = match_runbooks(DEFAULT_RUNBOOKS, report, severity="low")
    assert len(matched) == 0


def test_default_runbooks_have_steps():
    for rb in DEFAULT_RUNBOOKS:
        assert len(rb["steps"]) > 0
