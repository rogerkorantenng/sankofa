import { motion, AnimatePresence } from "framer-motion"
import { useSankofaStore } from "../store"
import { ReportCard } from "./ReportCard"
import { ChatPanel } from "./ChatPanel"

export function InvestigationSidebar() {
  const { selectedAlert, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  return (
    <AnimatePresence>
      {selectedAlert && (
        <motion.div
          key="sidebar"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 38 }}
          style={{
            position: "absolute",
            right: 0, top: 0, bottom: 0,
            width: "64%",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-0)",
            borderLeft: "1px solid var(--border-0)",
            zIndex: 20,
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            height: 44,
            borderBottom: "1px solid var(--border-0)",
            flexShrink: 0,
            background: "var(--bg-0)",
          }}>
            <div style={{ overflow: "hidden" }}>
              <p style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-0)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {selectedAlert.title}
              </p>
            </div>
            <button
              onClick={() => { setSelectedAlertId(null); setSelectedAlert(null) }}
              style={{
                width: 28, height: 28,
                flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 6,
                border: "1px solid var(--border-0)",
                background: "transparent",
                color: "var(--text-2)",
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.1s",
                marginLeft: 10,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              ×
            </button>
          </div>

          {/* Report */}
          <div style={{ flexShrink: 0, overflowY: "auto", maxHeight: "55%", borderBottom: "1px solid var(--border-0)" }}>
            <ReportCard alert={selectedAlert} />
          </div>

          {/* Chat section */}
          <div style={{
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            height: 36,
            background: "var(--bg-1)",
            borderBottom: "1px solid var(--border-0)",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>
              Ask AI Analyst
            </span>
          </div>

          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <ChatPanel alertId={selectedAlert.id} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
