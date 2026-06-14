import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const BACKEND = "http://localhost:8001"

// Only proxy API requests (JSON/fetch), not browser navigation
function apiOnly() {
  return {
    bypass(req: { headers: Record<string, string | string[] | undefined> }) {
      const accept = req.headers["accept"] ?? ""
      // If browser is requesting HTML (page navigation), let Vite serve the SPA
      if (typeof accept === "string" && accept.includes("text/html")) {
        return "/"
      }
      return null // proxy it
    },
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/alerts":   { target: BACKEND, ...apiOnly() },
      "/runbooks": { target: BACKEND, ...apiOnly() },
      "/actions":  { target: BACKEND, ...apiOnly() },
      "/stats":    { target: BACKEND, ...apiOnly() },
      "/slack":    { target: BACKEND, ...apiOnly() },
      "/ws":       { target: "ws://localhost:8001", ws: true },
    },
  },
})
