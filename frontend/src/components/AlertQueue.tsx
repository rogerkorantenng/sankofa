import { useEffect } from "react"
import { motion } from "framer-motion"
import { useSankofaStore } from "../store"
import { AlertRow } from "./AlertRow"
import { fetchAlert, seedAlerts, seedCampaign } from "../api"
import type { Alert } from "../types"

export function AlertQueue() {
  const {
    alerts, setAlerts, selectedAlertId,
    setSelectedAlertId, setSelectedAlert, setWsConnected,
  } = useSankofaStore()

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/alerts`)
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (e: MessageEvent) => {
      try { setAlerts(JSON.parse(e.data as string) as Alert[]) }
      catch { /* ignore */ }
    }
    return () => ws.close()
  }, [setAlerts, setWsConnected])

  async function handleSelect(id: string) {
    setSelectedAlertId(id)
    const detail = await fetchAlert(id)
    setSelectedAlert(detail)
  }

  const criticalCount = alerts.filter(a => a.severity === "critical").length
  const activeCount = alerts.filter(a => a.status === "investigating" || a.status === "triaging").length

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--bg-panel)",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)",
        flexShrink: 0,
      }}>
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#E8F0F8",
              letterSpacing: "0.08em",
            }}>
              SANKOFA
            </span>
            <span style={{
              fontSize: 8,
              color: "var(--accent)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}>
              SOC·AI
            </span>
          </div>
          <div style={{ display: "flex", gap: 1 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 4,
                height: 4,
                background: i === 0 ? "var(--green)" : "var(--border-bright)",
                borderRadius: 1,
              }} />
            ))}
          </div>
        </div>

        {/* Stats row */}
        {alerts.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <div style={{
              flex: 1,
              padding: "4px 8px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: criticalCount > 0 ? "#FF2D3F" : "var(--text-primary)", lineHeight: 1 }}>
                {alerts.length}
              </div>
              <div style={{ fontSize: 8, color: "var(--text-secondary)", letterSpacing: "0.1em", marginTop: 2 }}>ALERTS</div>
            </div>
            <div style={{
              flex: 1,
              padding: "4px 8px",
              background: criticalCount > 0 ? "rgba(255,45,63,0.06)" : "var(--bg-elevated)",
              border: `1px solid ${criticalCount > 0 ? "rgba(255,45,63,0.3)" : "var(--border)"}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: criticalCount > 0 ? "#FF2D3F" : "var(--text-dim)", lineHeight: 1 }}>
                {criticalCount}
              </div>
              <div style={{ fontSize: 8, color: "var(--text-secondary)", letterSpacing: "0.1em", marginTop: 2 }}>CRITICAL</div>
            </div>
            <div style={{
              flex: 1,
              padding: "4px 8px",
              background: activeCount > 0 ? "rgba(0,212,255,0.04)" : "var(--bg-elevated)",
              border: `1px solid ${activeCount > 0 ? "rgba(0,212,255,0.2)" : "var(--border)"}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: activeCount > 0 ? "var(--accent)" : "var(--text-dim)", lineHeight: 1 }}>
                {activeCount}
              </div>
              <div style={{ fontSize: 8, color: "var(--text-secondary)", letterSpacing: "0.1em", marginTop: 2 }}>ACTIVE</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => seedCampaign().catch(console.error)}
            style={{
              flex: 1,
              padding: "5px 0",
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.3)",
              color: "var(--accent)",
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.1em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.12)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.06)" }}
          >
            ▶ CAMPAIGN
          </button>
          <button
            onClick={() => seedAlerts().catch(console.error)}
            style={{
              flex: 1,
              padding: "5px 0",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-bright)",
              color: "var(--text-secondary)",
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.08em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)" }}
          >
            SEED DEMO
          </button>
        </div>
      </div>

      {/* Alert list header */}
      {alerts.length > 0 && (
        <div style={{
          display: "flex",
          padding: "5px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-base)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            THREAT QUEUE — SORTED BY RISK
          </span>
        </div>
      )}

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {alerts.length === 0 ? (
          <div style={{
            padding: "32px 16px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>⬡</div>
            <p style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
              NO ACTIVE THREATS
            </p>
            <p style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>
              Load campaign or seed demo data above
            </p>
          </div>
        ) : (
          <motion.div layout>
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                selected={alert.id === selectedAlertId}
                onClick={() => handleSelect(alert.id).catch(console.error)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
