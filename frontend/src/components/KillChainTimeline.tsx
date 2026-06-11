export function KillChainTimeline({ steps }: { steps: string[] }) {
  if (!steps.length) return null
  return (
    <div className="mt-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Kill Chain
      </h3>
      <ol className="relative border-l border-gray-600 ml-2">
        {steps.map((step, i) => (
          <li key={i} className="mb-3 ml-4">
            <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-gray-900" />
            <p className="text-xs text-gray-200">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
