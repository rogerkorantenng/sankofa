import { useSankofaStore } from "../store"
import { ReportCard } from "./ReportCard"
import { ChatPanel } from "./ChatPanel"

export function InvestigationSidebar() {
  const { selectedAlert } = useSankofaStore()

  if (!selectedAlert) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Select an alert to investigate
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: "55%" }}>
        <ReportCard alert={selectedAlert} />
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        <ChatPanel alertId={selectedAlert.id} />
      </div>
    </div>
  )
}
