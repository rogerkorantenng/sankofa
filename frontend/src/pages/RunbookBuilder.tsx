import { useCallback, useState } from "react"
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "reactflow"
import "reactflow/dist/style.css"
import { createRunbook } from "../api"

const ACTION_TYPES = [
  { value: "add_to_watchlist",  label: "Add to Watchlist",    risk: "low"  },
  { value: "create_splunk_alert", label: "Create Splunk Alert", risk: "low"  },
  { value: "slack_notify",      label: "Notify Slack",        risk: "low"  },
  { value: "block_ip",          label: "Block IP",            risk: "high" },
  { value: "isolate_host",      label: "Isolate Host",        risk: "high" },
]

const NODE_STYLES = {
  trigger: { background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8", fontSize: "12px", fontFamily: "Inter, sans-serif", borderRadius: "6px", padding: "8px 14px" },
  low:     { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", fontSize: "12px", fontFamily: "Inter, sans-serif", borderRadius: "6px", padding: "8px 14px" },
  high:    { background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", fontSize: "12px", fontFamily: "Inter, sans-serif", borderRadius: "6px", padding: "8px 14px" },
}

const initialNodes: Node[] = [
  {
    id: "trigger-1",
    type: "default",
    position: { x: 250, y: 40 },
    data: { label: "🎯 Alert Trigger" },
    style: NODE_STYLES.trigger,
  },
]

export function RunbookBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const [name, setName] = useState("New Runbook")
  const [mitreTactic, setMitreTactic] = useState("TA0006")
  const [severities, setSeverities] = useState<string[]>(["high", "critical"])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  )

  function addActionNode(actionType: string, risk: string) {
    const action = ACTION_TYPES.find(a => a.value === actionType)
    const id = `action-${Date.now()}`
    setNodes(nds => [
      ...nds,
      {
        id,
        type: "default",
        position: { x: 100 + Math.random() * 300, y: 150 + nds.length * 90 },
        data: { label: action?.label ?? actionType },
        style: risk === "high" ? NODE_STYLES.high : NODE_STYLES.low,
      },
    ])
  }

  async function handleSave() {
    setSaving(true)
    const actionNodes = nodes.filter(n => n.id !== "trigger-1")
    const steps = actionNodes.map((n, i) => {
      const label = String(n.data.label)
      const actionType = ACTION_TYPES.find(a => a.label === label)
      return {
        id: `step-${i + 1}`,
        type: "action",
        label,
        action_type: actionType?.value ?? "slack_notify",
        risk_level: actionType?.risk ?? "low",
        params: {},
        next_on_success: i < actionNodes.length - 1 ? `step-${i + 2}` : null,
        next_on_failure: null,
      }
    })
    try {
      await createRunbook({
        name,
        trigger_conditions: { mitre_tactics: [mitreTactic], severity: severities },
        steps,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-1)", fontFamily: "Inter, sans-serif" }}>
      {/* Nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 52,
        background: "var(--bg-0)", borderBottom: "1px solid var(--border-0)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>S</div>
          <a href="/runbooks" style={{ fontSize: 13, color: "var(--text-1)", textDecoration: "none" }}>Runbooks</a>
          <span style={{ color: "var(--text-3)" }}>/</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              background: "transparent", border: "none", fontSize: 14, fontWeight: 600,
              color: "var(--text-0)", outline: "none", minWidth: 180,
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Trigger config */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderLeft: "1px solid var(--border-0)", borderRight: "1px solid var(--border-0)" }}>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>Trigger:</span>
            <input
              value={mitreTactic}
              onChange={e => setMitreTactic(e.target.value)}
              style={{ width: 80, padding: "4px 8px", border: "1px solid var(--border-0)", borderRadius: 5, fontSize: 12, background: "var(--bg-1)", color: "var(--text-0)", outline: "none" }}
            />
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>Severity:</span>
            {["low", "medium", "high", "critical"].map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={severities.includes(s)}
                  onChange={e => setSeverities(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))}
                />
                <span style={{ fontSize: 12, color: "var(--text-1)", textTransform: "capitalize" }}>{s}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "7px 16px", borderRadius: 6, border: "none",
              background: saved ? "var(--green)" : "var(--blue)",
              color: "#fff", fontSize: 13, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, transition: "all 0.15s",
            }}
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Runbook"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 20px", borderBottom: "1px solid var(--border-0)",
        background: "var(--bg-0)", flexShrink: 0, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-2)", marginRight: 4 }}>Add step:</span>
        {ACTION_TYPES.map(a => (
          <button
            key={a.value}
            onClick={() => addActionNode(a.value, a.risk)}
            style={{
              padding: "4px 12px", borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.1s",
              border: `1px solid ${a.risk === "high" ? "var(--high-border)" : "var(--border-0)"}`,
              background: a.risk === "high" ? "var(--high-bg)" : "var(--bg-1)",
              color: a.risk === "high" ? "var(--high-text)" : "var(--text-1)",
            }}
          >
            {a.risk === "high" ? "⚠ " : ""}{a.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background color="#E5E7EB" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
