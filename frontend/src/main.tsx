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
