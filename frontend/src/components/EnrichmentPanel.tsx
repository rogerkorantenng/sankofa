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
          {malicious ? (
            <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded">
              Score: {intel.reputation_score}
            </span>
          ) : (
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
