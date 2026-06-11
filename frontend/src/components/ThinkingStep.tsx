import { useState } from "react"

export function ThinkingStep({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-700 rounded text-xs mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-2 py-1 text-gray-500 hover:text-gray-300 flex items-center gap-1"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span className="font-mono truncate">[Searching Splunk]</span>
      </button>
      {open && (
        <div className="px-2 pb-2 font-mono text-gray-400 whitespace-pre-wrap">{query}</div>
      )}
    </div>
  )
}
