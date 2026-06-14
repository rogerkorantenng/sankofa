from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime

SeverityLevel = Literal["low", "medium", "high", "critical"]
AlertStatus = Literal["pending", "triaging", "triaged", "investigating", "done"]
TierType = Literal["fast", "full"]
MessageRole = Literal["user", "assistant"]


class Alert(BaseModel):
    id: str
    title: str
    severity: SeverityLevel
    source_ip: Optional[str] = None
    affected_host: Optional[str] = None
    timestamp: datetime
    raw_event: dict = Field(default_factory=dict)
    status: AlertStatus = "pending"


class InvestigationReport(BaseModel):
    alert_id: str
    tier: TierType
    severity_score: int
    mitre_tactic: str
    summary: str
    kill_chain: list[str] = Field(default_factory=list)
    confidence: int = 0
    containment_steps: list[str] = Field(default_factory=list)
    subagent_findings: dict = Field(default_factory=dict)
    spl_queries: dict = Field(default_factory=dict)
    completed_at: datetime


class ChatMessage(BaseModel):
    id: str
    alert_id: str
    role: MessageRole
    content: str
    timestamp: datetime


ActionDecisionStatus = Literal["pending", "approved", "dismissed"]


class ActionDecision(BaseModel):
    id: str
    alert_id: str
    action_index: int
    action_text: str
    status: ActionDecisionStatus = "pending"
    decided_at: datetime | None = None


# --- v2 models ---

class ThreatIntel(BaseModel):
    ip: str
    reputation_score: int = 0
    abuse_reports: int = 0
    country: str = ""
    asn: str = ""
    known_malware: list[str] = Field(default_factory=list)
    is_tor_exit: bool = False
    last_seen: str = ""
    sources: list[str] = Field(default_factory=list)
    cached_at: datetime


class RunbookStep(BaseModel):
    id: str
    type: Literal["action", "condition", "notification"]
    label: str
    action_type: Optional[str] = None
    risk_level: Literal["low", "high"] = "low"
    params: dict = Field(default_factory=dict)
    next_on_success: Optional[str] = None
    next_on_failure: Optional[str] = None


class Runbook(BaseModel):
    id: str
    name: str
    trigger_conditions: dict = Field(default_factory=dict)
    steps: list[RunbookStep] = Field(default_factory=list)
    created_at: datetime


ActionLogStatus = Literal["executed", "pending_approval", "approved", "dismissed", "failed"]


class ActionLog(BaseModel):
    id: str
    alert_id: str
    runbook_id: Optional[str] = None
    action_type: str
    description: str
    risk_level: Literal["low", "high"] = "low"
    status: ActionLogStatus = "executed"
    result: Optional[str] = None
    executed_at: Optional[datetime] = None


class FeedbackEntry(BaseModel):
    id: str
    alert_id: str
    ip: Optional[str] = None
    host: Optional[str] = None
    pattern: str
    analyst_action: str
    outcome: str
    created_at: datetime
