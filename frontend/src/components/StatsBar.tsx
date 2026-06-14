import { useEffect } from "react"
import { useSankofaStore } from "../store"
import { fetchStats } from "../api"

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-gray-400",
}

export function StatsBar() {
  const { stats, setStats } = useSankofaStore()

  useEffect(() => {
    const load = () => fetchStats().then(setStats).catch(() => {})
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [setStats])

  if (!stats) return null

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900 border-b border-gray-700 text-xs font-mono overflow-x-auto whitespace-nowrap">
      {(["critical", "high", "medium", "low"] as const).map((sev) => (
        <span key={sev} className={`flex items-center gap-1 ${SEVERITY_COLORS[sev]}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
          {stats[sev]} {sev}
        </span>
      ))}
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">
        avg confidence <span className="text-blue-300">{stats.avg_confidence}%</span>
      </span>
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">
        <span className="text-green-400">{stats.actions_executed}</span> actions executed
      </span>
      {stats.actions_pending > 0 && (
        <>
          <span className="text-gray-600">|</span>
          <span className="text-yellow-400 animate-pulse">
            {stats.actions_pending} pending approval
          </span>
        </>
      )}
    </div>
  )
}
