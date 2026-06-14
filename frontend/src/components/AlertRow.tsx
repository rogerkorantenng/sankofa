import { motion } from "framer-motion"
import type { Alert, SeverityLevel } from "../types"
import { SeverityBadge } from "./SeverityBadge"

const SEVERITY_STRIPE: Record<SeverityLevel, string> = {
  critical: "var(--critical)",
  high:     "var(--high)",
  medium:   "var(--medium)",
  low:      "var(--border-1)",
}

const STATUS_LABEL: Record<string, string> = {
  pending:       "Queued",
  triaging:      "Triaging…",
  triaged:       "Triaged",
  investigating: "Analyzing…",
  done:          "Done",
}

export function AlertRow({ alert, selected, onClick }: {
  alert: Alert
  selected: boolean
  onClick: () => void
}) {
  const isActive = alert.status === "investigating" || alert.status === "triaging"

  return (
    <motion.div
      layout
      onClick={onClick}
      style={{
        position: "relative",
        padding: "10px 14px 10px 18px",
        borderBottom: "1px solid var(--border-0)",
        cursor: "pointer",
        background: selected ? "var(--blue-bg)" : "var(--bg-0)",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)" }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-0)" }}
    >
      {/* Severity stripe on left */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 3,
        background: SEVERITY_STRIPE[alert.severity],
        opacity: selected ? 1 : 0.6,
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <SeverityBadge severity={alert.severity} />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {isActive && (
            <div style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--blue)",
              animation: "pulse-dot 1.2s ease-in-out infinite",
              flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap" }}>
            {STATUS_LABEL[alert.status] ?? alert.status}
          </span>
        </div>
      </div>

      <p style={{
        fontSize: 13,
        fontWeight: 500,
        color: selected ? "var(--blue-text)" : "var(--text-0)",
        lineHeight: 1.35,
        marginBottom: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {alert.title}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {alert.mitre_tactic && (
          <span style={{
            fontSize: 11,
            color: "var(--text-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "75%",
          }}>
            {alert.mitre_tactic}
          </span>
        )}
        {alert.severity_score != null && (
          <span style={{
            fontSize: 11,
            color: "var(--text-1)",
            fontWeight: 500,
            flexShrink: 0,
          }}>
            {alert.severity_score}<span style={{ color: "var(--text-3)" }}>/10</span>
          </span>
        )}
      </div>
    </motion.div>
  )
}
