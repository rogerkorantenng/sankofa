import { useState } from "react"

const AGENT_LABELS: Record<string, string> = {
  auth:     "AUTH AGENT",
  network:  "NETWORK AGENT",
  endpoint: "ENDPOINT AGENT",
  lateral:  "LATERAL MOVEMENT",
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
    <div>
      <div className="section-divider" style={{ marginBottom: 8 }}>EVIDENCE TRAIL</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {agents.map((agent) => (
          <AgentEvidence
            key={agent}
            label={AGENT_LABELS[agent] ?? agent.toUpperCase()}
            finding={findings[agent]}
            spl={queries?.[agent] ?? ""}
          />
        ))}
      </div>
    </div>
  )
}

function AgentEvidence({ label, finding, spl }: { label: string; finding: string; spl: string }) {
  const [open, setOpen] = useState(false)
  const isMcp = spl.startsWith("[MCP generated]")
  const displaySpl = isMcp ? spl.replace("[MCP generated] ", "") : spl

  return (
    <div style={{
      border: "1px solid var(--border)",
      background: "var(--bg-elevated)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 8, color: "var(--text-secondary)", letterSpacing: "0.12em", fontWeight: 700 }}>
            {label}
          </span>
          {isMcp && (
            <span style={{
              fontSize: 7,
              padding: "1px 5px",
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#A78BFA",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}>
              MCP
            </span>
          )}
        </div>
        <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{
          padding: "8px 10px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <p style={{ fontSize: 10, color: "var(--text-primary)", lineHeight: 1.5, margin: 0 }}>
            {finding}
          </p>
          {spl && (
            <div>
              <div style={{ fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.12em", marginBottom: 4 }}>
                SPL QUERY
              </div>
              <pre style={{
                fontSize: 9,
                color: "#7BB8D4",
                fontFamily: "'JetBrains Mono', monospace",
                background: "var(--bg-base)",
                padding: "6px 8px",
                margin: 0,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                border: "1px solid var(--border)",
                lineHeight: 1.5,
              }}>
                {displaySpl}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
