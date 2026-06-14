export function KillChainTimeline({ steps }: { steps: string[] }) {
  if (!steps.length) return null
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 3 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--blue)",
              border: "2px solid var(--blue-bg)",
              flexShrink: 0,
            }} />
            {i < steps.length - 1 && (
              <div style={{ width: 1, height: 18, background: "var(--border-1)", marginTop: 2 }} />
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.45, paddingBottom: i < steps.length - 1 ? 10 : 0 }}>
            {step}
          </p>
        </div>
      ))}
    </div>
  )
}
