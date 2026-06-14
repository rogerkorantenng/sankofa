import { useState } from "react"

const AGENT_LABELS: Record<string, string> = {
  auth:     "Authentication",
  network:  "Network",
  endpoint: "Endpoint",
  lateral:  "Lateral Movement",
}

export function AuditTrail({ findings, queries }: { findings: Record<string, string>; queries: Record<string, string> }) {
  const agents = Object.keys(findings).filter(k => findings[k])
  if (!agents.length) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {agents.map(agent => (
        <AgentEvidence
          key={agent}
          label={AGENT_LABELS[agent] ?? agent}
          finding={findings[agent]}
          spl={queries?.[agent] ?? ""}
        />
      ))}
    </div>
  )
}

function AgentEvidence({ label, finding, spl }: { label: string; finding: string; spl: string }) {
  const [open, setOpen] = useState(false)
  const isMcp = spl.startsWith("[MCP generated]")
  const displaySpl = isMcp ? spl.replace("[MCP generated] ", "") : spl

  return (
    <div style={{ border: "1px solid var(--border-0)", borderRadius: 6, overflow: "hidden", background: "var(--bg-1)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 11px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-0)" }}>{label}</span>
          {isMcp && (
            <span style={{
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 3,
              background: "var(--purple-bg)",
              border: "1px solid var(--purple-border)",
              color: "var(--purple-text)",
              fontWeight: 500,
            }}>MCP</span>
          )}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--text-2)" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: "8px 11px 10px", borderTop: "1px solid var(--border-0)", display: "flex", flexDirection: "column", gap: 8, background: "var(--bg-0)" }}>
          <p style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.55 }}>{finding}</p>
          {spl && (
            <div>
              <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4, fontWeight: 500 }}>SPL Query</p>
              <pre style={{
                fontSize: 11,
                color: "var(--blue-text)",
                background: "var(--bg-1)",
                border: "1px solid var(--border-0)",
                borderRadius: 4,
                padding: "7px 10px",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                lineHeight: 1.5,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{displaySpl}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
