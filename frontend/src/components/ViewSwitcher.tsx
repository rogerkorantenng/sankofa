import { useSankofaStore } from "../store"

export function ViewSwitcher() {
  const { viewMode, setViewMode } = useSankofaStore()

  return (
    <div style={{
      display: "flex",
      background: "var(--bg-2)",
      borderRadius: 6,
      padding: 2,
      gap: 2,
    }}>
      {(["graph", "timeline"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            border: "none",
            background: viewMode === mode ? "var(--bg-0)" : "transparent",
            boxShadow: viewMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            color: viewMode === mode ? "var(--text-0)" : "var(--text-2)",
            fontSize: 12,
            fontWeight: viewMode === mode ? 500 : 400,
            cursor: "pointer",
            transition: "all 0.12s",
          }}
        >
          {mode === "graph" ? "Graph" : "Timeline"}
        </button>
      ))}
    </div>
  )
}
