import asyncio
import httpx
import aiosqlite
from datetime import datetime, timedelta
from models import ThreatIntel
from database import save_threat_intel, get_threat_intel
from config import settings

CACHE_TTL_HOURS = 24


def is_malicious(reputation_score: int, abuse_reports: int) -> bool:
    return reputation_score > 50 or abuse_reports > 10


async def _fetch_virustotal(ip: str) -> dict:
    if not settings.virustotal_api_key:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://www.virustotal.com/api/v3/ip_addresses/{ip}",
                headers={"x-apikey": settings.virustotal_api_key},
            )
            if resp.status_code != 200:
                return {}
            data = resp.json()
            attrs = data.get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            malicious_count = stats.get("malicious", 0)
            total = sum(stats.values()) or 1
            score = int((malicious_count / total) * 100)
            malware_names = []
            for engine_result in attrs.get("last_analysis_results", {}).values():
                if engine_result.get("category") == "malicious" and engine_result.get("result"):
                    malware_names.append(engine_result["result"])
            return {
                "reputation_score": score,
                "known_malware": list(set(malware_names))[:5],
                "country": attrs.get("country", ""),
                "asn": str(attrs.get("asn", "")),
                "last_seen": str(attrs.get("last_modification_date", "")),
            }
    except Exception:
        return {}


async def _fetch_abuseipdb(ip: str) -> dict:
    if not settings.abuseipdb_api_key:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                headers={"Key": settings.abuseipdb_api_key, "Accept": "application/json"},
                params={"ipAddress": ip, "maxAgeInDays": 90},
            )
            if resp.status_code != 200:
                return {}
            data = resp.json().get("data", {})
            return {
                "abuse_reports": data.get("totalReports", 0),
                "is_tor_exit": data.get("isTor", False),
                "country": data.get("countryCode", ""),
            }
    except Exception:
        return {}


async def enrich_ip(db: aiosqlite.Connection, ip: str) -> dict:
    if not ip or ip == "unknown":
        return {}

    cached = await get_threat_intel(db, ip)
    if cached:
        cached_at = datetime.fromisoformat(cached["cached_at"])
        if datetime.utcnow() - cached_at < timedelta(hours=CACHE_TTL_HOURS):
            return cached

    vt_data, abuse_data = await asyncio.gather(
        _fetch_virustotal(ip),
        _fetch_abuseipdb(ip),
        return_exceptions=True,
    )
    if isinstance(vt_data, Exception):
        vt_data = {}
    if isinstance(abuse_data, Exception):
        abuse_data = {}

    sources = []
    if vt_data:
        sources.append("virustotal")
    if abuse_data:
        sources.append("abuseipdb")

    ti = ThreatIntel(
        ip=ip,
        reputation_score=vt_data.get("reputation_score", 0),
        abuse_reports=abuse_data.get("abuse_reports", 0),
        country=vt_data.get("country") or abuse_data.get("country", ""),
        asn=vt_data.get("asn", ""),
        known_malware=vt_data.get("known_malware", []),
        is_tor_exit=abuse_data.get("is_tor_exit", False),
        last_seen=vt_data.get("last_seen", ""),
        sources=sources,
        cached_at=datetime.utcnow(),
    )
    await save_threat_intel(db, ti)
    return ti.model_dump()
