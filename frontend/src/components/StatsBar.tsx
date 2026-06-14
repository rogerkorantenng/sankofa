import { useEffect, useState } from "react"
import { useSankofaStore } from "../store"
import { fetchStats } from "../api"

const SEV_CONFIG = [
  { key: "critical" as const, color: "#FF2D3F", label: "CRIT" },
  { key: "high"     as const, color: "#FF7A1A", label: "HIGH" },
  { key: "medium"   as const, color: "#FFB800", label:  "MED" },
  { key: "low"      as const, color: "#2D5A7A", label:  "LOW" },
]

function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
      {t.toISOString().replace("T", " ").slice(0, 19)}Z
    </span>
  )
}

export function StatsBar() {
  const { stats, setStats, wsConnected } = useSankofaStore()

  useEffect(() => {
    const load = () => fetchStats().then(setStats).catch(() => {})
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [setStats])

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "0 14px",
      height: 28,
      background: "var(--bg-base)",
      borderBottom: "1px solid var(--border)",
      flexShrink: 0,
      gap: 0,
      overflow: "hidden",
    }}>
      {/* Live indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        paddingRight: 12,
        marginRight: 12,
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: wsConnected ? "var(--green)" : "#FF2D3F",
          boxShadow: wsConnected ? "0 0 6px var(--green)" : "0 0 6px #FF2D3F",
        }} />
        <span style={{ fontSize: 8, color: wsConnected ? "var(--green)" : "#FF2D3F", letterSpacing: "0.12em", fontWeight: 700 }}>
          {wsConnected ? "LIVE" : "OFFLINE"}
        </span>
      </div>

      {/* Severity counts */}
      {stats && (
        <>
          <div style={{ display: "flex", gap: 3, marginRight: 12, flexShrink: 0 }}>
            {SEV_CONFIG.map(({ key, color, label }) => (
              <div key={key} style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 7px",
                height: 16,
                background: stats[key] > 0 ? `${color}14` : "transparent",
                border: `1px solid ${stats[key] > 0 ? color + "40" : "var(--border)"}`,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: stats[key] > 0 ? color : "var(--text-dim)" }}>
                  {stats[key]}
                </span>
                <span style={{ fontSize: 8, color: stats[key] > 0 ? color : "var(--text-dim)", letterSpacing: "0.1em", opacity: 0.8 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ width: 1, height: 14, background: "var(--border)", flexShrink: 0, marginRight: 12 }} />

          <span style={{ fontSize: 9, color: "var(--text-secondary)", flexShrink: 0, marginRight: 12 }}>
            CONF{" "}
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{stats.avg_confidence}%</span>
          </span>

          <div style={{ width: 1, height: 14, background: "var(--border)", flexShrink: 0, marginRight: 12 }} />

          <span style={{ fontSize: 9, color: "var(--text-secondary)", flexShrink: 0, marginRight: 10 }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>{stats.actions_executed}</span>
            {" EXECUTED"}
          </span>

          {stats.actions_pending > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0 8px",
              height: 16,
              background: "rgba(255,184,0,0.08)",
              border: "1px solid rgba(255,184,0,0.3)",
              flexShrink: 0,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#FFB800", display: "inline-block" }} />
              <span style={{ fontSize: 9, color: "#FFB800", fontWeight: 700, letterSpacing: "0.06em" }}>
                {stats.actions_pending} PENDING
              </span>
            </div>
          )}
        </>
      )}

      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        <LiveClock />
      </div>
    </div>
  )
}
