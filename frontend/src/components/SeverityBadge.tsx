import type { SeverityLevel } from "../types"

const COLORS: Record<SeverityLevel, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-gray-500 text-white",
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${COLORS[severity]}`}>
      {severity}
    </span>
  )
}
