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
