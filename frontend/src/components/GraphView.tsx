import { useEffect, useRef } from "react"
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
  alertId: string | null
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
        severity: alert.severity, alertId: alert.id,
        confidence: alert.confidence ?? 0,
      })
    } else {
      const existing = nodeMap.get(ip)!
      if (["critical", "high"].includes(alert.severity)) existing.severity = alert.severity
    }

    if (!nodeMap.has(host)) {
      nodeMap.set(host, {
        id: host, label: host, nodeType: "host",
        severity: alert.severity, alertId: alert.id,
        confidence: alert.confidence ?? 0,
      })
    }

    links.push({ source: ip, target: host, alertId: alert.id })
  }

  return { nodes: Array.from(nodeMap.values()), links }
}

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  useEffect(() => {
    if (!svgRef.current || !alerts.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth || 800
    const height = svgRef.current.clientHeight || 500
    const { nodes, links } = buildGraph(alerts)

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#374151")
      .attr("stroke-width", 1.5)

    const node = svg.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        if (d.alertId) {
          setSelectedAlertId(d.alertId)
          fetchAlert(d.alertId).then(setSelectedAlert).catch(() => {})
        }
      })

    node.append("circle")
      .attr("r", (d) => d.nodeType === "ip" ? 10 + d.confidence / 12 : 14)
      .attr("fill", (d) => SEVERITY_COLOR[d.severity] || "#6B7280")
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2)

    node.append("text")
      .text((d) => d.label.length > 15 ? d.label.slice(0, 13) + "…" : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", 24)
      .attr("fill", "#D1D5DB")
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

    return () => { simulation.stop() }
  }, [alerts, setSelectedAlertId, setSelectedAlert])

  if (!alerts.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No alerts to visualize. Click ▶ campaign to load data.
      </div>
    )
  }

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-gray-950"
      style={{ minHeight: "400px" }}
    />
  )
}
