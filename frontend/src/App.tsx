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
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "var(--bg-base)",
      overflow: "hidden",
    }}>
      {/* Stats bar */}
      <StatsBar />

      {/* Nav bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        height: 34,
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 8,
            color: "var(--text-dim)",
            letterSpacing: "0.15em",
          }}>
            OPERATIONS /
          </span>
          <span style={{
            fontSize: 8,
            color: "var(--accent)",
            letterSpacing: "0.15em",
            fontWeight: 700,
          }}>
            THREAT INTELLIGENCE
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ViewSwitcher />

          <div style={{ width: 1, height: 14, background: "var(--border)" }} />

          <a
            href="/runbooks"
            style={{
              fontSize: 9,
              color: "var(--text-secondary)",
              letterSpacing: "0.1em",
              textDecoration: "none",
              fontFamily: "'JetBrains Mono', monospace",
              transition: "color 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)" }}
          >
            RUNBOOKS
          </a>

          <button
            onClick={() => setActionLogOpen(!actionLogOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              background: actionLogOpen ? "rgba(0,232,135,0.08)" : "transparent",
              border: `1px solid ${actionLogOpen ? "rgba(0,232,135,0.3)" : "var(--border)"}`,
              color: actionLogOpen ? "var(--green)" : "var(--text-secondary)",
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.1em",
              cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            <span style={{ fontSize: 8 }}>◈</span>
            ACTION LOG
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Left panel — Alert Queue */}
        <div style={{
          width: 320,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border)",
        }}>
          <AlertQueue />
        </div>

        {/* Right panel — Views */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* View label */}
          <div style={{
            position: "absolute",
            top: 8,
            left: 12,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            pointerEvents: "none",
          }}>
            <span style={{
              fontSize: 8,
              color: "var(--text-dim)",
              letterSpacing: "0.15em",
              background: "rgba(7,11,15,0.8)",
              padding: "2px 6px",
              border: "1px solid var(--border)",
            }}>
              {viewMode === "graph" ? "THREAT GRAPH" : "ATTACK TIMELINE"}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === "graph" ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: "absolute", inset: 0 }}
              >
                <GraphView />
              </motion.div>
            ) : (
              <motion.div
                key="timeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: "absolute", inset: 0, overflowY: "auto" }}
              >
                <TimelineView />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Investigation sidebar */}
          <InvestigationSidebar />

          {/* Action log */}
          <ActionLog />
        </div>
      </div>
    </div>
  )
}
