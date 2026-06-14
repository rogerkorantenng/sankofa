import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import type { Alert } from "../types"
import { useSankofaStore } from "../store"
import { fetchAlert } from "../api"

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#6B7280",
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

  for (const alert of alerts) {
    const ip = alert.source_ip || "unknown"
    const host = alert.affected_host || "unknown"

    if (!nodeMap.has(ip)) {
      nodeMap.set(ip, {
        id: ip, label: ip, nodeType: "ip",
        severity: alert.severity, alertIds: [alert.id],
        confidence: alert.confidence ?? 0,
      })
    } else {
      const existing = nodeMap.get(ip)!
      if (!existing.alertIds.includes(alert.id)) existing.alertIds.push(alert.id)
      // Escalate severity to the worst seen
      const order = ["low", "medium", "high", "critical"]
      if (order.indexOf(alert.severity) > order.indexOf(existing.severity)) {
        existing.severity = alert.severity
      }
    }

    if (!nodeMap.has(host)) {
      nodeMap.set(host, {
        id: host, label: host, nodeType: "host",
        severity: alert.severity, alertIds: [alert.id],
        confidence: alert.confidence ?? 0,
      })
    } else {
      const existing = nodeMap.get(host)!
      if (!existing.alertIds.includes(alert.id)) existing.alertIds.push(alert.id)
    }

    // Avoid duplicate links between same ip→host pair
    const alreadyLinked = links.some(
      (l) => l.source === ip && l.target === host
    )
    if (!alreadyLinked) {
      links.push({ source: ip, target: host, alertId: alert.id })
    }
  }

  return { nodes: Array.from(nodeMap.values()), links }
}

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  // Measure container after layout with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Rebuild graph when alerts or dimensions change
  useEffect(() => {
    if (!svgRef.current || !alerts.length || dimensions.width === 0) return

    // Stop any existing simulation
    simulationRef.current?.stop()

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const { width, height } = dimensions
    const { nodes, links } = buildGraph(alerts)

    // Add zoom behaviour
    const zoomG = svg.append("g")
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => {
          zoomG.attr("transform", event.transform)
        })
    )

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(140))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(30))

    simulationRef.current = simulation

    const link = zoomG.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#4B5563")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 2")

    const node = zoomG.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )
      .on("click", (_event, d) => {
        // If multiple alerts for this node, open the highest-severity one
        const alertId = d.alertIds[0]
        if (alertId) {
          setSelectedAlertId(alertId)
          fetchAlert(alertId).then(setSelectedAlert).catch(() => {})
        }
      })

    // Node body
    node.append("circle")
      .attr("r", (d) => d.nodeType === "ip" ? 12 : 16)
      .attr("fill", (d) => SEVERITY_COLOR[d.severity] || "#6B7280")
      .attr("fill-opacity", 0.9)
      .attr("stroke", "#111827")
      .attr("stroke-width", 2)

    // Alert count badge for nodes with multiple alerts
    node.filter((d) => d.alertIds.length > 1)
      .append("circle")
      .attr("r", 7)
      .attr("cx", 10)
      .attr("cy", -10)
      .attr("fill", "#1D4ED8")
      .attr("stroke", "#111827")
      .attr("stroke-width", 1)

    node.filter((d) => d.alertIds.length > 1)
      .append("text")
      .text((d) => String(d.alertIds.length))
      .attr("x", 10)
      .attr("y", -7)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "8px")
      .attr("font-weight", "bold")

    // Node type icon
    node.append("text")
      .text((d) => d.nodeType === "ip" ? "⬡" : "▣")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "white")
      .attr("font-size", d => d.nodeType === "ip" ? "10px" : "12px")

    // Label below node
    node.append("text")
      .text((d) => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.nodeType === "ip" ? 28 : 32)
      .attr("fill", "#9CA3AF")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0)

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
      simulationRef.current = null
    }
  }, [alerts, dimensions, setSelectedAlertId, setSelectedAlert])

  if (!alerts.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No alerts to visualize. Click ▶ campaign to load data.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-950 relative">
      {dimensions.width === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-600 text-xs">
          Rendering graph…
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block"
        />
      )}
      <div className="absolute bottom-2 left-2 text-xs text-gray-600">
        Scroll to zoom · Drag nodes · Click to investigate
      </div>
    </div>
  )
}
