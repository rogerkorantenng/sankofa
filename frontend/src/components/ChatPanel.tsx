import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { streamChat } from "../api"
import { ThinkingStep } from "./ThinkingStep"

interface Message { role: "user" | "assistant"; content: string }

function parseMessageParts(content: string): Array<{ type: "text" | "search"; value: string }> {
  const parts: Array<{ type: "text" | "search"; value: string }> = []
  let last = 0
  const re = /\[Searching Splunk: ([^\]]+)\]/g
  let match
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: content.slice(last, match.index) })
    parts.push({ type: "search", value: match[1] })
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push({ type: "text", value: content.slice(last) })
  return parts
}

export function ChatPanel({ alertId }: { alertId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMessages([]); setInput(""); setStreaming(false) }, [alertId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function send() {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMsg }])
    setStreaming(true)
    let acc = ""
    setMessages(prev => [...prev, { role: "assistant", content: "" }])
    try {
      for await (const chunk of streamChat(alertId, userMsg)) {
        acc += chunk
        setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: acc }])
      }
    } catch (e) { console.error(e) }
    finally { setStreaming(false) }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-0)" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--text-2)" }}>Ask a follow-up question about this alert</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "user" ? (
              <div style={{
                maxWidth: "80%",
                padding: "7px 12px",
                borderRadius: 8,
                borderBottomRightRadius: 2,
                background: "var(--blue)",
                color: "#fff",
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {msg.content}
              </div>
            ) : (
              <div style={{ maxWidth: "92%", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <div style={{
                    width: 18, height: 18,
                    borderRadius: "50%",
                    background: "var(--blue-bg)",
                    border: "1px solid var(--blue-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, color: "var(--blue)", fontWeight: 700,
                  }}>AI</div>
                  <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 500 }}>Analyst</span>
                </div>
                {parseMessageParts(msg.content).map((part, j) =>
                  part.type === "search" ? (
                    <ThinkingStep key={j} query={part.value} />
                  ) : (
                    <div key={j} style={{ fontSize: 13, color: "var(--text-0)", lineHeight: 1.6 }}>
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p style={{ margin: "0 0 6px" }}>{children}</p>,
                          strong: ({children}) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                          ul: ({children}) => <ul style={{ margin: "4px 0 6px 16px" }}>{children}</ul>,
                          li: ({children}) => <li style={{ marginBottom: 2 }}>{children}</li>,
                          code: ({children}) => <code style={{ background: "var(--bg-2)", border: "1px solid var(--border-0)", borderRadius: 3, padding: "1px 5px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--blue-text)" }}>{children}</code>,
                        }}
                      >
                        {part.value}
                      </ReactMarkdown>
                    </div>
                  )
                )}
                {streaming && i === messages.length - 1 && (
                  <div style={{ width: 8, height: 14, background: "var(--blue)", borderRadius: 1, animation: "pulse-dot 0.8s ease-in-out infinite" }} />
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{
        display: "flex",
        gap: 8,
        padding: "10px 16px",
        borderTop: "1px solid var(--border-0)",
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send().catch(console.error) }}
          placeholder="Ask about this alert…"
          disabled={streaming}
          style={{
            flex: 1,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-1)",
            background: "var(--bg-0)",
            color: "var(--text-0)",
            fontSize: 13,
            outline: "none",
            transition: "border-color 0.12s",
          }}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = "var(--blue)" }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = "var(--border-1)" }}
        />
        <button
          onClick={() => send().catch(console.error)}
          disabled={streaming || !input.trim()}
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            border: "none",
            background: streaming || !input.trim() ? "var(--bg-2)" : "var(--blue)",
            color: streaming || !input.trim() ? "var(--text-2)" : "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
            transition: "all 0.1s",
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
