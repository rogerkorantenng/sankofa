import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const BACKEND = "http://localhost:8001"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/alerts":   BACKEND,
      "/runbooks": BACKEND,
      "/actions":  BACKEND,
      "/stats":    BACKEND,
      "/slack":    BACKEND,
      "/ws": { target: "ws://localhost:8001", ws: true },
    },
  },
})
