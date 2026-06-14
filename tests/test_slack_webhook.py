import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from slack_webhook import format_alert_card, format_approval_card, format_confirmation


def test_format_alert_card_contains_title():
    card = format_alert_card(
        title="LSASS Access",
        severity="critical",
        host="win-dc01",
        ip="185.220.101.42",
        mitre="TA0006 - Credential Access",
        confidence=87,
        kill_chain=["Recon", "Brute Force", "LSASS"],
        threat_summary="Known Tor exit node (847 reports)",
    )
    assert "LSASS Access" in str(card)
    assert "win-dc01" in str(card)
    assert "187" not in str(card)


def test_format_approval_card_has_buttons():
    card = format_approval_card(
        action_log_id="log-1",
        description="Block IP 185.220.101.42",
        alert_title="LSASS Access",
        runbook_name="Credential Access Response",
    )
    blocks = card.get("blocks", [])
    action_blocks = [b for b in blocks if b.get("type") == "actions"]
    assert len(action_blocks) > 0


def test_format_confirmation():
    msg = format_confirmation("Added 185.220.101.42 to watchlist")
    assert "185.220.101.42" in msg["text"]
    assert "✅" in msg["text"]
