import { useState } from "react"

export function ThinkingStep({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: "1px solid var(--border-0)", borderRadius: 5, overflow: "hidden", marginBottom: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          background: "var(--bg-1)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--text-2)" }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 11, color: "var(--blue-text)", fontWeight: 500 }}>Searching Splunk</span>
      </button>
      {open && (
        <pre style={{
          margin: 0,
          padding: "7px 10px",
          fontSize: 11,
          color: "var(--blue-text)",
          background: "var(--bg-0)",
          fontFamily: "'JetBrains Mono', monospace",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          lineHeight: 1.5,
          borderTop: "1px solid var(--border-0)",
        }}>
          {query}
        </pre>
      )}
    </div>
  )
}
