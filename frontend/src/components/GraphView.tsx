import { useEffect, useRef, useState } from "react"
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
  confidence: number
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  alertId: string
}

function buildGraph(alerts: Alert[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeMap = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const SEVERITY_ORDER = ["low", "medium", "high", "critical"]

  for (const alert of alerts) {
    const ip = alert.source_ip || "external"
    const host = alert.affected_host || "unknown"

    if (!nodeMap.has(ip)) {
      nodeMap.set(ip, { id: ip, label: ip, nodeType: "ip", severity: alert.severity, alertIds: [alert.id], confidence: alert.confidence ?? 0 })
    } else {
      const n = nodeMap.get(ip)!
      if (!n.alertIds.includes(alert.id)) n.alertIds.push(alert.id)
      if (SEVERITY_ORDER.indexOf(alert.severity) > SEVERITY_ORDER.indexOf(n.severity)) n.severity = alert.severity
    }

    if (!nodeMap.has(host)) {
      nodeMap.set(host, { id: host, label: host, nodeType: "host", severity: alert.severity, alertIds: [alert.id], confidence: alert.confidence ?? 0 })
    } else {
      const n = nodeMap.get(host)!
      if (!n.alertIds.includes(alert.id)) n.alertIds.push(alert.id)
    }

    if (!links.some(l => l.source === ip && l.target === host)) {
      links.push({ source: ip, target: host, alertId: alert.id })
    }
  }

  return { nodes: Array.from(nodeMap.values()), links }
}

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  // Store dimensions in a ref — changes don't trigger simulation rebuild
  const dimensionsRef = useRef({ width: 0, height: 0 })
  const [ready, setReady] = useState(false)
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  // Measure once on mount, then just update SVG size on resize (no simulation restart)
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const changed = dimensionsRef.current.width !== rect.width || dimensionsRef.current.height !== rect.height
        dimensionsRef.current = { width: rect.width, height: rect.height }
        if (!ready) setReady(true)
        // Just resize the SVG — don't touch the simulation
        if (svgRef.current && changed) {
          d3.select(svgRef.current)
            .attr("width", rect.width)
            .attr("height", rect.height)
          // Recentre the force without restarting
          if (simulationRef.current) {
            simulationRef.current.force("center", d3.forceCenter(rect.width / 2, rect.height / 2))
          }
        }
      }
    }

    measure()
    const t1 = setTimeout(measure, 50)
    const t2 = setTimeout(measure, 200)

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => { observer.disconnect(); clearTimeout(t1); clearTimeout(t2) }
  }, [ready]) // only re-attach if ready flips; resize handler does NOT trigger simulation

  // Build / rebuild simulation ONLY when alerts change
  useEffect(() => {
    if (!svgRef.current || !alerts.length || !ready) return

    simulationRef.current?.stop()

    const { width, height } = dimensionsRef.current
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    svg.attr("width", width).attr("height", height)

    const { nodes, links } = buildGraph(alerts)

    const zoomG = svg.append("g").attr("class", "zoom-root")
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])
        .on("zoom", (e) => zoomG.attr("transform", e.transform))
    )

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-350))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(28))
      .alphaDecay(0.04)

    simulationRef.current = simulation

    // Links
    const link = zoomG.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#E5E7EB")
      .attr("stroke-width", 1.5)

    // Nodes
    const node = zoomG.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y })
          .on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
      )
      .on("click", (_e, d) => {
        const id = d.alertIds[0]
        if (id) { setSelectedAlertId(id); fetchAlert(id).then(setSelectedAlert).catch(() => {}) }
      })

    // Shadow for depth
    const defs = svg.append("defs")
    const filter = defs.append("filter").attr("id", "shadow").attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%")
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-color", "rgba(0,0,0,0.12)")

    // Node circle
    node.append("circle")
      .attr("r", d => d.nodeType === "ip" ? 14 : 18)
      .attr("fill", d => SEVERITY_COLOR[d.severity] || "#9CA3AF")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2.5)
      .attr("filter", "url(#shadow)")

    // Node type ring (host = double ring)
    node.filter(d => d.nodeType === "host")
      .append("circle")
      .attr("r", 22)
      .attr("fill", "none")
      .attr("stroke", d => SEVERITY_COLOR[d.severity] || "#9CA3AF")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)

    // Badge for multi-alert nodes
    node.filter(d => d.alertIds.length > 1)
      .append("circle")
      .attr("r", 7).attr("cx", 10).attr("cy", -10)
      .attr("fill", "#2563EB").attr("stroke", "#fff").attr("stroke-width", 1.5)
    node.filter(d => d.alertIds.length > 1)
      .append("text")
      .text(d => String(d.alertIds.length))
      .attr("x", 10).attr("y", -7)
      .attr("text-anchor", "middle")
      .attr("fill", "#fff").attr("font-size", "8px").attr("font-weight", "bold")

    // Label
    node.append("text")
      .text(d => d.label.length > 16 ? d.label.slice(0, 14) + "…" : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", d => (d.nodeType === "ip" ? 30 : 36))
      .attr("fill", "#374151")
      .attr("font-size", "10px")
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "500")

    // Severity label inside circle
    node.append("text")
      .text(d => d.nodeType === "ip" ? "IP" : "HOST")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff")
      .attr("font-size", "7px")
      .attr("font-weight", "700")
      .attr("font-family", "Inter, sans-serif")
      .attr("letter-spacing", "0.04em")
      .attr("pointer-events", "none")

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x ?? 0)
        .attr("y1", d => (d.source as GraphNode).y ?? 0)
        .attr("x2", d => (d.target as GraphNode).x ?? 0)
        .attr("y2", d => (d.target as GraphNode).y ?? 0)
      node.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { simulation.stop(); simulationRef.current = null }
  }, [alerts, ready, setSelectedAlertId, setSelectedAlert]) // NOT dimensions

  if (!alerts.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-2)", border: "1px solid var(--border-0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="16" cy="16" r="5"/><path d="M12 12l-1.5-1.5M12 12l1.5 1.5"/></svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>No threat graph</p>
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>Click "Load Campaign" to visualize attack paths</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, background: "var(--bg-1)" }}>
      {!ready ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)", fontSize: 12 }}>
          Initializing…
        </div>
      ) : (
        <svg ref={svgRef} style={{ display: "block" }} />
      )}
      {ready && (
        <div style={{
          position: "absolute", bottom: 12, left: 14,
          display: "flex", gap: 12, alignItems: "center",
        }}>
          {/* Legend */}
          {Object.entries(SEVERITY_COLOR).map(([sev, color]) => (
            <div key={sev} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
              <span style={{ fontSize: 10, color: "var(--text-2)", textTransform: "capitalize" }}>{sev}</span>
            </div>
          ))}
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>· Scroll to zoom · Drag nodes</span>
        </div>
      )}
    </div>
  )
}
