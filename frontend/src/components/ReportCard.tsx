import { useState, useEffect } from "react"
import type { AlertDetail, ActionDecision } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { KillChainTimeline } from "./KillChainTimeline"
import { AuditTrail } from "./AuditTrail"
import { EnrichmentPanel } from "./EnrichmentPanel"
import { decideAction, getActions } from "../api"

const SEVERITY_ACCENT: Record<string, string> = {
  critical: "#FF2D3F",
  high:     "#FF7A1A",
  medium:   "#FFB800",
  low:      "#2D5A7A",
}

function ScoreBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  return (
    <div style={{
      position: "relative",
      height: 3,
      background: "var(--border)",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `${(value / max) * 100}%`,
        background: color,
        boxShadow: `0 0 6px ${color}`,
        transition: "width 0.8s ease",
      }} />
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}>
      <span style={{ fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em" }}>{label}</span>
      <span style={{ fontSize: 18, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: color || "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </span>
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
  const accentColor = SEVERITY_ACCENT[alert.severity] || "#2D5A7A"

  return (
    <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        paddingBottom: 14,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{
              fontSize: 13,
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600,
              color: "#E8F0F8",
              lineHeight: 1.3,
              marginBottom: 6,
            }}>
              {alert.title}
            </p>
            {alert.mitre_tactic && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 8px",
                background: "rgba(0,212,255,0.06)",
                border: "1px solid rgba(0,212,255,0.2)",
                fontSize: 9,
                color: "var(--accent)",
                letterSpacing: "0.06em",
              }}>
                <span style={{ color: "var(--accent)", opacity: 0.6 }}>◈</span>
                {alert.mitre_tactic}
              </div>
            )}
          </div>
          <SeverityBadge severity={alert.severity} />
        </div>

        {/* Metrics row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1,
          background: "var(--border)",
        }}>
          {[
            { label: "RISK SCORE", value: `${score}/10`, color: accentColor },
            { label: "CONFIDENCE", value: `${confidence}%`, color: "var(--accent)" },
            { label: "TIER", value: (alert.tier || "—").toUpperCase(), color: "var(--text-primary)" },
          ].map(m => (
            <div key={m.label} style={{
              background: "var(--bg-elevated)",
              padding: "8px 10px",
            }}>
              <Metric {...m} />
            </div>
          ))}
        </div>

        {/* Score bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ScoreBar value={score} max={10} color={accentColor} />
          {alert.tier === "full" && <ScoreBar value={confidence} max={100} color="var(--accent)" />}
        </div>
      </div>

      {/* Status pulse */}
      {alert.status !== "done" && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "rgba(0,212,255,0.04)",
          border: "1px solid rgba(0,212,255,0.15)",
        }}>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "threat-pulse 1.5s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.08em" }}>
            {alert.status === "investigating" ? "DEEP INVESTIGATION IN PROGRESS" : "TRIAGING ALERT"}
          </span>
        </div>
      )}

      {/* Summary */}
      {alert.summary && (
        <div style={{
          padding: "10px 12px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderLeft: `2px solid ${accentColor}`,
        }}>
          <div style={{ fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", marginBottom: 5 }}>ANALYSIS</div>
          <p style={{ fontSize: 10, color: "var(--text-primary)", lineHeight: 1.6 }}>
            {alert.summary}
          </p>
        </div>
      )}

      {/* Threat intel */}
      {threatIntel && <EnrichmentPanel intel={threatIntel} />}

      {/* Kill chain */}
      {killChain.length > 0 && <KillChainTimeline steps={killChain} />}

      {/* Evidence trail */}
      {Object.keys(findings).length > 0 && (
        <AuditTrail findings={findings} queries={queries} />
      )}

      {/* Containment actions */}
      {steps.length > 0 && <ContainmentActions alertId={alert.id} steps={steps} />}
    </div>
  )
}

function ContainmentActions({ alertId, steps }: { alertId: string; steps: string[] }) {
  const [decisions, setDecisions] = useState<Record<number, "pending" | "approved" | "dismissed">>({})

  useEffect(() => {
    getActions(alertId)
      .then((actions) => {
        const map: Record<number, "pending" | "approved" | "dismissed"> = {}
        actions.forEach((a: ActionDecision) => { map[a.action_index] = a.status })
        setDecisions(map)
      })
      .catch(() => {})
  }, [alertId])

  async function decide(index: number, text: string, status: "approved" | "dismissed") {
    await decideAction(alertId, index, text, status)
    setDecisions((prev) => ({ ...prev, [index]: status }))
  }

  return (
    <div>
      <div className="section-divider" style={{ marginBottom: 8 }}>CONTAINMENT ACTIONS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((step, i) => {
          const status = decisions[i] ?? "pending"
          return (
            <div key={i} style={{
              padding: "8px 10px",
              background: status === "approved"
                ? "rgba(0,232,135,0.05)"
                : status === "dismissed"
                ? "rgba(45,90,122,0.05)"
                : "var(--bg-elevated)",
              border: `1px solid ${
                status === "approved" ? "rgba(0,232,135,0.25)"
                : status === "dismissed" ? "var(--border)"
                : "var(--border-bright)"
              }`,
            }}>
              <p style={{ fontSize: 10, color: "var(--text-primary)", marginBottom: status === "pending" ? 7 : 0, lineHeight: 1.4 }}>
                {step}
              </p>
              {status === "pending" ? (
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    onClick={() => decide(i, step, "approved").catch(console.error)}
                    style={{
                      padding: "3px 10px",
                      background: "rgba(0,232,135,0.08)",
                      border: "1px solid rgba(0,232,135,0.3)",
                      color: "var(--green)",
                      fontSize: 9,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    ✓ APPROVE
                  </button>
                  <button
                    onClick={() => decide(i, step, "dismissed").catch(console.error)}
                    style={{
                      padding: "3px 10px",
                      background: "transparent",
                      border: "1px solid var(--border-bright)",
                      color: "var(--text-secondary)",
                      fontSize: 9,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    ✗ DISMISS
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: status === "approved" ? "var(--green)" : "var(--text-dim)",
                  }} />
                  <span style={{
                    fontSize: 9,
                    color: status === "approved" ? "var(--green)" : "var(--text-dim)",
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                  }}>
                    {status === "approved" ? "APPROVED" : "DISMISSED"}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
