import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))
from unittest.mock import AsyncMock, patch
from enrichment import enrich_ip, is_malicious


def test_is_malicious_high_score():
    assert is_malicious(reputation_score=87, abuse_reports=5) is True


def test_is_malicious_high_abuse():
    assert is_malicious(reputation_score=10, abuse_reports=50) is True


def test_is_malicious_clean():
    assert is_malicious(reputation_score=5, abuse_reports=2) is False


@pytest.mark.asyncio
async def test_enrich_ip_returns_cached_if_fresh():
    import aiosqlite
    from database import init_db, save_threat_intel
    from models import ThreatIntel
    from datetime import datetime

    ti = ThreatIntel(ip="1.1.1.1", reputation_score=0, abuse_reports=0,
                     country="AU", asn="AS13335", cached_at=datetime.utcnow())
    async with aiosqlite.connect(":memory:") as db:
        await init_db(db)
        await save_threat_intel(db, ti)
        result = await enrich_ip(db, "1.1.1.1")
    assert result["ip"] == "1.1.1.1"
    assert result["country"] == "AU"
