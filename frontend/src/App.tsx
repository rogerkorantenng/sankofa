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
  const { wsConnected, viewMode, actionLogOpen, setActionLogOpen } = useSankofaStore()

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-mono overflow-hidden">
      <StatsBar />

      {/* Top nav */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
        <span className="text-xs font-bold text-white tracking-widest">SANKOFA</span>
        <div className="flex items-center gap-3">
          <ViewSwitcher />
          <a href="/runbooks" className="text-xs text-gray-400 hover:text-white transition-colors">
            Runbooks
          </a>
          <button
            onClick={() => setActionLogOpen(!actionLogOpen)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
            title="Action Log"
          >
            ⏱ Log
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Alert Queue */}
        <div className="w-2/5 flex-shrink-0 flex flex-col overflow-hidden border-r border-gray-700">
          <AlertQueue />
        </div>

        {/* Right: View pane */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            {viewMode === "graph" ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <GraphView />
              </motion.div>
            ) : (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 overflow-auto"
              >
                <TimelineView />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Investigation sidebar overlays the view */}
          <InvestigationSidebar />

          {/* Global Action Log */}
          <ActionLog />
        </div>
      </div>

      <div className="fixed bottom-2 right-2 text-xs text-gray-600">
        {wsConnected ? "● live" : "○ connecting"}
      </div>
    </div>
  )
}
