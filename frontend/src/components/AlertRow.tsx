import { motion } from "framer-motion"
import type { Alert } from "../types"
import { SeverityBadge } from "./SeverityBadge"

const STATUS_LABEL: Record<string, string> = {
  pending: "queued",
  triaging: "triaging...",
  triaged: "triaged",
  investigating: "investigating...",
  done: "done",
}

export function AlertRow({
  alert,
  selected,
  onClick,
}: {
  alert: Alert
  selected: boolean
  onClick: () => void
}) {
  const isActive = alert.status === "investigating" || alert.status === "triaging"

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors ${
        selected ? "bg-gray-800 border-l-2 border-l-blue-400" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <SeverityBadge severity={alert.severity} />
        <span className="text-xs text-gray-400 flex items-center gap-1">
          {isActive && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"
            />
          )}
          {STATUS_LABEL[alert.status] ?? alert.status}
        </span>
      </div>
      <p className="text-sm text-gray-100 truncate">{alert.title}</p>
      {alert.mitre_tactic && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">{alert.mitre_tactic}</p>
      )}
      {alert.severity_score != null && (
        <p className="text-xs text-gray-500 mt-0.5">score: {alert.severity_score}/10</p>
      )}
    </motion.div>
  )
}
