import type { SeverityLevel } from "../types"

const CONFIG: Record<SeverityLevel, { color: string; bg: string; label: string; dot: string }> = {
  critical: { color: "#FF2D3F", bg: "rgba(255,45,63,0.1)", label: "CRIT", dot: "#FF2D3F" },
  high:     { color: "#FF7A1A", bg: "rgba(255,122,26,0.1)", label: "HIGH", dot: "#FF7A1A" },
  medium:   { color: "#FFB800", bg: "rgba(255,184,0,0.08)", label: " MED", dot: "#FFB800" },
  low:      { color: "#2D5A7A", bg: "rgba(45,90,122,0.1)", label: " LOW", dot: "#2D5A7A" },
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const c = CONFIG[severity]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 6px",
        border: `1px solid ${c.color}`,
        background: c.bg,
        color: c.color,
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        letterSpacing: "0.12em",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}
