import { useSankofaStore } from "../store"
import type { Alert, SeverityLevel } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { fetchAlert } from "../api"

const SEVERITY_ORDER: SeverityLevel[] = ["critical", "high", "medium", "low"]

const SEVERITY_BG: Record<SeverityLevel, string> = {
  critical: "border-red-500/40 bg-red-950/20",
  high: "border-orange-500/40 bg-orange-950/20",
  medium: "border-yellow-500/40 bg-yellow-950/20",
  low: "border-gray-500/40 bg-gray-900/20",
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return ""
  }
}

export function TimelineView() {
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  if (!alerts.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No alerts to display. Click ▶ campaign to load data.
      </div>
    )
  }

  const bySeverity = SEVERITY_ORDER.reduce((acc, sev) => {
    acc[sev] = alerts
      .filter((a) => a.severity === sev)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return acc
  }, {} as Record<SeverityLevel, Alert[]>)

  async function handleClick(alert: Alert) {
    setSelectedAlertId(alert.id)
    const detail = await fetchAlert(alert.id)
    setSelectedAlert(detail)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-3">
      {SEVERITY_ORDER.map((sev) => (
        <div key={sev} className={`border rounded p-2 ${SEVERITY_BG[sev]}`}>
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={sev} />
            <span className="text-xs text-gray-500">{bySeverity[sev].length} alerts</span>
          </div>
          {bySeverity[sev].length === 0 ? (
            <p className="text-xs text-gray-600 italic pl-1">No alerts</p>
          ) : (
            <div className="flex items-start gap-2 overflow-x-auto pb-1">
              {bySeverity[sev].map((alert, i) => (
                <div key={alert.id} className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleClick(alert).catch(console.error)}
                    className="w-40 border border-gray-600 bg-gray-800 hover:bg-gray-700 rounded p-2 text-left transition-colors"
                  >
                    <p className="text-xs text-white truncate leading-tight">{alert.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatTime(alert.timestamp)}</p>
                    {alert.severity_score != null && (
                      <p className="text-xs text-gray-500">score: {alert.severity_score}/10</p>
                    )}
                  </button>
                  {i < bySeverity[sev].length - 1 && (
                    <span className="text-gray-600 text-xs flex-shrink-0">→</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
