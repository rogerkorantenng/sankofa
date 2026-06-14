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
    setRunbooks(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)", color: "var(--text-0)", fontFamily: "Inter, sans-serif" }}>
      {/* Nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
        background: "var(--bg-0)", borderBottom: "1px solid var(--border-0)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>S</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}>Sankofa</span>
          <span style={{ color: "var(--text-3)", fontSize: 14 }}>/</span>
          <span style={{ fontSize: 14, color: "var(--text-1)" }}>Runbooks</span>
        </div>
        <a href="/" style={{ fontSize: 13, color: "var(--blue)", textDecoration: "none", fontWeight: 500 }}>← Back to dashboard</a>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-0)", marginBottom: 4 }}>Runbooks</h1>
            <p style={{ fontSize: 13, color: "var(--text-2)" }}>
              Automated response playbooks — define what Sankofa does when an alert fires
            </p>
          </div>
          <a href="/runbooks/new" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 6,
            background: "var(--blue)", color: "#fff",
            fontSize: 13, fontWeight: 500, textDecoration: "none",
            transition: "opacity 0.1s",
          }}>
            + New Runbook
          </a>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-2)", fontSize: 13 }}>
            <div style={{ width: 14, height: 14, border: "2px solid var(--border-1)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Loading runbooks…
          </div>
        ) : runbooks.length === 0 ? (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            border: "1px solid var(--border-0)", borderRadius: 8,
            background: "var(--bg-0)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "var(--bg-2)", border: "1px solid var(--border-0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)", marginBottom: 4 }}>No runbooks yet</p>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
              Default runbooks are created automatically when the first alert is triaged.
            </p>
            <a href="/runbooks/new" style={{
              display: "inline-block", padding: "7px 16px", borderRadius: 6,
              border: "1px solid var(--border-0)", background: "var(--bg-0)",
              color: "var(--text-1)", fontSize: 13, fontWeight: 500, textDecoration: "none",
            }}>
              Create a runbook
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runbooks.map(rb => {
              const conds = rb.trigger_conditions as { mitre_tactics?: string[]; severity?: string[] }
              return (
                <div key={rb.id} style={{
                  border: "1px solid var(--border-0)", borderRadius: 8,
                  background: "var(--bg-0)",
                  padding: "16px",
                  transition: "box-shadow 0.1s",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)", marginBottom: 6 }}>{rb.name}</p>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                        {conds.mitre_tactics?.map(t => (
                          <span key={t} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--purple-bg)", border: "1px solid var(--purple-border)", color: "var(--purple-text)", fontWeight: 500 }}>{t}</span>
                        ))}
                        {conds.severity?.map(s => (
                          <span key={s} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--bg-2)", border: "1px solid var(--border-0)", color: "var(--text-1)", textTransform: "capitalize" }}>{s}</span>
                        ))}
                        <span style={{ fontSize: 11, color: "var(--text-2)" }}>{rb.steps.length} steps</span>
                      </div>

                      {/* Step flow */}
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                        {rb.steps.map((step, i) => (
                          <span key={step.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{
                              fontSize: 11, padding: "3px 9px", borderRadius: 4,
                              background: step.risk_level === "high" ? "var(--high-bg)" : "var(--bg-2)",
                              border: `1px solid ${step.risk_level === "high" ? "var(--high-border)" : "var(--border-0)"}`,
                              color: step.risk_level === "high" ? "var(--high-text)" : "var(--text-1)",
                              fontWeight: 500,
                            }}>
                              {step.risk_level === "high" && "⚠ "}{step.label}
                            </span>
                            {i < rb.steps.length - 1 && (
                              <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <a href={`/runbooks/${rb.id}`} style={{
                        padding: "5px 12px", borderRadius: 5,
                        border: "1px solid var(--border-0)", background: "var(--bg-0)",
                        color: "var(--text-1)", fontSize: 12, fontWeight: 500, textDecoration: "none",
                      }}>Edit</a>
                      <button onClick={() => handleDelete(rb.id).catch(console.error)} style={{
                        padding: "5px 12px", borderRadius: 5,
                        border: "1px solid var(--critical-border)", background: "var(--critical-bg)",
                        color: "var(--critical-text)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                      }}>Delete</button>
                    </div>
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
