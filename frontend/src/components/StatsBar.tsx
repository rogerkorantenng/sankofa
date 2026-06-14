import { useEffect } from "react"
import { useSankofaStore } from "../store"
import { fetchStats } from "../api"

const SEV: Array<{ key: "critical" | "high" | "medium" | "low"; color: string; label: string }> = [
  { key: "critical", color: "var(--critical)",  label: "Critical" },
  { key: "high",     color: "var(--high)",      label: "High"     },
  { key: "medium",   color: "var(--medium)",    label: "Medium"   },
  { key: "low",      color: "var(--low)",       label: "Low"      },
]

export function StatsBar() {
  const { stats, setStats, wsConnected } = useSankofaStore()

  useEffect(() => {
    const load = () => fetchStats().then(setStats).catch(() => {})
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [setStats])

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* Live dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: wsConnected ? "var(--green)" : "var(--critical)",
          animation: wsConnected ? "pulse-dot 2s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>
          {wsConnected ? "Live" : "Offline"}
        </span>
      </div>

      {stats && (
        <>
          <div style={{ width: 1, height: 16, background: "var(--border-0)" }} />
          <div style={{ display: "flex", gap: 10 }}>
            {SEV.filter(s => stats[s.key] > 0).map(s => (
              <span key={s.key} style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>
                <span style={{ color: s.color, fontWeight: 600 }}>{stats[s.key]}</span>
                {" "}{s.label}
              </span>
            ))}
          </div>
          {stats.actions_pending > 0 && (
            <>
              <div style={{ width: 1, height: 16, background: "var(--border-0)" }} />
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--medium-bg)",
                color: "var(--medium-text)",
                border: "1px solid var(--medium-border)",
              }}>
                {stats.actions_pending} pending approval
              </span>
            </>
          )}
        </>
      )}
    </div>
  )
}
