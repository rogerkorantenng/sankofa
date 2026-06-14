import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { streamChat } from "../api"
import { ThinkingStep } from "./ThinkingStep"

interface Message {
  role: "user" | "assistant"
  content: string
}

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

  useEffect(() => {
    setMessages([])
    setInput("")
    setStreaming(false)
  }, [alertId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setStreaming(true)
    let assistantContent = ""
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])
    try {
      for await (const chunk of streamChat(alertId, userMsg)) {
        assistantContent += chunk
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: assistantContent },
        ])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--bg-base)",
    }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{
            padding: "20px 0",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.15 }}>◈</div>
            <p style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
              ASK THE AI ANALYST
            </p>
            <p style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.5 }}>
              What other hosts contacted? Any lateral movement?<br/>
              Is this a false positive? What's the blast radius?
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            {msg.role === "user" ? (
              <div style={{
                maxWidth: "80%",
                padding: "7px 11px",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
                fontSize: 10,
                color: "#CDD8E3",
                lineHeight: 1.5,
              }}>
                {msg.content}
              </div>
            ) : (
              <div style={{ maxWidth: "92%", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 2,
                }}>
                  <div style={{
                    width: 5,
                    height: 5,
                    border: "1px solid var(--accent)",
                    transform: "rotate(45deg)",
                  }} />
                  <span style={{ fontSize: 8, color: "var(--accent)", letterSpacing: "0.1em", fontWeight: 700 }}>
                    ANALYST
                  </span>
                </div>
                {parseMessageParts(msg.content).map((part, j) =>
                  part.type === "search" ? (
                    <ThinkingStep key={j} query={part.value} />
                  ) : (
                    <div key={j} style={{
                      fontSize: 10,
                      color: "var(--text-primary)",
                      lineHeight: 1.6,
                    }}
                    className="prose-sankofa">
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p style={{ margin: "0 0 6px", lineHeight: 1.6 }}>{children}</p>,
                          strong: ({children}) => <strong style={{ color: "#E8F0F8", fontWeight: 600 }}>{children}</strong>,
                          ul: ({children}) => <ul style={{ margin: "4px 0 6px 14px", padding: 0 }}>{children}</ul>,
                          li: ({children}) => <li style={{ marginBottom: 2 }}>{children}</li>,
                          code: ({children}) => <code style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "1px 4px", color: "var(--accent)", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>{children}</code>,
                          h3: ({children}) => <h3 style={{ fontSize: 11, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: "#E8F0F8", margin: "8px 0 4px", letterSpacing: "0.05em" }}>{children}</h3>,
                        }}
                      >
                        {part.value}
                      </ReactMarkdown>
                    </div>
                  )
                )}
                {streaming && i === messages.length - 1 && (
                  <span style={{
                    display: "inline-block",
                    width: 6,
                    height: 12,
                    background: "var(--accent)",
                    animation: "blink 1s step-end infinite",
                  }} />
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex",
        gap: 6,
        padding: "8px 14px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-panel)",
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send().catch(console.error) }}
          placeholder="Query the analyst..."
          disabled={streaming}
          style={{
            flex: 1,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-bright)",
            color: "var(--text-primary)",
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            padding: "6px 10px",
            outline: "none",
            transition: "border-color 0.12s",
          }}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = "var(--accent)" }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = "var(--border-bright)" }}
        />
        <button
          onClick={() => send().catch(console.error)}
          disabled={streaming || !input.trim()}
          style={{
            padding: "0 14px",
            background: streaming || !input.trim() ? "var(--bg-elevated)" : "rgba(0,212,255,0.1)",
            border: `1px solid ${streaming || !input.trim() ? "var(--border)" : "rgba(0,212,255,0.3)"}`,
            color: streaming || !input.trim() ? "var(--text-dim)" : "var(--accent)",
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.1em",
            cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
            transition: "all 0.12s",
          }}
        >
          {streaming ? "···" : "SEND"}
        </button>
      </div>
    </div>
  )
}
