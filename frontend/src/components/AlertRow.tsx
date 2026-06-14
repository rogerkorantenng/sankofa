import { motion } from "framer-motion"
import type { Alert, SeverityLevel } from "../types"
import { SeverityBadge } from "./SeverityBadge"

const SEVERITY_LEFT: Record<SeverityLevel, string> = {
  critical: "#FF2D3F",
  high:     "#FF7A1A",
  medium:   "#FFB800",
  low:      "#1A3A52",
}

const STATUS_LABEL: Record<string, string> = {
  pending:      "QUEUED",
  triaging:     "TRIAGING",
  triaged:      "TRIAGED",
  investigating:"ANALYZING",
  done:         "DONE",
}

const STATUS_COLOR: Record<string, string> = {
  pending:      "#2D5A7A",
  triaging:     "#00D4FF",
  triaged:      "#00D4FF",
  investigating:"#FFB800",
  done:         "#00E887",
}

export function AlertRow({
  alert,
  selected,
  onClick,
}: {
  alert: Alert
  selected: boolean
  onClick: () => void
}) {
  const isActive = alert.status === "investigating" || alert.status === "triaging"
  const isCritical = alert.severity === "critical"

  return (
    <motion.div
      layout
      onClick={onClick}
      className={isCritical && isActive ? "threat-pulse" : ""}
      style={{
        position: "relative",
        padding: "10px 12px 10px 16px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: selected
          ? "var(--bg-elevated)"
          : isActive
          ? "rgba(0,212,255,0.02)"
          : "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)" }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = isActive ? "rgba(0,212,255,0.02)" : "transparent" }}
    >
      {/* Left severity bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: selected ? 3 : 2,
          background: SEVERITY_LEFT[alert.severity],
          opacity: selected ? 1 : 0.6,
          transition: "all 0.15s",
        }}
      />

      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 0,
          height: 0,
          borderTop: "5px solid transparent",
          borderBottom: "5px solid transparent",
          borderRight: "5px solid var(--accent)",
        }} />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <SeverityBadge severity={alert.severity} />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {isActive && (
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ width: 5, height: 5, borderRadius: "50%", background: STATUS_COLOR[alert.status], display: "inline-block" }}
            />
          )}
          <span style={{
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.1em",
            color: STATUS_COLOR[alert.status] || "var(--text-secondary)",
          }}>
            {STATUS_LABEL[alert.status] ?? alert.status}
          </span>
        </div>
      </div>

      <p style={{
        fontSize: 11,
        color: selected ? "#E8F0F8" : "var(--text-primary)",
        marginBottom: 3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontWeight: selected ? 500 : 400,
      }}>
        {alert.title}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {alert.mitre_tactic && (
          <span style={{
            fontSize: 9,
            color: "var(--text-secondary)",
            letterSpacing: "0.04em",
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
            fontSize: 9,
            color: alert.severity_score >= 8 ? "#FF2D3F" : alert.severity_score >= 6 ? "#FF7A1A" : "var(--text-secondary)",
            fontWeight: 700,
            letterSpacing: "0.05em",
            flexShrink: 0,
          }}>
            {alert.severity_score}<span style={{ color: "var(--text-dim)" }}>/10</span>
          </span>
        )}
      </div>
    </motion.div>
  )
}
