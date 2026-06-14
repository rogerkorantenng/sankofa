import { useSankofaStore } from "../store"
import type { Alert, SeverityLevel } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { fetchAlert } from "../api"

const SEVERITY_ORDER: SeverityLevel[] = ["critical", "high", "medium", "low"]

const SEVERITY_STRIPE: Record<SeverityLevel, string> = {
  critical: "var(--critical)",
  high:     "var(--high)",
  medium:   "var(--medium)",
  low:      "var(--border-1)",
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return ""
  }
}

export function TimelineView() {
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  if (!alerts.length) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 8,
      }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--border-0)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>No alerts to display</p>
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>Click "Load Campaign" to populate the timeline</p>
      </div>
    )
  }

  const bySeverity = SEVERITY_ORDER.reduce((acc, sev) => {
    acc[sev] = alerts
      .filter(a => a.severity === sev)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return acc
  }, {} as Record<SeverityLevel, Alert[]>)

  async function handleClick(alert: Alert) {
    setSelectedAlertId(alert.id)
    setSelectedAlert(await fetchAlert(alert.id))
  }

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      {SEVERITY_ORDER.map((sev) => {
        const rows = bySeverity[sev]
        return (
          <div key={sev} style={{
            border: "1px solid var(--border-0)",
            borderRadius: 8,
            background: "var(--bg-0)",
            overflow: "hidden",
          }}>
            {/* Row header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--bg-1)",
              borderBottom: rows.length > 0 ? "1px solid var(--border-0)" : "none",
            }}>
              <SeverityBadge severity={sev} />
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                {rows.length} alert{rows.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Alert cards */}
            {rows.length > 0 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                padding: "12px",
                overflowX: "auto",
              }}>
                {rows.map((alert, i) => (
                  <div key={alert.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <button
                      onClick={() => handleClick(alert).catch(console.error)}
                      style={{
                        width: 180,
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border-0)",
                        borderLeft: `3px solid ${SEVERITY_STRIPE[sev]}`,
                        background: "var(--bg-0)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none" }}
                    >
                      <p style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-0)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: 4,
                        lineHeight: 1.3,
                      }}>
                        {alert.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>
                        {formatTime(alert.timestamp)}
                      </p>
                      {alert.severity_score != null && (
                        <p style={{ fontSize: 11, color: "var(--text-1)", fontWeight: 500 }}>
                          Score: {alert.severity_score}/10
                        </p>
                      )}
                    </button>

                    {/* Arrow connector */}
                    {i < rows.length - 1 && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "0 6px",
                        color: "var(--text-3)",
                        fontSize: 14,
                        flexShrink: 0,
                      }}>
                        →
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {rows.length === 0 && (
              <div style={{ padding: "10px 12px" }}>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>No alerts</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
