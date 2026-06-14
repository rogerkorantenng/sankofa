import { useEffect, useState } from "react"
import { fetchRunbooks, deleteRunbook } from "../api"
import type { Runbook } from "../types"

export function RunbooksPage() {
  const [runbooks, setRunbooks] = useState<Runbook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRunbooks().then(setRunbooks).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await deleteRunbook(id)
    setRunbooks((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <a href="/" className="text-xs text-gray-500 hover:text-white mb-2 block">← Back to dashboard</a>
            <h1 className="text-xl font-bold text-white">Runbooks</h1>
            <p className="text-xs text-gray-400 mt-1">Automated response playbooks — define what Sankofa does when an alert fires</p>
          </div>
          <a
            href="/runbooks/new"
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded transition-colors"
          >
            + New Runbook
          </a>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : runbooks.length === 0 ? (
          <div className="border border-gray-700 rounded p-8 text-center">
            <p className="text-gray-400 text-sm mb-2">No runbooks yet.</p>
            <p className="text-gray-600 text-xs">Default runbooks are created automatically when the first alert is triaged.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runbooks.map((rb) => {
              const conds = rb.trigger_conditions as { mitre_tactics?: string[]; severity?: string[] }
              return (
                <div key={rb.id} className="border border-gray-700 rounded p-4 bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-white">{rb.name}</h3>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {conds.mitre_tactics?.map((t) => (
                          <span key={t} className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                        {conds.severity?.map((s) => (
                          <span key={s} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{rb.steps.length} steps</p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/runbooks/${rb.id}`}
                        className="text-xs text-gray-400 hover:text-white border border-gray-600 px-2 py-1 rounded transition-colors"
                      >
                        Edit
                      </a>
                      <button
                        onClick={() => handleDelete(rb.id).catch(console.error)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-2 py-1 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1 flex-wrap">
                    {rb.steps.map((step, i) => (
                      <span key={step.id} className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          step.risk_level === "high"
                            ? "bg-orange-900/50 text-orange-300"
                            : "bg-gray-800 text-gray-300"
                        }`}>
                          {step.label}
                        </span>
                        {i < rb.steps.length - 1 && <span className="text-gray-600 text-xs">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
