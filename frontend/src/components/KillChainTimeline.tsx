export function KillChainTimeline({ steps }: { steps: string[] }) {
  if (!steps.length) return null
  return (
    <div>
      <div className="section-divider" style={{ marginBottom: 10 }}>KILL CHAIN</div>
      <div style={{ position: "relative", paddingLeft: 20 }}>
        {/* Vertical line */}
        <div style={{
          position: "absolute",
          left: 6,
          top: 8,
          bottom: 8,
          width: 1,
          background: "linear-gradient(to bottom, var(--accent), transparent)",
          opacity: 0.4,
        }} />
        {steps.map((step, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: i < steps.length - 1 ? 10 : 0,
            position: "relative",
          }}>
            {/* Node */}
            <div style={{
              position: "absolute",
              left: -14,
              top: 4,
              width: 7,
              height: 7,
              border: "1px solid var(--accent)",
              background: "var(--bg-base)",
              transform: "rotate(45deg)",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10,
              color: "var(--text-primary)",
              lineHeight: 1.4,
            }}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
