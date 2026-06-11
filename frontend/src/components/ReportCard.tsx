import type { AlertDetail } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { KillChainTimeline } from "./KillChainTimeline"

export function ReportCard({ alert }: { alert: AlertDetail }) {
  const score = alert.severity_score ?? 0
  const confidence = alert.confidence ?? 0
  const killChain = alert.kill_chain ?? []
  const steps = alert.containment_steps ?? []

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-medium text-sm">{alert.title}</p>
          {alert.mitre_tactic && (
            <span className="inline-block mt-1 text-xs bg-gray-700 text-blue-300 px-2 py-0.5 rounded">
              {alert.mitre_tactic}
            </span>
          )}
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Severity Score</span>
          <span>{score}/10</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-red-500"
            style={{ width: `${score * 10}%` }}
          />
        </div>
      </div>

      {alert.tier === "full" && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Confidence</span>
            <span>{confidence}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-blue-500"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      )}

      {alert.summary && (
        <p className="text-xs text-gray-300 leading-relaxed">{alert.summary}</p>
      )}

      {alert.status !== "done" && (
        <p className="text-xs text-blue-400 animate-pulse">
          {alert.status === "investigating"
            ? "Deep investigation in progress..."
            : "Triaging..."}
        </p>
      )}

      <KillChainTimeline steps={killChain} />

      {steps.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Containment Steps
          </h3>
          <ul className="space-y-1">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-200">
                <span className="text-green-400 mt-0.5">✓</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
