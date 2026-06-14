import { create } from "zustand"
import type { Alert, AlertDetail, DashboardStats } from "./types"

type ViewMode = "graph" | "timeline"

interface SankofaStore {
  alerts: Alert[]
  selectedAlertId: string | null
  selectedAlert: AlertDetail | null
  wsConnected: boolean
  viewMode: ViewMode
  actionLogOpen: boolean
  stats: DashboardStats | null
  setAlerts: (alerts: Alert[]) => void
  setSelectedAlertId: (id: string | null) => void
  setSelectedAlert: (alert: AlertDetail | null) => void
  setWsConnected: (connected: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setActionLogOpen: (open: boolean) => void
  setStats: (stats: DashboardStats) => void
}

export const useSankofaStore = create<SankofaStore>((set) => ({
  alerts: [],
  selectedAlertId: null,
  selectedAlert: null,
  wsConnected: false,
  viewMode: "graph",
  actionLogOpen: false,
  stats: null,
  setAlerts: (alerts) => set({ alerts }),
  setSelectedAlertId: (id) => set({ selectedAlertId: id }),
  setSelectedAlert: (alert) => set({ selectedAlert: alert }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActionLogOpen: (open) => set({ actionLogOpen: open }),
  setStats: (stats) => set({ stats }),
}))
