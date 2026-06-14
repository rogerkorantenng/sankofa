import type { AlertDetail, ActionDecision, ActionLogEntry, Runbook, DashboardStats } from "./types"

export async function fetchAlert(id: string): Promise<AlertDetail> {
  const res = await fetch(`/alerts/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch alert ${id}`)
  return res.json()
}

export async function seedAlerts(): Promise<{ seeded: number }> {
  const res = await fetch(`/alerts/seed`, { method: "POST" })
  if (!res.ok) throw new Error("Seed failed")
  return res.json()
}

export async function decideAction(
  alertId: string,
  actionIndex: number,
  actionText: string,
  status: "approved" | "dismissed"
): Promise<void> {
  const res = await fetch(`/alerts/${alertId}/actions/${actionIndex}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, action_text: actionText }),
  })
  if (!res.ok) throw new Error("Decision failed")
}

export async function getActions(alertId: string): Promise<ActionDecision[]> {
  const res = await fetch(`/alerts/${alertId}/actions`)
  if (!res.ok) throw new Error("Failed to fetch actions")
  return res.json()
}

export async function seedCampaign(): Promise<{ seeded: number }> {
  const res = await fetch(`/alerts/seed/campaign`, { method: "POST" })
  if (!res.ok) throw new Error("Campaign seed failed")
  return res.json()
}

export async function* streamChat(
  alertId: string,
  message: string
): AsyncGenerator<string> {
  const res = await fetch(`/alerts/${alertId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
  if (!res.ok || !res.body) throw new Error("Chat request failed")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6)
        if (payload === "[DONE]") return
        try {
          const parsed = JSON.parse(payload) as { text: string }
          yield parsed.text
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }
}

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
