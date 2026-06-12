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
    <div className="flex flex-col h-full border-t border-gray-700">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500">Ask a follow-up question about this alert...</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
            {msg.role === "user" ? (
              <span className="inline-block bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg max-w-xs">
                {msg.content}
              </span>
            ) : (
              <div className="text-xs text-gray-200 space-y-1">
                {parseMessageParts(msg.content).map((part, j) =>
                  part.type === "search" ? (
                    <ThinkingStep key={j} query={part.value} />
                  ) : (
                    <div key={j} className="prose prose-invert prose-xs max-w-none
                      [&>p]:mb-2 [&>p]:leading-relaxed
                      [&>ul]:ml-4 [&>ul]:list-disc [&>ul>li]:mb-0.5
                      [&>ol]:ml-4 [&>ol]:list-decimal [&>ol>li]:mb-0.5
                      [&>h1]:text-sm [&>h1]:font-bold [&>h1]:text-white [&>h1]:mb-1
                      [&>h2]:text-xs [&>h2]:font-bold [&>h2]:text-white [&>h2]:mb-1
                      [&>h3]:text-xs [&>h3]:font-semibold [&>h3]:text-gray-300 [&>h3]:mb-1
                      [&>strong]:text-white [&>strong]:font-semibold
                      [&>code]:bg-gray-700 [&>code]:px-1 [&>code]:rounded [&>code]:text-blue-300
                      [&>hr]:border-gray-700 [&>hr]:my-2
                      [&>table]:w-full [&>table]:text-xs [&>table>thead>tr>th]:text-left [&>table>thead>tr>th]:pb-1 [&>table>thead>tr>th]:text-gray-400
                      [&>table>tbody>tr>td]:py-0.5 [&>table>tbody>tr>td]:pr-3">
                      <ReactMarkdown>{part.value}</ReactMarkdown>
                    </div>
                  )
                )}
                {streaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-3 bg-gray-400 animate-pulse" />
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t border-gray-700">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send().catch(console.error) }}
          placeholder="Ask about this alert..."
          className="flex-1 bg-gray-800 text-white text-xs px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-400"
          disabled={streaming}
        />
        <button
          onClick={() => send().catch(console.error)}
          disabled={streaming || !input.trim()}
          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-2 rounded transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
