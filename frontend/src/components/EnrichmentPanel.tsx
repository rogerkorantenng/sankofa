import { useState } from "react"
import type { ThreatIntel } from "../types"

function isMalicious(intel: ThreatIntel): boolean {
  return intel.reputation_score > 50 || intel.abuse_reports > 10
}

export function EnrichmentPanel({ intel }: { intel: ThreatIntel }) {
  const malicious = isMalicious(intel)
  const [open, setOpen] = useState(malicious)

  const accentColor = malicious ? "#FF2D3F" : "var(--green)"
  const accentBg = malicious ? "rgba(255,45,63,0.06)" : "rgba(0,232,135,0.04)"
  const accentBorder = malicious ? "rgba(255,45,63,0.25)" : "rgba(0,232,135,0.2)"

  return (
    <div style={{
      border: `1px solid ${accentBorder}`,
      background: accentBg,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 10px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 8, color: accentColor, letterSpacing: "0.12em", fontWeight: 700 }}>
            THREAT INTEL
          </span>
          {intel.is_tor_exit && (
            <span style={{
              fontSize: 7,
              padding: "1px 5px",
              background: "rgba(255,45,63,0.12)",
              border: "1px solid rgba(255,45,63,0.3)",
              color: "#FF2D3F",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}>TOR EXIT</span>
          )}
          <span style={{
            fontSize: 9,
            color: malicious ? "#FF2D3F" : "var(--green)",
            fontWeight: 700,
          }}>
            {malicious ? `MALICIOUS (${intel.reputation_score}/100)` : "CLEAN"}
          </span>
        </div>
        <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{
          padding: "8px 10px",
          borderTop: `1px solid ${accentBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          {/* Grid metrics */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: "var(--border)",
          }}>
            {[
              { label: "REPUTATION", value: `${intel.reputation_score}/100`, color: intel.reputation_score > 50 ? "#FF2D3F" : "var(--green)" },
              { label: "ABUSE REPORTS", value: intel.abuse_reports, color: intel.abuse_reports > 10 ? "#FF7A1A" : "var(--text-primary)" },
              { label: "COUNTRY", value: intel.country || "—", color: "var(--text-primary)" },
              { label: "ASN", value: intel.asn || "—", color: "var(--text-secondary)" },
            ].map((m) => (
              <div key={m.label} style={{ background: "var(--bg-base)", padding: "5px 8px" }}>
                <div style={{ fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 11, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: m.color }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {intel.known_malware.length > 0 && (
            <div>
              <div style={{ fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 5 }}>MALWARE FAMILIES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {intel.known_malware.map((m, i) => (
                  <span key={i} style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    background: "rgba(255,45,63,0.1)",
                    border: "1px solid rgba(255,45,63,0.25)",
                    color: "#FF7A7A",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intel.sources.length > 0 && (
            <p style={{ fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.06em", margin: 0 }}>
              Sources: {intel.sources.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
