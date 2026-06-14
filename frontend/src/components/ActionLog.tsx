import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSankofaStore } from "../store"
import { fetchActions } from "../api"
import type { ActionLogEntry } from "../types"

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  executed:         { color: "var(--green)",  label: "EXEC" },
  approved:         { color: "var(--green)",  label: "APRV" },
  pending_approval: { color: "#FFB800",       label: "PEND" },
  dismissed:        { color: "var(--text-dim)", label: "DISM" },
  failed:           { color: "#FF2D3F",       label: "FAIL" },
}

function formatTime(ts: string | null): string {
  if (!ts) return "—"
  try { return new Date(ts).toISOString().slice(11, 19) }
  catch { return "—" }
}

export function ActionLog() {
  const { actionLogOpen, setActionLogOpen } = useSankofaStore()
  const [logs, setLogs] = useState<ActionLogEntry[]>([])

  useEffect(() => {
    if (!actionLogOpen) return
    fetchActions().then(setLogs).catch(() => {})
    const interval = setInterval(() => fetchActions().then(setLogs).catch(() => {}), 5000)
    return () => clearInterval(interval)
  }, [actionLogOpen])

  return (
    <AnimatePresence>
      {actionLogOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(7,11,15,0.6)",
              zIndex: 30,
            }}
            onClick={() => setActionLogOpen(false)}
          />
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 320,
              background: "var(--bg-panel)",
              borderLeft: "1px solid var(--border)",
              zIndex: 40,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
              height: 34,
              background: "var(--bg-base)",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 7, color: "var(--green)", letterSpacing: "0.15em", fontWeight: 700 }}>◈</span>
                <span style={{ fontSize: 8, color: "var(--text-primary)", letterSpacing: "0.12em", fontWeight: 700 }}>
                  ACTION LOG
                </span>
                {logs.length > 0 && (
                  <span style={{
                    fontSize: 8,
                    padding: "1px 5px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}>
                    {logs.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setActionLogOpen(false)}
                style={{
                  width: 20, height: 20,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontSize: 10, cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Column headers */}
            {logs.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "42px 1fr 40px",
                padding: "4px 14px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-base)",
                flexShrink: 0,
              }}>
                {["STATUS", "ACTION", "TIME"].map(h => (
                  <span key={h} style={{ fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.12em" }}>{h}</span>
                ))}
              </div>
            )}

            {/* Log entries */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {logs.length === 0 ? (
                <div style={{ padding: "24px 14px", textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>NO ACTIONS YET</p>
                  <p style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>Triage an alert to see autonomous actions here</p>
                </div>
              ) : (
                logs.map((log) => {
                  const conf = STATUS_CONFIG[log.status] ?? { color: "var(--text-dim)", label: "—" }
                  return (
                    <div key={log.id} style={{
                      display: "grid",
                      gridTemplateColumns: "42px 1fr 40px",
                      padding: "7px 14px",
                      borderBottom: "1px solid var(--border)",
                      alignItems: "start",
                    }}>
                      <div style={{ paddingTop: 1 }}>
                        <span style={{
                          fontSize: 7,
                          padding: "1px 4px",
                          background: `${conf.color}14`,
                          border: `1px solid ${conf.color}40`,
                          color: conf.color,
                          letterSpacing: "0.08em",
                          fontWeight: 700,
                        }}>
                          {conf.label}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: "var(--text-primary)", marginBottom: 3, lineHeight: 1.3 }}>
                          {log.description}
                        </p>
                        <p style={{ fontSize: 8, color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                          {log.action_type}
                          {log.risk_level === "high" && (
                            <span style={{ color: "#FF7A1A", marginLeft: 5 }}>· HIGH-RISK</span>
                          )}
                        </p>
                        {log.result && (
                          <p style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>
                            {log.result.slice(0, 80)}{log.result.length > 80 ? "…" : ""}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: "right", paddingTop: 1 }}>
                        <span style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatTime(log.executed_at)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
