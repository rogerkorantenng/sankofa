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
  report_completed_at: string | null
}

export interface ChatMessage {
  id: string
  alert_id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}
