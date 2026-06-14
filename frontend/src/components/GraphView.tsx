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

const SEVERITY_BG: Record<string, string> = {
  critical: "#FEF2F2",
  high:     "#FFF7ED",
  medium:   "#FFFBEB",
  low:      "#F9FAFB",
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  nodeType: "ip" | "host"
  severity: string
  alertIds: string[]
  // fixed position for attacker node
  isAttacker?: boolean
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  alertId: string
}

const SEV_ORDER = ["low", "medium", "high", "critical"]

function buildGraph(alerts: Alert[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeMap = new Map<string, GraphNode>()
  const linkSet = new Set<string>()
  const links: GraphLink[] = []

  // Count how many alerts each IP appears in — the one with the most is the attacker
  const ipCount = new Map<string, number>()
  for (const alert of alerts) {
    const ip = alert.source_ip || "external"
    ipCount.set(ip, (ipCount.get(ip) || 0) + 1)
  }
  const attackerIp = [...ipCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  for (const alert of alerts) {
    const ip = alert.source_ip || "external"
    const host = alert.affected_host || "unknown"

    if (!nodeMap.has(ip)) {
      nodeMap.set(ip, {
        id: ip, label: ip, nodeType: "ip", severity: alert.severity,
        alertIds: [alert.id], isAttacker: ip === attackerIp,
      })
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

function nodeRadius(d: GraphNode): number {
  if (d.isAttacker) return 22
  if (d.nodeType === "host") return 18
  return 14
}

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  const graphKey = useMemo(() => alerts.map(a => a.id).sort().join("|"), [alerts])

  useEffect(() => {
    const container = containerRef.current
    const svgEl = svgRef.current
    if (!container || !svgEl || !alerts.length) return

    const width = container.offsetWidth || 800
    const height = container.offsetHeight || 500

    simulationRef.current?.stop()

    const svg = d3.select(svgEl)
    svg.selectAll("*").remove()
    svg.attr("width", width).attr("height", height)

    const { nodes, links } = buildGraph(alerts)

    // Defs — shadow + arrowhead
    const defs = svg.append("defs")

    const shadow = defs.append("filter").attr("id", "shadow").attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%")
    shadow.append("feDropShadow").attr("dx", 0).attr("dy", 2).attr("stdDeviation", 3).attr("flood-color", "rgba(0,0,0,0.12)")

    const attackerShadow = defs.append("filter").attr("id", "attacker-shadow").attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%")
    attackerShadow.append("feDropShadow").attr("dx", 0).attr("dy", 3).attr("stdDeviation", 6).attr("flood-color", "rgba(220,38,38,0.3)")

    // Arrow marker for directed edges
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#D1D5DB")

    // Zoom container
    const g = svg.append("g")
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 5])
        .on("zoom", e => g.attr("transform", e.transform))
    )

    // Strong center force + bounds to keep nodes in view
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(d => {
        const src = d.source as GraphNode
        return src.isAttacker ? 160 : 120
      }))
      .force("charge", d3.forceManyBody().strength(d => (d as GraphNode).isAttacker ? -600 : -350))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.15))
      .force("collision", d3.forceCollide((d: GraphNode) => nodeRadius(d) + 20))
      .force("x", d3.forceX(width / 2).strength(0.06))
      .force("y", d3.forceY(height / 2).strength(0.06))
      .alphaDecay(0.06)
      .alphaMin(0.001)

    simulationRef.current = sim

    // Links — directed arrows
    const linkSel = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#E5E7EB")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)")

    // Node groups
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

    // Attacker IP: pulsing ring
    nodeSel.filter(d => !!d.isAttacker)
      .append("circle")
      .attr("r", 32)
      .attr("fill", "none")
      .attr("stroke", "#DC2626")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.2)
      .attr("stroke-dasharray", "4 3")

    // Host: outer ring
    nodeSel.filter(d => d.nodeType === "host" && !d.isAttacker)
      .append("circle")
      .attr("r", d => nodeRadius(d) + 7)
      .attr("fill", d => SEVERITY_BG[d.severity] || "#F9FAFB")
      .attr("stroke", d => SEVERITY_COLOR[d.severity] || "#9CA3AF")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)

    // Main circle
    nodeSel.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", d => SEVERITY_COLOR[d.severity] || "#9CA3AF")
      .attr("stroke", "#fff")
      .attr("stroke-width", d => d.isAttacker ? 3 : 2)
      .attr("filter", d => d.isAttacker ? "url(#attacker-shadow)" : "url(#shadow)")

    // Badge for multi-alert nodes
    nodeSel.filter(d => d.alertIds.length > 1)
      .append("circle")
      .attr("r", 8).attr("cx", d => nodeRadius(d) - 2).attr("cy", d => -nodeRadius(d) + 2)
      .attr("fill", "#2563EB").attr("stroke", "#fff").attr("stroke-width", 1.5)
    nodeSel.filter(d => d.alertIds.length > 1)
      .append("text")
      .text(d => String(d.alertIds.length))
      .attr("x", d => nodeRadius(d) - 2).attr("y", d => -nodeRadius(d) + 6)
      .attr("text-anchor", "middle")
      .attr("fill", "#fff").attr("font-size", "9px").attr("font-weight", "bold")
      .attr("pointer-events", "none")

    // Label below — with background pill for readability
    const labelG = nodeSel.append("g").attr("pointer-events", "none")

    labelG.append("text")
      .text(d => d.label.length > 16 ? d.label.slice(0, 14) + "…" : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", d => nodeRadius(d) + (d.nodeType === "host" ? 20 : 16))
      .attr("fill", d => d.isAttacker ? "#DC2626" : "#374151")
      .attr("font-size", d => d.isAttacker ? "11px" : "10px")
      .attr("font-weight", d => d.isAttacker ? "700" : "500")
      .attr("font-family", "Inter, sans-serif")

    // Node type tag — only for hosts (skip for IPs, too small)
    nodeSel.filter(d => d.nodeType === "host")
      .append("text")
      .text("HOST")
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", "#fff").attr("font-size", "7px").attr("font-weight", "700")
      .attr("font-family", "Inter, sans-serif").attr("letter-spacing", "0.06em")
      .attr("pointer-events", "none")

    // Attacker label tag
    nodeSel.filter(d => !!d.isAttacker)
      .append("text")
      .text("ATTACKER")
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", "#fff").attr("font-size", "7px").attr("font-weight", "700")
      .attr("font-family", "Inter, sans-serif").attr("letter-spacing", "0.06em")
      .attr("pointer-events", "none")

    sim.on("tick", () => {
      // Clamp nodes within bounds
      nodes.forEach(d => {
        const r = nodeRadius(d) + 10
        d.x = Math.max(r, Math.min(width - r, d.x ?? width / 2))
        d.y = Math.max(r, Math.min(height - r, d.y ?? height / 2))
      })

      linkSel
        .attr("x1", d => (d.source as GraphNode).x ?? 0)
        .attr("y1", d => (d.source as GraphNode).y ?? 0)
        .attr("x2", d => {
          const src = d.source as GraphNode
          const tgt = d.target as GraphNode
          const dx = (tgt.x ?? 0) - (src.x ?? 0)
          const dy = (tgt.y ?? 0) - (src.y ?? 0)
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          return (tgt.x ?? 0) - (dx / dist) * (nodeRadius(tgt) + 8)
        })
        .attr("y2", d => {
          const src = d.source as GraphNode
          const tgt = d.target as GraphNode
          const dx = (tgt.x ?? 0) - (src.x ?? 0)
          const dy = (tgt.y ?? 0) - (src.y ?? 0)
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          return (tgt.y ?? 0) - (dy / dist) * (nodeRadius(tgt) + 8)
        })

      nodeSel.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { sim.stop(); simulationRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey])

  if (!alerts.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-2)", border: "1px solid var(--border-0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><circle cx="9" cy="9" r="5"/><circle cx="15" cy="15" r="5"/></svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>No threat graph</p>
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>Click "Load Campaign" to visualize attack paths</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, background: "var(--bg-1)" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 10, alignItems: "center", pointerEvents: "none", flexWrap: "wrap" }}>
        {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
          <div key={sev} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }} />
            <span style={{ fontSize: 10, color: "var(--text-2)", textTransform: "capitalize" }}>{sev}</span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>· Scroll to zoom · Drag nodes · Click to investigate</span>
      </div>
    </div>
  )
}
