import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSankofaStore } from "../store"
import { fetchActions } from "../api"
import type { ActionLogEntry } from "../types"

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  executed:         { color: "var(--green-text)",  bg: "var(--green-bg)",   label: "Executed"  },
  approved:         { color: "var(--green-text)",  bg: "var(--green-bg)",   label: "Approved"  },
  pending_approval: { color: "var(--medium-text)", bg: "var(--medium-bg)",  label: "Pending"   },
  dismissed:        { color: "var(--text-2)",      bg: "var(--bg-2)",       label: "Dismissed" },
  failed:           { color: "var(--critical-text)", bg: "var(--critical-bg)", label: "Failed" },
}

function formatTime(ts: string | null) {
  if (!ts) return "—"
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
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
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            style={{ position: "absolute", inset: 0, background: "#000", zIndex: 30 }}
            onClick={() => setActionLogOpen(false)}
          />
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
            style={{
              position: "absolute",
              right: 0, top: 0, bottom: 0,
              width: 360,
              background: "var(--bg-0)",
              borderLeft: "1px solid var(--border-0)",
              zIndex: 40,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              height: 44,
              borderBottom: "1px solid var(--border-0)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>Action Log</span>
                {logs.length > 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: "1px 7px",
                    borderRadius: 10,
                    background: "var(--bg-2)",
                    border: "1px solid var(--border-0)",
                    color: "var(--text-2)",
                    fontWeight: 500,
                  }}>{logs.length}</span>
                )}
              </div>
              <button
                onClick={() => setActionLogOpen(false)}
                style={{
                  width: 28, height: 28,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 6,
                  border: "1px solid var(--border-0)",
                  background: "transparent",
                  color: "var(--text-2)",
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >×</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {logs.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", marginBottom: 4 }}>No actions yet</p>
                  <p style={{ fontSize: 12, color: "var(--text-2)" }}>Triage an alert to see autonomous actions here</p>
                </div>
              ) : (
                logs.map((log, i) => {
                  const conf = STATUS_CONFIG[log.status] ?? { color: "var(--text-2)", bg: "var(--bg-2)", label: log.status }
                  return (
                    <div key={log.id} style={{
                      padding: "10px 16px",
                      borderBottom: i < logs.length - 1 ? "1px solid var(--border-0)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <p style={{ fontSize: 13, color: "var(--text-0)", lineHeight: 1.35, flex: 1 }}>
                          {log.description}
                        </p>
                        <span style={{
                          fontSize: 11,
                          padding: "2px 7px",
                          borderRadius: 4,
                          background: conf.bg,
                          color: conf.color,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}>{conf.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-2)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {log.action_type}
                        </span>
                        {log.risk_level === "high" && (
                          <span style={{ fontSize: 11, color: "var(--high-text)", fontWeight: 500 }}>· High risk</span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                          {formatTime(log.executed_at)}
                        </span>
                      </div>
                      {log.result && (
                        <p style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.4 }}>
                          {log.result.slice(0, 100)}{log.result.length > 100 ? "…" : ""}
                        </p>
                      )}
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
