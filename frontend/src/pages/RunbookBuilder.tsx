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
  { value: "add_to_watchlist", label: "Add to Watchlist", risk: "low" },
  { value: "create_splunk_alert", label: "Create Splunk Alert", risk: "low" },
  { value: "slack_notify", label: "Notify Slack", risk: "low" },
  { value: "block_ip", label: "Block IP", risk: "high" },
  { value: "isolate_host", label: "Isolate Host", risk: "high" },
]

const NODE_COLORS = {
  trigger: "#166534",
  action_low: "#1e3a5f",
  action_high: "#7c2d12",
}

const initialNodes: Node[] = [
  {
    id: "trigger-1",
    type: "default",
    position: { x: 200, y: 50 },
    data: { label: "🎯 Alert Trigger\nTA0006 + high/critical" },
    style: {
      background: NODE_COLORS.trigger, color: "white",
      border: "1px solid #166534", fontSize: "11px",
      fontFamily: "monospace", borderRadius: "6px",
      padding: "8px 12px", whiteSpace: "pre-line" as const,
    },
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
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  function addActionNode(actionType: string, risk: string) {
    const action = ACTION_TYPES.find((a) => a.value === actionType)
    const id = `action-${Date.now()}`
    const color = risk === "high" ? NODE_COLORS.action_high : NODE_COLORS.action_low
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "default",
        position: { x: 100 + Math.random() * 300, y: 150 + nds.length * 80 },
        data: { label: `${risk === "high" ? "🔒" : "⚡"} ${action?.label ?? actionType}` },
        style: {
          background: color, color: "white",
          border: `1px solid ${color}`, fontSize: "11px",
          fontFamily: "monospace", borderRadius: "6px", padding: "8px 12px",
        },
      },
    ])
  }

  async function handleSave() {
    setSaving(true)
    const actionNodes = nodes.filter((n) => n.id !== "trigger-1")
    const steps = actionNodes.map((n, i) => {
      const label = String(n.data.label).replace(/^[⚡🔒] /, "")
      const actionType = ACTION_TYPES.find((a) => a.label === label)
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
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <a href="/runbooks" className="text-xs text-gray-500 hover:text-white">← Runbooks</a>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent text-white text-sm font-semibold border-b border-gray-600 focus:border-blue-400 outline-none px-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Trigger:</span>
            <input
              value={mitreTactic}
              onChange={(e) => setMitreTactic(e.target.value)}
              className="bg-gray-800 text-white px-2 py-1 rounded w-24 text-xs"
              placeholder="TA0006"
            />
            <span>Severity:</span>
            {["low", "medium", "high", "critical"].map((s) => (
              <label key={s} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={severities.includes(s)}
                  onChange={(e) => {
                    setSeverities((prev) =>
                      e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)
                    )
                  }}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1.5 rounded transition-colors"
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Runbook"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700 flex-wrap">
        <span className="text-xs text-gray-500">Add step:</span>
        {ACTION_TYPES.map((a) => (
          <button
            key={a.value}
            onClick={() => addActionNode(a.value, a.risk)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              a.risk === "high"
                ? "border-orange-700 text-orange-300 hover:bg-orange-900/30"
                : "border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            {a.risk === "high" ? "🔒" : "⚡"} {a.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background color="#374151" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
