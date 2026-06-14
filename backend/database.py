import json
import aiosqlite
from datetime import datetime
from models import Alert, InvestigationReport, ChatMessage
from config import settings


async def init_db(db: aiosqlite.Connection) -> None:
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA busy_timeout=5000")
    await db.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            source_ip TEXT,
            affected_host TEXT,
            timestamp TEXT NOT NULL,
            raw_event TEXT NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'pending'
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS investigation_reports (
            alert_id TEXT PRIMARY KEY,
            tier TEXT NOT NULL,
            severity_score INTEGER NOT NULL,
            mitre_tactic TEXT NOT NULL,
            summary TEXT NOT NULL,
            kill_chain TEXT NOT NULL DEFAULT '[]',
            confidence INTEGER NOT NULL DEFAULT 0,
            containment_steps TEXT NOT NULL DEFAULT '[]',
            subagent_findings TEXT NOT NULL DEFAULT '{}',
            spl_queries TEXT NOT NULL DEFAULT '{}',
            completed_at TEXT NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS action_decisions (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            action_index INTEGER NOT NULL,
            action_text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            decided_at TEXT
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS threat_intel (
            ip TEXT PRIMARY KEY,
            reputation_score INTEGER NOT NULL DEFAULT 0,
            abuse_reports INTEGER NOT NULL DEFAULT 0,
            country TEXT NOT NULL DEFAULT '',
            asn TEXT NOT NULL DEFAULT '',
            known_malware TEXT NOT NULL DEFAULT '[]',
            is_tor_exit INTEGER NOT NULL DEFAULT 0,
            last_seen TEXT NOT NULL DEFAULT '',
            sources TEXT NOT NULL DEFAULT '[]',
            cached_at TEXT NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS action_logs (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            runbook_id TEXT,
            action_type TEXT NOT NULL,
            description TEXT NOT NULL,
            risk_level TEXT NOT NULL DEFAULT 'low',
            status TEXT NOT NULL DEFAULT 'executed',
            result TEXT,
            executed_at TEXT
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS feedback_entries (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            ip TEXT,
            host TEXT,
            pattern TEXT NOT NULL,
            analyst_action TEXT NOT NULL,
            outcome TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS runbooks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            trigger_conditions TEXT NOT NULL DEFAULT '{}',
            steps TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        )
    """)
    await db.commit()


async def save_alert(db: aiosqlite.Connection, alert: Alert) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO alerts
           (id, title, severity, source_ip, affected_host, timestamp, raw_event, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (alert.id, alert.title, alert.severity, alert.source_ip,
         alert.affected_host, alert.timestamp.isoformat(),
         json.dumps(alert.raw_event), alert.status),
    )
    await db.commit()


async def update_alert_status(db: aiosqlite.Connection, alert_id: str, status: str) -> None:
    await db.execute("UPDATE alerts SET status = ? WHERE id = ?", (status, alert_id))
    await db.commit()


async def save_report(db: aiosqlite.Connection, report: InvestigationReport) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO investigation_reports
           (alert_id, tier, severity_score, mitre_tactic, summary, kill_chain,
            confidence, containment_steps, subagent_findings, spl_queries, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (report.alert_id, report.tier, report.severity_score, report.mitre_tactic,
         report.summary, json.dumps(report.kill_chain), report.confidence,
         json.dumps(report.containment_steps), json.dumps(report.subagent_findings),
         json.dumps(report.spl_queries), report.completed_at.isoformat()),
    )
    await db.commit()


async def save_message(db: aiosqlite.Connection, msg: ChatMessage) -> None:
    await db.execute(
        "INSERT INTO chat_messages (id, alert_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
        (msg.id, msg.alert_id, msg.role, msg.content, msg.timestamp.isoformat()),
    )
    await db.commit()


async def get_alerts(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute("""
        SELECT a.*, r.severity_score, r.mitre_tactic, r.summary, r.tier, r.confidence
        FROM alerts a
        LEFT JOIN investigation_reports r ON a.id = r.alert_id
        ORDER BY COALESCE(r.severity_score, 0) DESC, a.timestamp DESC
    """) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]


async def get_alert_with_report(db: aiosqlite.Connection, alert_id: str) -> dict | None:
    async with db.execute("""
        SELECT a.*, r.tier, r.severity_score, r.mitre_tactic, r.summary,
               r.kill_chain, r.confidence, r.containment_steps,
               r.subagent_findings, r.spl_queries,
               r.completed_at as report_completed_at
        FROM alerts a
        LEFT JOIN investigation_reports r ON a.id = r.alert_id
        WHERE a.id = ?
    """, (alert_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cursor.description]
        return dict(zip(cols, row))


async def save_action_decision(db: aiosqlite.Connection, decision) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO action_decisions
           (id, alert_id, action_index, action_text, status, decided_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (decision.id, decision.alert_id, decision.action_index,
         decision.action_text, decision.status,
         decision.decided_at.isoformat() if decision.decided_at else None),
    )
    await db.commit()


async def get_action_decisions(db: aiosqlite.Connection, alert_id: str) -> list[dict]:
    async with db.execute(
        "SELECT * FROM action_decisions WHERE alert_id = ? ORDER BY action_index ASC",
        (alert_id,)
    ) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]


async def get_chat_messages(db: aiosqlite.Connection, alert_id: str) -> list[dict]:
    async with db.execute(
        "SELECT * FROM chat_messages WHERE alert_id = ? ORDER BY timestamp ASC",
        (alert_id,)
    ) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]


# --- v2 helpers ---

async def save_threat_intel(db: aiosqlite.Connection, ti) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO threat_intel
           (ip, reputation_score, abuse_reports, country, asn, known_malware,
            is_tor_exit, last_seen, sources, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (ti.ip, ti.reputation_score, ti.abuse_reports, ti.country, ti.asn,
         json.dumps(ti.known_malware), int(ti.is_tor_exit), ti.last_seen,
         json.dumps(ti.sources), ti.cached_at.isoformat()),
    )
    await db.commit()


async def get_threat_intel(db: aiosqlite.Connection, ip: str) -> dict | None:
    async with db.execute("SELECT * FROM threat_intel WHERE ip = ?", (ip,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cursor.description]
        result = dict(zip(cols, row))
        result["known_malware"] = json.loads(result["known_malware"])
        result["sources"] = json.loads(result["sources"])
        return result


async def save_action_log(db: aiosqlite.Connection, log) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO action_logs
           (id, alert_id, runbook_id, action_type, description, risk_level,
            status, result, executed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (log.id, log.alert_id, log.runbook_id, log.action_type, log.description,
         log.risk_level, log.status, log.result,
         log.executed_at.isoformat() if log.executed_at else None),
    )
    await db.commit()


async def get_action_logs(db: aiosqlite.Connection, alert_id: str | None = None) -> list[dict]:
    if alert_id:
        query = "SELECT * FROM action_logs WHERE alert_id = ? ORDER BY executed_at DESC"
        params: tuple = (alert_id,)
    else:
        query = "SELECT * FROM action_logs ORDER BY executed_at DESC"
        params = ()
    async with db.execute(query, params) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]


async def update_action_log_status(db: aiosqlite.Connection, log_id: str, status: str, result: str | None = None) -> None:
    await db.execute(
        "UPDATE action_logs SET status = ?, result = ? WHERE id = ?",
        (status, result, log_id)
    )
    await db.commit()


async def save_feedback(db: aiosqlite.Connection, entry) -> None:
    await db.execute(
        """INSERT INTO feedback_entries
           (id, alert_id, ip, host, pattern, analyst_action, outcome, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (entry.id, entry.alert_id, entry.ip, entry.host, entry.pattern,
         entry.analyst_action, entry.outcome, entry.created_at.isoformat()),
    )
    await db.commit()


async def get_feedback_for_pattern(db: aiosqlite.Connection, pattern: str, limit: int = 10) -> list[dict]:
    async with db.execute(
        "SELECT * FROM feedback_entries WHERE pattern = ? ORDER BY created_at DESC LIMIT ?",
        (pattern, limit)
    ) as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in rows]


async def save_runbook(db: aiosqlite.Connection, runbook) -> None:
    await db.execute(
        """INSERT OR REPLACE INTO runbooks (id, name, trigger_conditions, steps, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (runbook.id, runbook.name, json.dumps(runbook.trigger_conditions),
         json.dumps([s.model_dump() for s in runbook.steps]),
         runbook.created_at.isoformat()),
    )
    await db.commit()


async def get_runbooks(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute("SELECT * FROM runbooks ORDER BY created_at DESC") as cursor:
        rows = await cursor.fetchall()
        cols = [d[0] for d in cursor.description]
        results = []
        for row in rows:
            r = dict(zip(cols, row))
            r["trigger_conditions"] = json.loads(r["trigger_conditions"])
            r["steps"] = json.loads(r["steps"])
            results.append(r)
        return results


async def get_runbook(db: aiosqlite.Connection, runbook_id: str) -> dict | None:
    async with db.execute("SELECT * FROM runbooks WHERE id = ?", (runbook_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cursor.description]
        r = dict(zip(cols, row))
        r["trigger_conditions"] = json.loads(r["trigger_conditions"])
        r["steps"] = json.loads(r["steps"])
        return r


async def get_stats(db: aiosqlite.Connection) -> dict:
    async with db.execute(
        "SELECT severity, COUNT(*) as cnt FROM alerts GROUP BY severity"
    ) as cursor:
        severity_rows = await cursor.fetchall()
    severity_counts = {row[0]: row[1] for row in severity_rows}

    async with db.execute(
        "SELECT AVG(confidence) FROM investigation_reports WHERE confidence > 0"
    ) as cursor:
        avg_row = await cursor.fetchone()
    avg_confidence = round(avg_row[0] or 0)

    async with db.execute(
        "SELECT COUNT(*) FROM action_logs WHERE status = 'executed'"
    ) as cursor:
        executed_row = await cursor.fetchone()

    async with db.execute(
        "SELECT COUNT(*) FROM action_logs WHERE status = 'pending_approval'"
    ) as cursor:
        pending_row = await cursor.fetchone()

    return {
        "critical": severity_counts.get("critical", 0),
        "high": severity_counts.get("high", 0),
        "medium": severity_counts.get("medium", 0),
        "low": severity_counts.get("low", 0),
        "avg_confidence": avg_confidence,
        "actions_executed": executed_row[0] if executed_row else 0,
        "actions_pending": pending_row[0] if pending_row else 0,
    }
