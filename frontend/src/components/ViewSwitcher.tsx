import { useSankofaStore } from "../store"

export function ViewSwitcher() {
  const { viewMode, setViewMode } = useSankofaStore()

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded p-0.5">
      <button
        onClick={() => setViewMode("graph")}
        title="Graph View"
        className={`px-2 py-1 rounded text-xs transition-colors ${
          viewMode === "graph"
            ? "bg-gray-600 text-white"
            : "text-gray-400 hover:text-white"
        }`}
      >
        ⬡ Graph
      </button>
      <button
        onClick={() => setViewMode("timeline")}
        title="Timeline View"
        className={`px-2 py-1 rounded text-xs transition-colors ${
          viewMode === "timeline"
            ? "bg-gray-600 text-white"
            : "text-gray-400 hover:text-white"
        }`}
      >
        ▶ Timeline
      </button>
    </div>
  )
}
