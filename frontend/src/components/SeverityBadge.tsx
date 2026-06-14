import type { SeverityLevel } from "../types"

const CONFIG: Record<SeverityLevel, { bg: string; border: string; text: string; dot: string; label: string }> = {
  critical: { bg: "var(--critical-bg)", border: "var(--critical-border)", text: "var(--critical-text)", dot: "var(--critical)", label: "Critical" },
  high:     { bg: "var(--high-bg)",     border: "var(--high-border)",     text: "var(--high-text)",     dot: "var(--high)",     label: "High"     },
  medium:   { bg: "var(--medium-bg)",   border: "var(--medium-border)",   text: "var(--medium-text)",   dot: "var(--medium)",   label: "Medium"   },
  low:      { bg: "var(--low-bg)",      border: "var(--low-border)",      text: "var(--low-text)",      dot: "var(--low)",      label: "Low"      },
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const c = CONFIG[severity]
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "2px 8px",
      borderRadius: 4,
      border: `1px solid ${c.border}`,
      background: c.bg,
      color: c.text,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}
