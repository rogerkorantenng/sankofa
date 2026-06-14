# Sankofa v2 — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Graph View, Timeline View, Stats Bar, Global Action Log, Enrichment Panel, and Visual Runbook Builder to the Sankofa React frontend.

**Architecture:** New components slot into the existing Zustand store + Vite + Tailwind setup. D3 handles graph/timeline rendering. reactflow powers the runbook builder. New `/runbooks` page added to App.tsx router. Stats Bar is a fixed top banner; Action Log is a slide-in overlay panel.

**Tech Stack:** React 18, Vite, Tailwind CSS, Zustand, Framer Motion, D3 v7, reactflow, TypeScript.

**Prerequisite:** Plan A (backend) must be complete — this plan consumes `/stats`, `/actions`, `/runbooks`, and alert enrichment data from the API.

---

## File Structure

```
frontend/src/
├── types.ts                        # MODIFY: add ThreatIntel, ActionLog, Runbook, Stats types
├── api.ts                          # MODIFY: add fetchStats, fetchActions, runbook CRUD calls
├── store.ts                        # MODIFY: add viewMode, actionLogOpen, stats state
├── App.tsx                         # MODIFY: add /runbooks route, StatsBar, ActionLog, nav
├── components/
│   ├── StatsBar.tsx                # NEW: live stats top banner
│   ├── ViewSwitcher.tsx            # NEW: Graph/Timeline toggle
│   ├── GraphView.tsx               # NEW: D3 force-directed network
│   ├── TimelineView.tsx            # NEW: horizontal swimlane
│   ├── EnrichmentPanel.tsx         # NEW: threat intel cards, auto-expands
│   ├── ActionLog.tsx               # NEW: slide-in global action log
│   └── ReportCard.tsx              # MODIFY: add EnrichmentPanel section
└── pages/
    ├── Runbooks.tsx                # NEW: runbook management page
    └── RunbookBuilder.tsx          # NEW: reactflow visual editor
```

---

## Task 1: Install Dependencies + Update Types

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Install new npm packages**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npm install d3 @types/d3 reactflow
```

Expected: packages install without errors.

- [ ] **Step 2: Update `frontend/src/types.ts` — add v2 types**

Append to the bottom of the existing `types.ts`:

```ts
export interface ThreatIntel {
  ip: string
  reputation_score: number
  abuse_reports: number
  country: string
  asn: string
  known_malware: string[]
  is_tor_exit: boolean
  last_seen: string
  sources: string[]
  cached_at: string
}

export interface ActionLogEntry {
  id: string
  alert_id: string
  runbook_id: string | null
  action_type: string
  description: string
  risk_level: "low" | "high"
  status: "executed" | "pending_approval" | "approved" | "dismissed" | "failed"
  result: string | null
  executed_at: string | null
}

export interface RunbookStep {
  id: string
  type: "action" | "condition" | "notification"
  label: string
  action_type: string | null
  risk_level: "low" | "high"
  params: Record<string, string>
  next_on_success: string | null
  next_on_failure: string | null
}

export interface Runbook {
  id: string
  name: string
  trigger_conditions: Record<string, unknown>
  steps: RunbookStep[]
  created_at: string
}

export interface DashboardStats {
  critical: number
  high: number
  medium: number
  low: number
  avg_confidence: number
  actions_executed: number
  actions_pending: number
}
```

- [ ] **Step 3: Update `frontend/src/api.ts` — add v2 API calls**

Append to the bottom of `api.ts`:

```ts
import type { ActionLogEntry, Runbook, DashboardStats } from "./types"

export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch("/stats")
  if (!res.ok) throw new Error("Failed to fetch stats")
  return res.json()
}

export async function fetchActions(): Promise<ActionLogEntry[]> {
  const res = await fetch("/actions")
  if (!res.ok) throw new Error("Failed to fetch actions")
  return res.json()
}

export async function fetchRunbooks(): Promise<Runbook[]> {
  const res = await fetch("/runbooks")
  if (!res.ok) throw new Error("Failed to fetch runbooks")
  return res.json()
}

export async function createRunbook(data: {
  name: string
  trigger_conditions: Record<string, unknown>
  steps: unknown[]
}): Promise<{ id: string }> {
  const res = await fetch("/runbooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create runbook")
  return res.json()
}

export async function deleteRunbook(id: string): Promise<void> {
  const res = await fetch(`/runbooks/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete runbook")
}
```

- [ ] **Step 4: Update `frontend/src/store.ts` — add viewMode, actionLogOpen, stats**

```ts
import { create } from "zustand"
import type { Alert, AlertDetail, DashboardStats } from "./types"

type ViewMode = "graph" | "timeline"

interface SankofaStore {
  alerts: Alert[]
  selectedAlertId: string | null
  selectedAlert: AlertDetail | null
  wsConnected: boolean
  viewMode: ViewMode
  actionLogOpen: boolean
  stats: DashboardStats | null
  setAlerts: (alerts: Alert[]) => void
  setSelectedAlertId: (id: string | null) => void
  setSelectedAlert: (alert: AlertDetail | null) => void
  setWsConnected: (connected: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setActionLogOpen: (open: boolean) => void
  setStats: (stats: DashboardStats) => void
}

export const useSankofaStore = create<SankofaStore>((set) => ({
  alerts: [],
  selectedAlertId: null,
  selectedAlert: null,
  wsConnected: false,
  viewMode: "graph",
  actionLogOpen: false,
  stats: null,
  setAlerts: (alerts) => set({ alerts }),
  setSelectedAlertId: (id) => set({ selectedAlertId: id }),
  setSelectedAlert: (alert) => set({ selectedAlert: alert }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActionLogOpen: (open) => set({ actionLogOpen: open }),
  setStats: (stats) => set({ stats }),
}))
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/types.ts frontend/src/api.ts frontend/src/store.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: install d3 + reactflow, add v2 types, store state, and API calls"
```

---

## Task 2: Stats Bar

**Files:**
- Create: `frontend/src/components/StatsBar.tsx`

- [ ] **Step 1: Create `frontend/src/components/StatsBar.tsx`**

```tsx
import { useEffect } from "react"
import { useSankofaStore } from "../store"
import { fetchStats } from "../api"

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-gray-400",
}

export function StatsBar() {
  const { stats, setStats } = useSankofaStore()

  useEffect(() => {
    const load = () => fetchStats().then(setStats).catch(() => {})
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [setStats])

  if (!stats) return null

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900 border-b border-gray-700 text-xs font-mono overflow-x-auto whitespace-nowrap">
      {(["critical", "high", "medium", "low"] as const).map((sev) => (
        <span key={sev} className={`flex items-center gap-1 ${SEVERITY_COLORS[sev]}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
          {stats[sev]} {sev}
        </span>
      ))}
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">
        avg confidence <span className="text-blue-300">{stats.avg_confidence}%</span>
      </span>
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">
        <span className="text-green-400">{stats.actions_executed}</span> actions executed
      </span>
      {stats.actions_pending > 0 && (
        <>
          <span className="text-gray-600">|</span>
          <span className="text-yellow-400 animate-pulse">
            {stats.actions_pending} pending approval
          </span>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add StatsBar to `frontend/src/App.tsx`**

```tsx
import { AlertQueue } from "./components/AlertQueue"
import { InvestigationSidebar } from "./components/InvestigationSidebar"
import { StatsBar } from "./components/StatsBar"
import { useSankofaStore } from "./store"

export default function App() {
  const { wsConnected } = useSankofaStore()

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-mono overflow-hidden">
      <StatsBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-2/5 flex-shrink-0 flex flex-col overflow-hidden">
          <AlertQueue />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <InvestigationSidebar />
        </div>
      </div>
      <div className="fixed bottom-2 right-2 text-xs text-gray-600">
        {wsConnected ? "● live" : "○ connecting"}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/components/StatsBar.tsx frontend/src/App.tsx
git commit -m "feat: add StatsBar — live severity counts, confidence, action status"
```

---

## Task 3: Graph View (D3 Network Diagram)

**Files:**
- Create: `frontend/src/components/GraphView.tsx`
- Create: `frontend/src/components/ViewSwitcher.tsx`

- [ ] **Step 1: Create `frontend/src/components/GraphView.tsx`**

```tsx
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

interface GraphNode {
  id: string
  label: string
  type: "ip" | "host"
  severity: string
  alertId: string | null
  confidence: number
}

interface GraphLink {
  source: string
  target: string
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
        id: ip, label: ip, type: "ip",
        severity: alert.severity, alertId: alert.id,
        confidence: alert.confidence ?? 0,
      })
    } else {
      const existing = nodeMap.get(ip)!
      if (["critical", "high"].includes(alert.severity)) existing.severity = alert.severity
    }

    if (!nodeMap.has(host)) {
      nodeMap.set(host, {
        id: host, label: host, type: "host",
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

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: d3.SimulationNodeDatum) => (d as GraphNode).id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#374151")
      .attr("stroke-width", 1.5)

    const node = svg.append("g")
      .selectAll("g")
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
      .attr("r", (d) => d.type === "ip" ? 10 + d.confidence / 12 : 14)
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
        .attr("x1", (d) => (d.source as GraphNode & d3.SimulationNodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode & d3.SimulationNodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode & d3.SimulationNodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode & d3.SimulationNodeDatum).y ?? 0)

      node.attr("transform", (d) => {
        const n = d as GraphNode & d3.SimulationNodeDatum
        return `translate(${n.x ?? 0},${n.y ?? 0})`
      })
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
```

- [ ] **Step 2: Create `frontend/src/components/ViewSwitcher.tsx`**

```tsx
import { motion } from "framer-motion"
import { useSankofaStore } from "../store"

export function ViewSwitcher() {
  const { viewMode, setViewMode } = useSankofaStore()

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded p-0.5">
      <button
        onClick={() => setViewMode("graph")}
        title="Graph View"
        className={`px-2 py-1 rounded text-xs transition-colors ${
          viewMode === "graph"
            ? "bg-gray-600 text-white"
            : "text-gray-400 hover:text-white"
        }`}
      >
        ⬡ Graph
      </button>
      <button
        onClick={() => setViewMode("timeline")}
        title="Timeline View"
        className={`px-2 py-1 rounded text-xs transition-colors ${
          viewMode === "timeline"
            ? "bg-gray-600 text-white"
            : "text-gray-400 hover:text-white"
        }`}
      >
        ▶ Timeline
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/components/GraphView.tsx frontend/src/components/ViewSwitcher.tsx
git commit -m "feat: D3 graph view — force-directed network of IPs/hosts, severity-colored nodes"
```

---

## Task 4: Timeline View

**Files:**
- Create: `frontend/src/components/TimelineView.tsx`

- [ ] **Step 1: Create `frontend/src/components/TimelineView.tsx`**

```tsx
import { useSankofaStore } from "../store"
import type { Alert, SeverityLevel } from "../types"
import { SeverityBadge } from "./SeverityBadge"
import { fetchAlert } from "../api"

const SEVERITY_ORDER: SeverityLevel[] = ["critical", "high", "medium", "low"]

const SEVERITY_BG: Record<SeverityLevel, string> = {
  critical: "border-red-500/40 bg-red-950/20",
  high: "border-orange-500/40 bg-orange-950/20",
  medium: "border-yellow-500/40 bg-yellow-950/20",
  low: "border-gray-500/40 bg-gray-900/20",
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return ""
  }
}

export function TimelineView() {
  const { alerts, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  if (!alerts.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        No alerts to display. Click ▶ campaign to load data.
      </div>
    )
  }

  const bySeverity = SEVERITY_ORDER.reduce((acc, sev) => {
    acc[sev] = alerts.filter((a) => a.severity === sev)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return acc
  }, {} as Record<SeverityLevel, Alert[]>)

  async function handleClick(alert: Alert) {
    setSelectedAlertId(alert.id)
    const detail = await fetchAlert(alert.id)
    setSelectedAlert(detail)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-3">
      {SEVERITY_ORDER.map((sev) => (
        <div key={sev} className={`border rounded p-2 ${SEVERITY_BG[sev]}`}>
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={sev} />
            <span className="text-xs text-gray-500">{bySeverity[sev].length} alerts</span>
          </div>
          {bySeverity[sev].length === 0 ? (
            <p className="text-xs text-gray-600 italic pl-1">No alerts</p>
          ) : (
            <div className="flex items-start gap-2 overflow-x-auto pb-1">
              {bySeverity[sev].map((alert, i) => (
                <div key={alert.id} className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleClick(alert).catch(console.error)}
                    className="w-40 border border-gray-600 bg-gray-800 hover:bg-gray-700 rounded p-2 text-left transition-colors"
                  >
                    <p className="text-xs text-white truncate leading-tight">{alert.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatTime(alert.timestamp)}</p>
                    {alert.severity_score != null && (
                      <p className="text-xs text-gray-500">score: {alert.severity_score}/10</p>
                    )}
                  </button>
                  {i < bySeverity[sev].length - 1 && (
                    <span className="text-gray-600 text-xs flex-shrink-0">→</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/components/TimelineView.tsx
git commit -m "feat: timeline view — horizontal swimlane by severity with attack progression"
```

---

## Task 5: Wire Views into App + Alert Queue

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/AlertQueue.tsx`

- [ ] **Step 1: Update `frontend/src/App.tsx` — add view switcher and conditional rendering**

```tsx
import { AlertQueue } from "./components/AlertQueue"
import { InvestigationSidebar } from "./components/InvestigationSidebar"
import { StatsBar } from "./components/StatsBar"
import { GraphView } from "./components/GraphView"
import { TimelineView } from "./components/TimelineView"
import { ViewSwitcher } from "./components/ViewSwitcher"
import { ActionLog } from "./components/ActionLog"
import { useSankofaStore } from "./store"
import { motion, AnimatePresence } from "framer-motion"

export default function App() {
  const { wsConnected, viewMode, actionLogOpen, setActionLogOpen } = useSankofaStore()

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-mono overflow-hidden">
      <StatsBar />

      {/* Top nav */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
        <span className="text-xs font-bold text-white tracking-widest">SANKOFA</span>
        <div className="flex items-center gap-3">
          <ViewSwitcher />
          <a href="/runbooks" className="text-xs text-gray-400 hover:text-white transition-colors">
            Runbooks
          </a>
          <button
            onClick={() => setActionLogOpen(!actionLogOpen)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
            title="Action Log"
          >
            ⏱ Log
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Alert Queue (always visible) */}
        <div className="w-2/5 flex-shrink-0 flex flex-col overflow-hidden border-r border-gray-700">
          <AlertQueue />
        </div>

        {/* Right: View pane */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {viewMode === "graph" ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-hidden"
              >
                <GraphView />
              </motion.div>
            ) : (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-hidden"
              >
                <TimelineView />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Investigation sidebar overlays the view when an alert is selected */}
          <InvestigationSidebar />
        </div>

        {/* Global Action Log slide-in */}
        <ActionLog />
      </div>

      <div className="fixed bottom-2 right-2 text-xs text-gray-600">
        {wsConnected ? "● live" : "○ connecting"}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `frontend/src/components/InvestigationSidebar.tsx` — make it an overlay**

```tsx
import { motion, AnimatePresence } from "framer-motion"
import { useSankofaStore } from "../store"
import { ReportCard } from "./ReportCard"
import { ChatPanel } from "./ChatPanel"

export function InvestigationSidebar() {
  const { selectedAlert, setSelectedAlertId, setSelectedAlert } = useSankofaStore()

  return (
    <AnimatePresence>
      {selectedAlert && (
        <motion.div
          key="sidebar"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-3/5 flex flex-col bg-gray-950 border-l border-gray-700 z-20 shadow-2xl"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-xs text-gray-400">Investigation</span>
            <button
              onClick={() => { setSelectedAlertId(null); setSelectedAlert(null) }}
              className="text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: "55%" }}>
            <ReportCard alert={selectedAlert} />
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatPanel alertId={selectedAlert.id} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/App.tsx frontend/src/components/InvestigationSidebar.tsx
git commit -m "feat: wire Graph/Timeline views into App, investigation sidebar as slide-in overlay"
```

---

## Task 6: Enrichment Panel

**Files:**
- Create: `frontend/src/components/EnrichmentPanel.tsx`
- Modify: `frontend/src/components/ReportCard.tsx`
- Modify: `frontend/src/types.ts` (AlertDetail)

- [ ] **Step 1: Update `frontend/src/types.ts` — add enrichment to AlertDetail**

Add `threat_intel` field to `AlertDetail`:

```ts
export interface AlertDetail extends Alert {
  kill_chain: string[] | null
  containment_steps: string[] | null
  subagent_findings: Record<string, string> | null
  spl_queries: Record<string, string> | null
  report_completed_at: string | null
  threat_intel: ThreatIntel | null
}
```

- [ ] **Step 2: Update `backend/routes/alerts.py` — include enrichment data in `get_alert`**

In the `get_alert` route in `backend/routes/alerts.py`, after the existing JSON-parsing loop, add:

```python
        # Attach enrichment data if available
        if row.get("source_ip"):
            from database import get_threat_intel
            intel = await get_threat_intel(db, row["source_ip"])
            row["threat_intel"] = intel
        else:
            row["threat_intel"] = None
```

- [ ] **Step 3: Create `frontend/src/components/EnrichmentPanel.tsx`**

```tsx
import { useState } from "react"
import type { ThreatIntel } from "../types"

function isMalicious(intel: ThreatIntel): boolean {
  return intel.reputation_score > 50 || intel.abuse_reports > 10
}

export function EnrichmentPanel({ intel }: { intel: ThreatIntel }) {
  const malicious = isMalicious(intel)
  const [open, setOpen] = useState(malicious)

  return (
    <div className={`border rounded overflow-hidden ${malicious ? "border-red-800" : "border-gray-700"}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left ${
          malicious ? "bg-red-950/40 hover:bg-red-950/60" : "bg-gray-800 hover:bg-gray-700"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-200">Threat Intel</span>
          {intel.is_tor_exit && (
            <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded">Tor Exit</span>
          )}
          {malicious && (
            <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded">
              Score: {intel.reputation_score}
            </span>
          )}
          {!malicious && (
            <span className="text-xs text-green-500">✓ Clean</span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-3 py-2 bg-gray-900 space-y-1.5 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-gray-500">IP</span>
            <span className="text-gray-200 font-mono">{intel.ip}</span>
            <span className="text-gray-500">Reputation</span>
            <span className={intel.reputation_score > 50 ? "text-red-400" : "text-green-400"}>
              {intel.reputation_score}/100
            </span>
            <span className="text-gray-500">Abuse Reports</span>
            <span className={intel.abuse_reports > 10 ? "text-orange-400" : "text-gray-300"}>
              {intel.abuse_reports}
            </span>
            {intel.country && (
              <>
                <span className="text-gray-500">Country</span>
                <span className="text-gray-300">{intel.country}</span>
              </>
            )}
            {intel.asn && (
              <>
                <span className="text-gray-500">ASN</span>
                <span className="text-gray-300 font-mono">{intel.asn}</span>
              </>
            )}
          </div>
          {intel.known_malware.length > 0 && (
            <div>
              <p className="text-gray-500 mb-1">Known malware families:</p>
              <div className="flex flex-wrap gap-1">
                {intel.known_malware.map((m, i) => (
                  <span key={i} className="bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded text-xs font-mono">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
          {intel.sources.length > 0 && (
            <p className="text-gray-600">Sources: {intel.sources.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add EnrichmentPanel to `frontend/src/components/ReportCard.tsx`**

Add import at the top:

```tsx
import { EnrichmentPanel } from "./EnrichmentPanel"
```

Add `threat_intel` to the destructured props and render it after the summary:

```tsx
  const threatIntel = alert.threat_intel ?? null

  // After the summary paragraph and before status pulse:
  {threatIntel && <EnrichmentPanel intel={threatIntel} />}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/components/EnrichmentPanel.tsx frontend/src/components/ReportCard.tsx frontend/src/types.ts backend/routes/alerts.py
git commit -m "feat: enrichment panel — auto-expands for malicious IPs, shows reputation score + malware families"
```

---

## Task 7: Global Action Log

**Files:**
- Create: `frontend/src/components/ActionLog.tsx`

- [ ] **Step 1: Create `frontend/src/components/ActionLog.tsx`**

```tsx
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSankofaStore } from "../store"
import { fetchActions } from "../api"
import type { ActionLogEntry } from "../types"

const STATUS_COLORS: Record<string, string> = {
  executed: "text-green-400 bg-green-900/30",
  approved: "text-green-400 bg-green-900/30",
  pending_approval: "text-yellow-400 bg-yellow-900/30",
  dismissed: "text-gray-500 bg-gray-800",
  failed: "text-red-400 bg-red-900/30",
}

const STATUS_LABEL: Record<string, string> = {
  executed: "executed",
  approved: "approved",
  pending_approval: "pending",
  dismissed: "dismissed",
  failed: "failed",
}

function formatTime(ts: string | null): string {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return "—"
  }
}

export function ActionLog() {
  const { actionLogOpen, setActionLogOpen } = useSankofaStore()
  const [logs, setLogs] = useState<ActionLogEntry[]>([])

  useEffect(() => {
    if (!actionLogOpen) return
    fetchActions().then(setLogs).catch(() => {})
    const interval = setInterval(() => fetchActions().then(setLogs).catch(() => {}), 5000)
    return () => clearInterval(interval)
  }, [actionLogOpen])

  return (
    <AnimatePresence>
      {actionLogOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-30"
            onClick={() => setActionLogOpen(false)}
          />
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-700 z-40 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-white">Action Log</h2>
              <button
                onClick={() => setActionLogOpen(false)}
                className="text-gray-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-xs p-4">No actions yet. Triage some alerts first.</p>
              ) : (
                <ul className="divide-y divide-gray-800">
                  {logs.map((log) => (
                    <li key={log.id} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs text-gray-200 leading-tight flex-1">{log.description}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[log.status] ?? "text-gray-400"}`}>
                          {STATUS_LABEL[log.status] ?? log.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono">{log.action_type}</span>
                        <span>·</span>
                        <span>{formatTime(log.executed_at)}</span>
                        {log.risk_level === "high" && (
                          <>
                            <span>·</span>
                            <span className="text-orange-400">high-risk</span>
                          </>
                        )}
                      </div>
                      {log.result && (
                        <p className="text-xs text-gray-600 mt-0.5 truncate">{log.result}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/components/ActionLog.tsx
git commit -m "feat: global action log — slide-in panel showing all autonomous actions with status"
```

---

## Task 8: Visual Runbook Builder

**Files:**
- Create: `frontend/src/pages/Runbooks.tsx`
- Create: `frontend/src/pages/RunbookBuilder.tsx`

- [ ] **Step 1: Install reactflow (already done in Task 1 if not done yet)**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npm list reactflow 2>/dev/null | grep reactflow || npm install reactflow
```

- [ ] **Step 2: Create `frontend/src/pages/Runbooks.tsx`**

```tsx
import { useEffect, useState } from "react"
import { fetchRunbooks, deleteRunbook } from "../api"
import type { Runbook } from "../types"

export function RunbooksPage() {
  const [runbooks, setRunbooks] = useState<Runbook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRunbooks().then(setRunbooks).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await deleteRunbook(id)
    setRunbooks((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <a href="/" className="text-xs text-gray-500 hover:text-white mb-2 block">← Back to dashboard</a>
            <h1 className="text-xl font-bold text-white">Runbooks</h1>
            <p className="text-xs text-gray-400 mt-1">Automated response playbooks — define what Sankofa does when an alert fires</p>
          </div>
          <a
            href="/runbooks/new"
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded transition-colors"
          >
            + New Runbook
          </a>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : runbooks.length === 0 ? (
          <div className="border border-gray-700 rounded p-8 text-center">
            <p className="text-gray-400 text-sm mb-2">No runbooks yet.</p>
            <p className="text-gray-600 text-xs">Default runbooks are created automatically when the first alert is triaged.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runbooks.map((rb) => (
              <div key={rb.id} className="border border-gray-700 rounded p-4 bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white">{rb.name}</h3>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {(rb.trigger_conditions as { mitre_tactics?: string[]; severity?: string[] }).mitre_tactics?.map((t: string) => (
                        <span key={t} className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                      {(rb.trigger_conditions as { severity?: string[] }).severity?.map((s: string) => (
                        <span key={s} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{rb.steps.length} steps</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/runbooks/${rb.id}`}
                      className="text-xs text-gray-400 hover:text-white border border-gray-600 px-2 py-1 rounded transition-colors"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDelete(rb.id).catch(console.error)}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-2 py-1 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex gap-1 flex-wrap">
                  {rb.steps.map((step, i) => (
                    <span key={step.id} className="flex items-center gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        step.risk_level === "high"
                          ? "bg-orange-900/50 text-orange-300"
                          : "bg-gray-800 text-gray-300"
                      }`}>
                        {step.label}
                      </span>
                      {i < rb.steps.length - 1 && <span className="text-gray-600 text-xs">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/pages/RunbookBuilder.tsx`**

```tsx
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
  notification: "#4c1d95",
}

const initialNodes: Node[] = [
  {
    id: "trigger-1",
    type: "default",
    position: { x: 200, y: 50 },
    data: { label: "🎯 Alert Trigger\nTA0006 + high/critical" },
    style: { background: NODE_COLORS.trigger, color: "white", border: "1px solid #166534", fontSize: "11px", fontFamily: "monospace", borderRadius: "6px", padding: "8px 12px", whiteSpace: "pre-line" as const },
  },
]

export function RunbookBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
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
        style: { background: color, color: "white", border: `1px solid ${color}`, fontSize: "11px", fontFamily: "monospace", borderRadius: "6px", padding: "8px 12px" },
      },
    ])
  }

  async function handleSave() {
    setSaving(true)
    // Convert graph nodes/edges into sequential steps
    const actionNodes = nodes.filter((n) => n.id !== "trigger-1")
    const steps = actionNodes.map((n, i) => {
      const actionType = ACTION_TYPES.find((a) => n.data.label.includes(a.label))
      return {
        id: `step-${i + 1}`,
        type: "action",
        label: String(n.data.label).replace(/^[⚡🔒] /, ""),
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
```

- [ ] **Step 4: Update `frontend/src/main.tsx` — add basic client-side routing**

```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import { RunbooksPage } from "./pages/Runbooks"
import { RunbookBuilder } from "./pages/RunbookBuilder"

function Router() {
  const path = window.location.pathname
  if (path === "/runbooks") return <RunbooksPage />
  if (path === "/runbooks/new" || path.startsWith("/runbooks/")) return <RunbookBuilder />
  return <App />
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
)
```

- [ ] **Step 5: Verify TypeScript and build**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa/frontend
npx tsc --noEmit 2>&1
```

Expected: no errors.

```bash
npm run build 2>&1 | tail -6
```

Expected: `✓ built in ...`

- [ ] **Step 6: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/sankofa
git add frontend/src/pages/ frontend/src/main.tsx
git commit -m "feat: visual runbook builder — reactflow drag-drop editor with node types, /runbooks page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Graph View (D3 force-directed, severity colors, click to open sidebar) → Tasks 3, 5
- ✅ Timeline View (swimlane by severity, campaign progression) → Tasks 4, 5
- ✅ ViewSwitcher (toggle + Framer Motion transition) → Tasks 3, 5
- ✅ Stats Bar (live counts, avg confidence, actions) → Task 2
- ✅ Global Action Log (slide-in panel, status colors, polling) → Task 7
- ✅ EnrichmentPanel (auto-expands if malicious, reputation, malware families) → Task 6
- ✅ Visual Runbook Builder (reactflow, node types, save to API) → Task 8
- ✅ /runbooks page (list, delete, link to builder) → Task 8
- ✅ Investigation sidebar as slide-in overlay (not permanent split) → Task 5

**Type consistency:**
- `DashboardStats` fields (critical, high, medium, low, avg_confidence, actions_executed, actions_pending) match `get_stats()` backend return → ✅
- `ActionLogEntry.status` values match backend `ActionLogStatus` literal → ✅
- `ThreatIntel` fields match `enrichment.py` `ThreatIntel` model → ✅
- `AlertDetail.threat_intel` added in Task 6, backend provides it in `get_alert` → ✅

**No placeholders found.**
