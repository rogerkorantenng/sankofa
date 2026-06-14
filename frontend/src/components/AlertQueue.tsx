import { useEffect } from "react"
import { motion } from "framer-motion"
import { useSankofaStore } from "../store"
import { AlertRow } from "./AlertRow"
import { fetchAlert, seedAlerts, seedCampaign } from "../api"
import type { Alert } from "../types"

export function AlertQueue() {
  const { alerts, setAlerts, selectedAlertId, setSelectedAlertId, setSelectedAlert, setWsConnected } = useSankofaStore()

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/alerts`)
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (e: MessageEvent) => {
      try { setAlerts(JSON.parse(e.data as string) as Alert[]) }
      catch { /* noop */ }
    }
    return () => ws.close()
  }, [setAlerts, setWsConnected])

  async function handleSelect(id: string) {
    setSelectedAlertId(id)
    const detail = await fetchAlert(id)
    setSelectedAlert(detail)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-0)" }}>

      {/* Queue header */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: "1px solid var(--border-0)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>
            Alert Queue
          </span>
          <span style={{
            fontSize: 11,
            color: "var(--text-2)",
            background: "var(--bg-2)",
            border: "1px solid var(--border-0)",
            borderRadius: 10,
            padding: "1px 8px",
          }}>
            {alerts.length}
          </span>
        </div>

        {/* Summary chips */}
        {alerts.length > 0 && (() => {
          const crit = alerts.filter(a => a.severity === "critical").length
          const active = alerts.filter(a => a.status === "investigating" || a.status === "triaging").length
          return (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {crit > 0 && (
                <span style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--critical-bg)",
                  border: "1px solid var(--critical-border)",
                  color: "var(--critical-text)",
                  fontWeight: 500,
                }}>
                  {crit} critical
                </span>
              )}
              {active > 0 && (
                <span style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--blue-bg)",
                  border: "1px solid var(--blue-border)",
                  color: "var(--blue-text)",
                  fontWeight: 500,
                }}>
                  {active} analyzing
                </span>
              )}
            </div>
          )
        })()}

        {/* Seed buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => seedCampaign().catch(console.error)}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: 6,
              border: "1px solid var(--blue-border)",
              background: "var(--blue-bg)",
              color: "var(--blue-text)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--blue-border)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--blue-bg)" }}
          >
            Load Campaign
          </button>
          <button
            onClick={() => seedAlerts().catch(console.error)}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: 6,
              border: "1px solid var(--border-0)",
              background: "var(--bg-0)",
              color: "var(--text-1)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-0)" }}
          >
            Seed Demo
          </button>
        </div>
      </div>

      {/* Sort header */}
      {alerts.length > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 14px",
          borderBottom: "1px solid var(--border-0)",
          background: "var(--bg-1)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 500 }}>
            Sorted by risk score
          </span>
        </div>
      )}

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {alerts.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <div style={{
              width: 40, height: 40,
              borderRadius: 8,
              background: "var(--bg-2)",
              border: "1px solid var(--border-0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", marginBottom: 4 }}>No active alerts</p>
            <p style={{ fontSize: 12, color: "var(--text-2)" }}>Load campaign data to begin triage</p>
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
