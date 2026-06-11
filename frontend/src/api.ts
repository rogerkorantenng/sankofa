import type { AlertDetail } from "./types"

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
