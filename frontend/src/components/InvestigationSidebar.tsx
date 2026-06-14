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
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "62%",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-panel)",
            borderLeft: "1px solid var(--border)",
            zIndex: 20,
          }}
        >
          {/* Sidebar header */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em" }}>INVESTIGATION /</span>
              <span style={{
                fontSize: 8,
                color: "var(--accent)",
                letterSpacing: "0.12em",
                fontWeight: 700,
                maxWidth: 280,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {selectedAlert.title}
              </span>
            </div>
            <button
              onClick={() => { setSelectedAlertId(null); setSelectedAlert(null) }}
              style={{
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: 10,
                cursor: "pointer",
                transition: "all 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--text-secondary)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)" }}
            >
              ✕
            </button>
          </div>

          {/* Report section */}
          <div style={{ flexShrink: 0, overflowY: "auto", maxHeight: "54%" }}>
            <ReportCard alert={selectedAlert} />
          </div>

          {/* Divider */}
          <div style={{
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            height: 26,
            background: "var(--bg-base)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.15em" }}>
              AI ANALYST — ASK A FOLLOW-UP
            </span>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <ChatPanel alertId={selectedAlert.id} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
