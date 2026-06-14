import type { AlertDetail } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { KillChainTimeline } from "./KillChainTimeline"
import { AuditTrail } from "./AuditTrail"
import { EnrichmentPanel } from "./EnrichmentPanel"

export function ReportCard({ alert }: { alert: AlertDetail }) {
  const score = alert.severity_score ?? 0
  const confidence = alert.confidence ?? 0
  const killChain = alert.kill_chain ?? []
  const steps = alert.containment_steps ?? []
  const findings = alert.subagent_findings ?? {}
  const queries = alert.spl_queries ?? {}
  const threatIntel = alert.threat_intel ?? null

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

      {threatIntel && <EnrichmentPanel intel={threatIntel} />}

      {alert.status !== "done" && (
        <p className="text-xs text-blue-400 animate-pulse">
          {alert.status === "investigating"
            ? "Deep investigation in progress..."
            : "Triaging..."}
        </p>
      )}

      <KillChainTimeline steps={killChain} />

      {Object.keys(findings).length > 0 && (
        <AuditTrail findings={findings} queries={queries} />
      )}

      {steps.length > 0 && (
        <ContainmentActions alertId={alert.id} steps={steps} />
      )}
    </div>
  )
}

import { useState, useEffect } from "react"
import { decideAction, getActions } from "../api"
import type { ActionDecision } from "../types"

function ContainmentActions({
  alertId,
  steps,
}: {
  alertId: string
  steps: string[]
}) {
  const [decisions, setDecisions] = useState<Record<number, "pending" | "approved" | "dismissed">>({})

  useEffect(() => {
    getActions(alertId)
      .then((actions) => {
        const map: Record<number, "pending" | "approved" | "dismissed"> = {}
        actions.forEach((a: ActionDecision) => { map[a.action_index] = a.status })
        setDecisions(map)
      })
      .catch(() => {})
  }, [alertId])

  async function decide(index: number, text: string, status: "approved" | "dismissed") {
    await decideAction(alertId, index, text, status)
    setDecisions((prev) => ({ ...prev, [index]: status }))
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Containment Actions
      </h3>
      <ul className="space-y-2">
        {steps.map((step, i) => {
          const status = decisions[i] ?? "pending"
          return (
            <li key={i} className="border border-gray-700 rounded p-2">
              <p className="text-xs text-gray-200 mb-2">{step}</p>
              {status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(i, step, "approved").catch(console.error)}
                    className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => decide(i, step, "dismissed").catch(console.error)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
                  >
                    ✗ Dismiss
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-medium ${status === "approved" ? "text-green-400" : "text-gray-500"}`}>
                  {status === "approved" ? "✓ Approved" : "✗ Dismissed"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
