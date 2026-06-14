export type SeverityLevel = "low" | "medium" | "high" | "critical"
export type AlertStatus = "pending" | "triaging" | "triaged" | "investigating" | "done"

export interface Alert {
  id: string
  title: string
  severity: SeverityLevel
  source_ip: string | null
  affected_host: string | null
  timestamp: string
  status: AlertStatus
  severity_score: number | null
  mitre_tactic: string | null
  summary: string | null
  tier: "fast" | "full" | null
  confidence: number | null
}

export interface AlertDetail extends Alert {
  kill_chain: string[] | null
  containment_steps: string[] | null
  subagent_findings: Record<string, string> | null
  spl_queries: Record<string, string> | null
  report_completed_at: string | null
  threat_intel: ThreatIntel | null
}

export interface ChatMessage {
  id: string
  alert_id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export type ActionDecisionStatus = "pending" | "approved" | "dismissed"

export interface ActionDecision {
  id: string
  alert_id: string
  action_index: number
  action_text: string
  status: ActionDecisionStatus
  decided_at: string | null
}

export interface ThreatIntel {
  ip: string
  reputation_score: number
  abuse_reports: number
  country: string
  asn: string
  known_malware: string[]
  is_tor_exit: boolean
  last_seen: string
  sources: string[]
  cached_at: string
}

export interface ActionLogEntry {
  id: string
  alert_id: string
  runbook_id: string | null
  action_type: string
  description: string
  risk_level: "low" | "high"
  status: "executed" | "pending_approval" | "approved" | "dismissed" | "failed"
  result: string | null
  executed_at: string | null
}

export interface RunbookStep {
  id: string
  type: "action" | "condition" | "notification"
  label: string
  action_type: string | null
  risk_level: "low" | "high"
  params: Record<string, string>
  next_on_success: string | null
  next_on_failure: string | null
}

export interface Runbook {
  id: string
  name: string
  trigger_conditions: Record<string, unknown>
  steps: RunbookStep[]
  created_at: string
}

export interface DashboardStats {
  critical: number
  high: number
  medium: number
  low: number
  avg_confidence: number
  actions_executed: number
  actions_pending: number
}
