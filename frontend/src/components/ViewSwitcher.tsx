import { useSankofaStore } from "../store"

export function ViewSwitcher() {
  const { viewMode, setViewMode } = useSankofaStore()

  return (
    <div style={{
      display: "flex",
      border: "1px solid var(--border)",
      overflow: "hidden",
    }}>
      {(["graph", "timeline"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          style={{
            padding: "3px 10px",
            fontSize: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: viewMode === mode ? 700 : 400,
            letterSpacing: "0.12em",
            background: viewMode === mode ? "rgba(0,212,255,0.12)" : "transparent",
            color: viewMode === mode ? "var(--accent)" : "var(--text-secondary)",
            borderRight: mode === "graph" ? "1px solid var(--border)" : "none",
            cursor: "pointer",
            transition: "all 0.12s",
          }}
          onMouseEnter={e => { if (viewMode !== mode) (e.currentTarget as HTMLElement).style.color = "var(--text-primary)" }}
          onMouseLeave={e => { if (viewMode !== mode) (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)" }}
        >
          {mode === "graph" ? "⬡ GRAPH" : "▶ TIMELINE"}
        </button>
      ))}
    </div>
  )
}
