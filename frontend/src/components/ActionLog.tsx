import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSankofaStore } from "../store"
import { fetchActions } from "../api"
import type { ActionLogEntry } from "../types"

const STATUS_COLORS: Record<string, string> = {
  executed: "text-green-400 bg-green-900/30",
  approved: "text-green-400 bg-green-900/30",
  pending_approval: "text-yellow-400 bg-yellow-900/30",
  dismissed: "text-gray-500 bg-gray-800",
  failed: "text-red-400 bg-red-900/30",
}

const STATUS_LABEL: Record<string, string> = {
  executed: "executed",
  approved: "approved",
  pending_approval: "pending",
  dismissed: "dismissed",
  failed: "failed",
}

function formatTime(ts: string | null): string {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return "—"
  }
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
            className="absolute inset-0 bg-black/40 z-30"
            onClick={() => setActionLogOpen(false)}
          />
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-700 z-40 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-white">Action Log</h2>
              <button
                onClick={() => setActionLogOpen(false)}
                className="text-gray-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-xs p-4">No actions yet. Triage some alerts first.</p>
              ) : (
                <ul className="divide-y divide-gray-800">
                  {logs.map((log) => (
                    <li key={log.id} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs text-gray-200 leading-tight flex-1">{log.description}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[log.status] ?? "text-gray-400"}`}>
                          {STATUS_LABEL[log.status] ?? log.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono">{log.action_type}</span>
                        <span>·</span>
                        <span>{formatTime(log.executed_at)}</span>
                        {log.risk_level === "high" && (
                          <>
                            <span>·</span>
                            <span className="text-orange-400">high-risk</span>
                          </>
                        )}
                      </div>
                      {log.result && (
                        <p className="text-xs text-gray-600 mt-0.5 truncate">{log.result}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
