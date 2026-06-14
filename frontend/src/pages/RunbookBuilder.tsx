import { useState } from "react"
import { createRunbook } from "../api"

const MITRE_TACTICS = [
  { value: "TA0001", label: "Initial Access" },
  { value: "TA0006", label: "Credential Access" },
  { value: "TA0008", label: "Lateral Movement" },
  { value: "TA0043", label: "Reconnaissance" },
  { value: "TA0011", label: "Command and Control" },
  { value: "TA0040", label: "Impact" },
]

const ACTION_TYPES = [
  {
    value: "add_to_watchlist",
    label: "Add IP to Watchlist",
    description: "Records the source IP in Splunk KV Store for future tracking",
    icon: "🔍",
    risk: "low",
    category: "Splunk",
  },
  {
    value: "create_splunk_alert",
    label: "Create Splunk Alert",
    description: "Creates a saved search in Splunk to continuously monitor for this pattern",
    icon: "🔔",
    risk: "low",
    category: "Splunk",
  },
  {
    value: "slack_notify",
    label: "Send Slack Notification",
    description: "Posts an alert summary to your configured Slack channel",
    icon: "💬",
    risk: "low",
    category: "Notification",
  },
  {
    value: "block_ip",
    label: "Block Source IP",
    description: "Blocks the attacking IP at the perimeter firewall — requires approval",
    icon: "🚫",
    risk: "high",
    category: "Response",
  },
  {
    value: "isolate_host",
    label: "Isolate Host",
    description: "Removes the affected host from its network segment — requires approval",
    icon: "🔒",
    risk: "high",
    category: "Response",
  },
]

interface Step {
  id: string
  action_type: string
  label: string
  risk: string
  description: string
  icon: string
}

function StepCard({
  step,
  index,
  total,
  onRemove,
}: {
  step: Step
  index: number
  total: number
  onRemove: () => void
}) {
  const isHigh = step.risk === "high"
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Connector line from above */}
      {index > 0 && (
        <div style={{ width: 2, height: 24, background: "var(--border-1)" }} />
      )}

      {/* Step card */}
      <div style={{
        width: "100%",
        border: `1px solid ${isHigh ? "var(--high-border)" : "var(--border-0)"}`,
        borderRadius: 10,
        background: "var(--bg-0)",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        {/* Card header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-0)",
          background: isHigh ? "var(--high-bg)" : "var(--bg-1)",
        }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 8,
            background: isHigh ? "#FED7AA" : "var(--bg-2)",
            border: `1px solid ${isHigh ? "var(--high-border)" : "var(--border-0)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>
            {step.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>{step.label}</span>
              {isHigh && (
                <span style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 10,
                  background: "var(--high-bg)", border: "1px solid var(--high-border)",
                  color: "var(--high-text)", fontWeight: 500,
                }}>Requires approval</span>
              )}
              {!isHigh && (
                <span style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 10,
                  background: "var(--green-bg)", border: "1px solid var(--green-border)",
                  color: "var(--green-text)", fontWeight: 500,
                }}>Auto-execute</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{step.description}</p>
          </div>
          <button
            onClick={onRemove}
            style={{
              width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 5, border: "1px solid var(--border-0)",
              background: "transparent", color: "var(--text-2)",
              fontSize: 16, cursor: "pointer", flexShrink: 0,
              transition: "all 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--critical-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--critical)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-2)" }}
          >×</button>
        </div>
        {/* Step number */}
        <div style={{ padding: "6px 16px", background: "var(--bg-1)" }}>
          <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 500 }}>
            STEP {index + 1} OF {total}
          </span>
        </div>
      </div>
    </div>
  )
}

function AddStepModal({ onAdd, onClose }: { onAdd: (action: typeof ACTION_TYPES[0]) => void; onClose: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const categories = Array.from(new Set(ACTION_TYPES.map(a => a.category)))

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.3)",
    }} onClick={onClose}>
      <div
        style={{
          width: 520,
          background: "var(--bg-0)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-0)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-0)" }}>Add a step</p>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>Choose what Sankofa should do when this runbook fires</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-2)", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {categories.map(cat => (
            <div key={cat}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{cat}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ACTION_TYPES.filter(a => a.category === cat).map(action => (
                  <button
                    key={action.value}
                    onClick={() => { onAdd(action); onClose() }}
                    onMouseEnter={() => setHovered(action.value)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1px solid ${hovered === action.value ? "var(--blue-border)" : "var(--border-0)"}`,
                      background: hovered === action.value ? "var(--blue-bg)" : "var(--bg-1)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.1s",
                    }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{action.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-0)" }}>{action.label}</span>
                        <span style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 10,
                          background: action.risk === "high" ? "var(--high-bg)" : "var(--green-bg)",
                          border: `1px solid ${action.risk === "high" ? "var(--high-border)" : "var(--green-border)"}`,
                          color: action.risk === "high" ? "var(--high-text)" : "var(--green-text)",
                          fontWeight: 500,
                        }}>
                          {action.risk === "high" ? "Needs approval" : "Auto"}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>{action.description}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--text-3)" }}>
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RunbookBuilder() {
  const [name, setName] = useState("Untitled Runbook")
  const [editingName, setEditingName] = useState(false)
  const [mitreTactic, setMitreTactic] = useState("TA0006")
  const [severities, setSeverities] = useState<string[]>(["high", "critical"])
  const [steps, setSteps] = useState<Step[]>([])
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")

  function addStep(action: typeof ACTION_TYPES[0]) {
    setSteps(prev => [...prev, {
      id: `step-${Date.now()}`,
      action_type: action.value,
      label: action.label,
      risk: action.risk,
      description: action.description,
      icon: action.icon,
    }])
  }

  function removeStep(id: string) {
    setSteps(prev => prev.filter(s => s.id !== id))
  }

  async function handleSave() {
    if (!steps.length) { setSaveError("Add at least one step"); return }
    setSaveError("")
    setSaving(true)
    try {
      await createRunbook({
        name,
        trigger_conditions: { mitre_tactics: [mitreTactic], severity: severities },
        steps: steps.map((s, i) => ({
          id: `step-${i + 1}`,
          type: "action",
          label: s.label,
          action_type: s.action_type,
          risk_level: s.risk,
          params: {},
          next_on_success: i < steps.length - 1 ? `step-${i + 2}` : null,
          next_on_failure: null,
        })),
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); window.location.href = "/runbooks" }, 1500)
    } catch {
      setSaveError("Failed to save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const selectedTactic = MITRE_TACTICS.find(t => t.value === mitreTactic)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)", fontFamily: "Inter, sans-serif" }}>
      {/* Nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
        background: "var(--bg-0)", borderBottom: "1px solid var(--border-0)",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>S</div>
          <a href="/" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>Dashboard</a>
          <span style={{ color: "var(--text-3)", fontSize: 13 }}>/</span>
          <a href="/runbooks" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>Runbooks</a>
          <span style={{ color: "var(--text-3)", fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, color: "var(--text-0)", fontWeight: 500 }}>New</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saveError && <span style={{ fontSize: 12, color: "var(--critical)" }}>{saveError}</span>}
          <a href="/runbooks" style={{
            padding: "6px 14px", borderRadius: 6,
            border: "1px solid var(--border-0)", background: "var(--bg-0)",
            color: "var(--text-1)", fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}>
            Cancel
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "6px 16px", borderRadius: 6, border: "none",
              background: saved ? "var(--green)" : "var(--blue)",
              color: "#fff", fontSize: 13, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, transition: "all 0.15s",
            }}
          >
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Runbook"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Runbook name */}
        <div style={{ marginBottom: 32 }}>
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === "Enter" && setEditingName(false)}
              style={{
                fontSize: 24, fontWeight: 700, color: "var(--text-0)",
                border: "none", borderBottom: "2px solid var(--blue)",
                background: "transparent", outline: "none", width: "100%",
              }}
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              style={{
                fontSize: 24, fontWeight: 700, color: "var(--text-0)",
                cursor: "text", display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {name}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-3)", flexShrink: 0 }}>
                <path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </h1>
          )}
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            Click the name to edit
          </p>
        </div>

        {/* Trigger config card */}
        <div style={{
          border: "1px solid var(--blue-border)",
          borderRadius: 10,
          background: "var(--bg-0)",
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          marginBottom: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px",
            background: "var(--blue-bg)",
            borderBottom: "1px solid var(--blue-border)",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>
              ⚡
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-text)" }}>Trigger</p>
              <p style={{ fontSize: 12, color: "var(--blue-text)", opacity: 0.7 }}>
                When an alert matches these conditions, this runbook fires automatically
              </p>
            </div>
          </div>

          <div style={{ padding: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* MITRE Tactic */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  MITRE Tactic
                </label>
                <select
                  value={mitreTactic}
                  onChange={e => setMitreTactic(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px",
                    border: "1px solid var(--border-1)", borderRadius: 6,
                    background: "var(--bg-0)", color: "var(--text-0)",
                    fontSize: 13, outline: "none", cursor: "pointer",
                  }}
                >
                  {MITRE_TACTICS.map(t => (
                    <option key={t.value} value={t.value}>{t.value} — {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Severity */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Severity
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 4 }}>
                  {["low", "medium", "high", "critical"].map(s => (
                    <label key={s} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                      border: `1px solid ${severities.includes(s) ? "var(--blue-border)" : "var(--border-0)"}`,
                      background: severities.includes(s) ? "var(--blue-bg)" : "var(--bg-1)",
                      transition: "all 0.1s",
                    }}>
                      <input
                        type="checkbox"
                        checked={severities.includes(s)}
                        onChange={e => setSeverities(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))}
                        style={{ margin: 0 }}
                      />
                      <span style={{
                        fontSize: 12, fontWeight: 500, textTransform: "capitalize",
                        color: severities.includes(s) ? "var(--blue-text)" : "var(--text-1)",
                      }}>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{
              marginTop: 14, padding: "8px 12px", borderRadius: 6,
              background: "var(--bg-1)", border: "1px solid var(--border-0)",
            }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                Fires when: <strong style={{ color: "var(--text-0)" }}>{mitreTactic} — {selectedTactic?.label}</strong> + severity is{" "}
                <strong style={{ color: "var(--text-0)" }}>{severities.join(", ") || "any"}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Steps */}
        {steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            total={steps.length}
            onRemove={() => removeStep(step.id)}
          />
        ))}

        {/* Add step connector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 0 }}>
          <div style={{ width: 2, height: 24, background: "var(--border-1)" }} />
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 8,
              border: "2px dashed var(--border-1)",
              background: "var(--bg-0)", color: "var(--blue-text)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.1s",
              width: "100%", justifyContent: "center",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"
              ;(e.currentTarget as HTMLElement).style.background = "var(--blue-bg)"
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-1)"
              ;(e.currentTarget as HTMLElement).style.background = "var(--bg-0)"
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            {steps.length === 0 ? "Add first step" : "Add another step"}
          </button>
        </div>

        {/* Summary if steps exist */}
        {steps.length > 0 && (
          <div style={{
            marginTop: 24, padding: "14px 16px", borderRadius: 8,
            background: "var(--bg-0)", border: "1px solid var(--border-0)",
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>Runbook summary</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {steps.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "var(--blue)", color: "#fff",
                    fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: "var(--text-1)" }}>{s.label}</span>
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 10,
                    background: s.risk === "high" ? "var(--high-bg)" : "var(--green-bg)",
                    color: s.risk === "high" ? "var(--high-text)" : "var(--green-text)",
                    border: `1px solid ${s.risk === "high" ? "var(--high-border)" : "var(--green-border)"}`,
                    fontWeight: 500,
                  }}>
                    {s.risk === "high" ? "Needs approval" : "Auto"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && <AddStepModal onAdd={addStep} onClose={() => setShowModal(false)} />}
    </div>
  )
}
