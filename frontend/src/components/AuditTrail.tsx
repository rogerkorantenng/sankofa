import { useState } from "react"

const AGENT_LABELS: Record<string, string> = {
  auth: "Auth Agent",
  network: "Network Agent",
  endpoint: "Endpoint Agent",
  lateral: "Lateral Movement Agent",
}

export function AuditTrail({
  findings,
  queries,
}: {
  findings: Record<string, string>
  queries: Record<string, string>
}) {
  const agents = Object.keys(findings).filter((k) => findings[k])
  if (!agents.length) return null

  return (
    <div className="mt-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Evidence Trail
      </h3>
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentEvidence
            key={agent}
            label={AGENT_LABELS[agent] ?? agent}
            finding={findings[agent]}
            spl={queries?.[agent] ?? ""}
          />
        ))}
      </div>
    </div>
  )
}

function AgentEvidence({
  label,
  finding,
  spl,
}: {
  label: string
  finding: string
  spl: string
}) {
  const [open, setOpen] = useState(false)
  const isMcp = spl.startsWith("[MCP generated]")
  const displaySpl = isMcp ? spl.replace("[MCP generated] ", "") : spl

  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-200">{label}</span>
          {isMcp && (
            <span className="text-xs bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded font-mono">
              MCP
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 bg-gray-900">
          <p className="text-xs text-gray-300 leading-relaxed">{finding}</p>
          {spl && (
            <div>
              <p className="text-xs text-gray-500 mb-1 font-mono">SPL Query:</p>
              <pre className="text-xs text-blue-300 font-mono bg-gray-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {displaySpl}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
