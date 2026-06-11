import { useEffect } from "react"
import { useSankofaStore } from "../store"
import { AlertRow } from "./AlertRow"
import { fetchAlert, seedAlerts } from "../api"
import type { Alert } from "../types"

export function AlertQueue() {
  const {
    alerts, setAlerts, selectedAlertId,
    setSelectedAlertId, setSelectedAlert, setWsConnected,
  } = useSankofaStore()

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/alerts`)
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (e: MessageEvent) => {
      try {
        setAlerts(JSON.parse(e.data as string) as Alert[])
      } catch {
        // ignore parse errors
      }
    }
    return () => ws.close()
  }, [setAlerts, setWsConnected])

  async function handleSelect(id: string) {
    setSelectedAlertId(id)
    const detail = await fetchAlert(id)
    setSelectedAlert(detail)
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h1 className="text-white font-semibold text-sm tracking-wide">
          SANKOFA — SOC TRIAGE
        </h1>
        <button
          onClick={() => seedAlerts().catch(console.error)}
          className="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-2 py-1 rounded transition-colors"
        >
          seed demo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <p className="text-gray-500 text-xs p-4">
            No alerts. Click &quot;seed demo&quot; to load sample data.
          </p>
        ) : (
          alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              selected={alert.id === selectedAlertId}
              onClick={() => handleSelect(alert.id).catch(console.error)}
            />
          ))
        )}
      </div>
    </div>
  )
}
