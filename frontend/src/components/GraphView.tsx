import { useEffect, useMemo, useRef } from "react"
import * as d3 from "d3"
import type { Alert } from "../types"
import { useSankofaStore } from "../store"
import { fetchAlert } from "../api"

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#DC2626",
  high:     "#EA580C",
  medium:   "#D97706",
  low:      "#9CA3AF",
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  nodeType: "ip" | "host"
  severity: string
  alertIds: string[]
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  alertId: string
}

const SEV_ORDER = ["low", "medium", "high", "critical"]

function buildGraph(alerts: Alert[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeMap = new Map<string, GraphNode>()
  const linkSet = new Set<string>()
  const links: GraphLink[] = []

  for (const alert of alerts) {
    const ip = alert.source_ip || "external"
    const host = alert.affected_host || "unknown"

    if (!nodeMap.has(ip)) {
      nodeMap.set(ip, { id: ip, label: ip, nodeType: "ip", severity: alert.severity, alertIds: [alert.id] })
    } else {
      const n = nodeMap.get(ip)!
      if (!n.alertIds.includes(alert.id)) n.alertIds.push(alert.id)
      if (SEV_ORDER.indexOf(alert.severity) > SEV_ORDER.indexOf(n.severity)) n.severity = alert.severity
    }

    if (!nodeMap.has(host)) {
      nodeMap.set(host, { id: host, label: host, nodeType: "host", severity: alert.severity, alertIds: [alert.id] })
    } else {
      const n = nodeMap.get(host)!
      if (!n.alertIds.includes(alert.id)) n.alertIds.push(alert.id)
    }

    const edgeKey = `${ip}→${host}`
    if (!linkSet.has(edgeKey)) {
      linkSet.add(edgeKey)
      links.push({ source: ip, target: host, alertId: alert.id })
    }
  }

  return { nodes: Array.from(nodeMap.values()), links }
}

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  // Stable key: only changes when alert IDs change, not on status/score updates
  const graphKey = useMemo(
    () => alerts.map(a => a.id).sort().join("|"),
    [alerts]
  )

  // Build graph — only when graphKey changes
  useEffect(() => {
    const container = containerRef.current
    const svgEl = svgRef.current
    if (!container || !svgEl || !alerts.length) return

    // Get real dimensions
    const rect = container.getBoundingClientRect()
    const width = rect.width || container.offsetWidth || 800
    const height = rect.height || container.offsetHeight || 500

    simulationRef.current?.stop()

    const svg = d3.select(svgEl)
    svg.selectAll("*").remove()
    svg.attr("width", width).attr("height", height)

    const { nodes, links } = buildGraph(alerts)

    // Defs
    const defs = svg.append("defs")
    const filter = defs.append("filter").attr("id", "node-shadow")
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-color", "rgba(0,0,0,0.15)")

    // Zoom container
    const g = svg.append("g")
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 5])
        .on("zoom", e => g.attr("transform", e.transform))
    )

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(140))
      .force("charge", d3.forceManyBody().strength(-450))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(34))
      .alphaDecay(0.07)
      .alphaMin(0.001)

    simulationRef.current = sim

    const linkSel = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#D1D5DB")
      .attr("stroke-width", 1.5)

    const nodeSel = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y })
          .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )
      .on("click", (_e, d) => {
        const id = d.alertIds[0]
        if (id) { setSelectedAlertId(id); fetchAlert(id).then(setSelectedAlert).catch(() => {}) }
      })

    // Host outer ring
    nodeSel.filter(d => d.nodeType === "host")
      .append("circle")
      .attr("r", 24)
      .attr("fill", "none")
      .attr("stroke", d => SEVERITY_COLOR[d.severity] || "#9CA3AF")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.25)

    // Main circle
    nodeSel.append("circle")
      .attr("r", d => d.nodeType === "ip" ? 14 : 18)
      .attr("fill", d => SEVERITY_COLOR[d.severity] || "#9CA3AF")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2.5)
      .attr("filter", "url(#node-shadow)")

    // Badge for multi-alert nodes
    nodeSel.filter(d => d.alertIds.length > 1)
      .append("circle")
      .attr("r", 7).attr("cx", 11).attr("cy", -11)
      .attr("fill", "#2563EB").attr("stroke", "#fff").attr("stroke-width", 1.5)
    nodeSel.filter(d => d.alertIds.length > 1)
      .append("text")
      .text(d => String(d.alertIds.length))
      .attr("x", 11).attr("y", -8)
      .attr("text-anchor", "middle")
      .attr("fill", "#fff").attr("font-size", "8px").attr("font-weight", "bold")
      .attr("pointer-events", "none")

    // Type label inside node
    nodeSel.append("text")
      .text(d => d.nodeType === "ip" ? "IP" : "HOST")
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", "#fff").attr("font-size", "7px").attr("font-weight", "700")
      .attr("font-family", "Inter, sans-serif").attr("letter-spacing", "0.05em")
      .attr("pointer-events", "none")

    // Label below
    nodeSel.append("text")
      .text(d => d.label.length > 17 ? d.label.slice(0, 15) + "…" : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", d => d.nodeType === "ip" ? 30 : 38)
      .attr("fill", "#374151").attr("font-size", "10px")
      .attr("font-family", "Inter, sans-serif").attr("font-weight", "500")
      .attr("pointer-events", "none")

    sim.on("tick", () => {
      linkSel
        .attr("x1", d => (d.source as GraphNode).x ?? 0)
        .attr("y1", d => (d.source as GraphNode).y ?? 0)
        .attr("x2", d => (d.target as GraphNode).x ?? 0)
        .attr("y2", d => (d.target as GraphNode).y ?? 0)
      nodeSel.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { sim.stop(); simulationRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]) // only when IDs change

  if (!alerts.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-2)", border: "1px solid var(--border-0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
            <circle cx="9" cy="9" r="5"/><circle cx="15" cy="15" r="5"/>
            <path d="M13 9h1m-1 2h1M9 13v1m2-1v1" stroke="var(--text-3)" strokeWidth="1"/>
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>No threat graph</p>
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>Click "Load Campaign" to visualize attack paths</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, background: "var(--bg-1)" }}
    >
      <svg ref={svgRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 12, alignItems: "center", pointerEvents: "none" }}>
        {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
          <div key={sev} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
            <span style={{ fontSize: 10, color: "var(--text-2)", textTransform: "capitalize" }}>{sev}</span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>· Scroll to zoom · Drag nodes</span>
      </div>
    </div>
  )
}
