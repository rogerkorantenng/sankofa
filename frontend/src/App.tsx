import { AlertQueue } from "./components/AlertQueue"
import { InvestigationSidebar } from "./components/InvestigationSidebar"
import { useSankofaStore } from "./store"

export default function App() {
  const { wsConnected } = useSankofaStore()

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-mono overflow-hidden">
      <div className="w-2/5 flex-shrink-0 flex flex-col overflow-hidden">
        <AlertQueue />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <InvestigationSidebar />
      </div>
      <div className="fixed bottom-2 right-2 text-xs text-gray-600">
        {wsConnected ? "● live" : "○ connecting"}
      </div>
    </div>
  )
}
