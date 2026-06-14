import { useState } from "react"

export function ThinkingStep({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: "1px solid rgba(0,212,255,0.15)",
      background: "rgba(0,212,255,0.03)",
      marginBottom: 4,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "4px 8px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 8, color: "var(--accent)", opacity: 0.7 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 8, color: "var(--accent)", letterSpacing: "0.08em", opacity: 0.8 }}>
          SPLUNK QUERY
        </span>
      </button>
      {open && (
        <pre style={{
          margin: 0,
          padding: "6px 10px",
          fontSize: 9,
          color: "#7BB8D4",
          fontFamily: "'JetBrains Mono', monospace",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          lineHeight: 1.5,
          borderTop: "1px solid rgba(0,212,255,0.1)",
        }}>
          {query}
        </pre>
      )}
    </div>
  )
}
