from triage.engine import route_alert
from models import Alert
from datetime import datetime


def make_alert(severity: str) -> Alert:
    return Alert(
        id="test-001", title="Test alert", severity=severity,
        timestamp=datetime.utcnow(), raw_event={}
    )


def test_route_alert_low_uses_fast():
    assert route_alert(make_alert("low")) == "fast"


def test_route_alert_medium_uses_fast():
    assert route_alert(make_alert("medium")) == "fast"


def test_route_alert_high_uses_full():
    assert route_alert(make_alert("high")) == "full"


def test_route_alert_critical_uses_full():
    assert route_alert(make_alert("critical")) == "full"
