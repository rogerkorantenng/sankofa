from triage.fast_triage import classify_severity_from_score, build_fast_triage_prompt
from models import Alert
from datetime import datetime


def test_classify_severity_from_score():
    assert classify_severity_from_score(9) == "critical"
    assert classify_severity_from_score(7) == "high"
    assert classify_severity_from_score(5) == "medium"
    assert classify_severity_from_score(2) == "low"


def test_build_fast_triage_prompt_includes_alert_title():
    alert = Alert(
        id="a1", title="Port scan detected", severity="medium",
        timestamp=datetime.utcnow(), raw_event={}
    )
    prompt = build_fast_triage_prompt(alert)
    assert "Port scan detected" in prompt
    assert "severity_score" in prompt
    assert "mitre_tactic" in prompt
