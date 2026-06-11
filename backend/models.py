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
    completed_at: datetime


class ChatMessage(BaseModel):
    id: str
    alert_id: str
    role: MessageRole
    content: str
    timestamp: datetime
