import { useState, useEffect } from "react"
import type { AlertDetail, ActionDecision } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { KillChainTimeline } from "./KillChainTimeline"
import { AuditTrail } from "./AuditTrail"
import { EnrichmentPanel } from "./EnrichmentPanel"
import { decideAction, getActions } from "../api"

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--critical)",
  high:     "var(--high)",
  medium:   "var(--medium)",
  low:      "var(--low)",
}

function ProgressBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  return (
    <div style={{ height: 4, borderRadius: 2, background: "var(--bg-2)", overflow: "hidden" }}>
      <div style={{
        height: "100%",
        borderRadius: 2,
        background: color,
        width: `${Math.min(100, (value / max) * 100)}%`,
        transition: "width 0.6s ease",
      }} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-0)" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

export function ReportCard({ alert }: { alert: AlertDetail }) {
  const score = alert.severity_score ?? 0
  const confidence = alert.confidence ?? 0
  const killChain = alert.kill_chain ?? []
  const steps = alert.containment_steps ?? []
  const findings = alert.subagent_findings ?? {}
  const queries = alert.spl_queries ?? {}
  const threatIntel = alert.threat_intel ?? null
  const accentColor = SEVERITY_COLOR[alert.severity]

  return (
    <div>
      {/* Overview */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-0)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            {alert.mitre_tactic && (
              <span style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--purple-bg)",
                border: "1px solid var(--purple-border)",
                color: "var(--purple-text)",
                marginBottom: 6,
              }}>
                {alert.mitre_tactic}
              </span>
            )}
          </div>
          <SeverityBadge severity={alert.severity} />
        </div>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>Risk Score</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>{score}/10</span>
            </div>
            <ProgressBar value={score} max={10} color={accentColor} />
          </div>
          {alert.tier === "full" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>Confidence</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)" }}>{confidence}%</span>
              </div>
              <ProgressBar value={confidence} max={100} color="var(--blue)" />
            </div>
          )}
        </div>

        {/* Summary */}
        {alert.summary && (
          <p style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.6 }}>
            {alert.summary}
          </p>
        )}

        {/* Analyzing indicator */}
        {alert.status !== "done" && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            padding: "6px 10px",
            borderRadius: 6,
            background: "var(--blue-bg)",
            border: "1px solid var(--blue-border)",
          }}>
            <div style={{
              width: 14, height: 14,
              border: "2px solid var(--blue-border)",
              borderTopColor: "var(--blue)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: "var(--blue-text)" }}>
              {alert.status === "investigating" ? "Deep investigation in progress…" : "Triaging alert…"}
            </span>
          </div>
        )}
      </div>

      {/* Threat Intel */}
      {threatIntel && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-0)" }}>
          <EnrichmentPanel intel={threatIntel} />
        </div>
      )}

      {/* Kill chain */}
      {killChain.length > 0 && (
        <Section title="Kill Chain">
          <KillChainTimeline steps={killChain} />
        </Section>
      )}

      {/* Evidence */}
      {Object.keys(findings).length > 0 && (
        <Section title="Evidence Trail">
          <AuditTrail findings={findings} queries={queries} />
        </Section>
      )}

      {/* Actions */}
      {steps.length > 0 && (
        <Section title="Containment Actions">
          <ContainmentActions alertId={alert.id} steps={steps} />
        </Section>
      )}
    </div>
  )
}

function ContainmentActions({ alertId, steps }: { alertId: string; steps: string[] }) {
  const [decisions, setDecisions] = useState<Record<number, "pending" | "approved" | "dismissed">>({})

  useEffect(() => {
    getActions(alertId).then((actions) => {
      const map: Record<number, "pending" | "approved" | "dismissed"> = {}
      actions.forEach((a: ActionDecision) => { map[a.action_index] = a.status })
      setDecisions(map)
    }).catch(() => {})
  }, [alertId])

  async function decide(index: number, text: string, status: "approved" | "dismissed") {
    await decideAction(alertId, index, text, status)
    setDecisions(prev => ({ ...prev, [index]: status }))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((step, i) => {
        const status = decisions[i] ?? "pending"
        return (
          <div key={i} style={{
            padding: "10px 12px",
            borderRadius: 6,
            border: `1px solid ${status === "approved" ? "var(--green-border)" : status === "dismissed" ? "var(--border-0)" : "var(--border-0)"}`,
            background: status === "approved" ? "var(--green-bg)" : "var(--bg-1)",
          }}>
            <p style={{ fontSize: 12, color: "var(--text-0)", marginBottom: status === "pending" ? 8 : 0, lineHeight: 1.4 }}>
              {step}
            </p>
            {status === "pending" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => decide(i, step, "approved").catch(console.error)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 5,
                    border: "1px solid var(--green-border)",
                    background: "var(--green-bg)",
                    color: "var(--green-text)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(i, step, "dismissed").catch(console.error)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 5,
                    border: "1px solid var(--border-0)",
                    background: "var(--bg-0)",
                    color: "var(--text-1)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 11, color: status === "approved" ? "var(--green-text)" : "var(--text-2)", fontWeight: 500 }}>
                {status === "approved" ? "✓ Approved" : "Dismissed"}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
