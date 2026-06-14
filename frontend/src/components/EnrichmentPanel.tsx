import { useState } from "react"
import type { ThreatIntel } from "../types"

function isMalicious(intel: ThreatIntel) {
  return intel.reputation_score > 50 || intel.abuse_reports > 10
}

export function EnrichmentPanel({ intel }: { intel: ThreatIntel }) {
  const malicious = isMalicious(intel)
  const [open, setOpen] = useState(malicious)

  return (
    <div style={{
      border: `1px solid ${malicious ? "var(--critical-border)" : "var(--border-0)"}`,
      borderRadius: 6,
      overflow: "hidden",
      background: malicious ? "var(--critical-bg)" : "var(--bg-1)",
    }}>
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: malicious ? "var(--critical-text)" : "var(--text-0)" }}>
            Threat Intelligence
          </span>
          {intel.is_tor_exit && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--critical-bg)", border: "1px solid var(--critical-border)", color: "var(--critical-text)", fontWeight: 500 }}>
              Tor Exit
            </span>
          )}
          <span style={{ fontSize: 11, color: malicious ? "var(--critical)" : "var(--green)", fontWeight: 500 }}>
            {malicious ? `Score ${intel.reputation_score}/100` : "Clean"}
          </span>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--text-2)" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{ padding: "8px 11px 10px", borderTop: `1px solid ${malicious ? "var(--critical-border)" : "var(--border-0)"}`, background: "var(--bg-0)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Reputation", value: `${intel.reputation_score}/100`, highlight: intel.reputation_score > 50 },
              { label: "Abuse Reports", value: intel.abuse_reports, highlight: intel.abuse_reports > 10 },
              { label: "Country", value: intel.country || "Unknown", highlight: false },
              { label: "ASN", value: intel.asn || "Unknown", highlight: false },
            ].map(m => (
              <div key={m.label} style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 5, padding: "6px 9px" }}>
                <p style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 500, marginBottom: 2 }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: m.highlight ? "var(--critical)" : "var(--text-0)" }}>{m.value}</p>
              </div>
            ))}
          </div>
          {intel.known_malware.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 500, marginBottom: 5 }}>Malware Families</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {intel.known_malware.map((m, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--critical-bg)", border: "1px solid var(--critical-border)", color: "var(--critical-text)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
          {intel.sources.length > 0 && (
            <p style={{ fontSize: 11, color: "var(--text-2)" }}>Sources: {intel.sources.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  )
}
