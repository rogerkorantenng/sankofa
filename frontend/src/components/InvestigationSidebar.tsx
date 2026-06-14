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
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-3/5 flex flex-col bg-gray-950 border-l border-gray-700 z-20 shadow-2xl"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-xs text-gray-400">Investigation</span>
            <button
              onClick={() => { setSelectedAlertId(null); setSelectedAlert(null) }}
              className="text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: "55%" }}>
            <ReportCard alert={selectedAlert} />
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatPanel alertId={selectedAlert.id} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
