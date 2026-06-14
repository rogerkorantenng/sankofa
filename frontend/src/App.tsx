import { motion, AnimatePresence } from "framer-motion"
import { AlertQueue } from "./components/AlertQueue"
import { InvestigationSidebar } from "./components/InvestigationSidebar"
import { StatsBar } from "./components/StatsBar"
import { GraphView } from "./components/GraphView"
import { TimelineView } from "./components/TimelineView"
import { ViewSwitcher } from "./components/ViewSwitcher"
import { ActionLog } from "./components/ActionLog"
import { useSankofaStore } from "./store"

export default function App() {
  const { viewMode, actionLogOpen, setActionLogOpen } = useSankofaStore()

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-1)", overflow: "hidden" }}>

      {/* Top nav */}
      <nav style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        height: 52,
        background: "var(--bg-0)",
        borderBottom: "1px solid var(--border-0)",
        flexShrink: 0,
        zIndex: 10,
        boxShadow: "0 1px 0 var(--border-0)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
          }}>
            S
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)", letterSpacing: "-0.01em" }}>
            Sankofa
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 4,
            background: "var(--blue-bg)",
            color: "var(--blue-text)",
            border: "1px solid var(--blue-border)",
          }}>
            SOC Platform
          </span>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatsBar />
          <div style={{ width: 1, height: 20, background: "var(--border-0)" }} />
          <ViewSwitcher />
          <div style={{ width: 1, height: 20, background: "var(--border-0)" }} />
          <a
            href="/runbooks"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-1)",
              textDecoration: "none",
              padding: "4px 10px",
              borderRadius: 6,
              transition: "background 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
          >
            Runbooks
          </a>
          <button
            onClick={() => setActionLogOpen(!actionLogOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-0)",
              background: actionLogOpen ? "var(--bg-2)" : "var(--bg-0)",
              color: actionLogOpen ? "var(--text-0)" : "var(--text-1)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.1s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Action Log
          </button>
        </div>
      </nav>

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left — Alert Queue */}
        <div style={{
          width: 340,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border-0)",
          background: "var(--bg-0)",
          boxShadow: "1px 0 0 var(--border-0)",
        }}>
          <AlertQueue />
        </div>

        {/* Right — Visualization */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--bg-1)" }}>
          <AnimatePresence mode="wait">
            {viewMode === "graph" ? (
              <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} style={{ position: "absolute", inset: 0 }}>
                <GraphView />
              </motion.div>
            ) : (
              <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
                <TimelineView />
              </motion.div>
            )}
          </AnimatePresence>

          <InvestigationSidebar />
          <ActionLog />
        </div>
      </div>
    </div>
  )
}
