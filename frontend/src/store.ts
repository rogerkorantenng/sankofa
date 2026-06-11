import { create } from "zustand"
import type { Alert, AlertDetail } from "./types"

interface SankofaStore {
  alerts: Alert[]
  selectedAlertId: string | null
  selectedAlert: AlertDetail | null
  wsConnected: boolean
  setAlerts: (alerts: Alert[]) => void
  setSelectedAlertId: (id: string | null) => void
  setSelectedAlert: (alert: AlertDetail | null) => void
  setWsConnected: (connected: boolean) => void
}

export const useSankofaStore = create<SankofaStore>((set) => ({
  alerts: [],
  selectedAlertId: null,
  selectedAlert: null,
  wsConnected: false,
  setAlerts: (alerts) => set({ alerts }),
  setSelectedAlertId: (id) => set({ selectedAlertId: id }),
  setSelectedAlert: (alert) => set({ selectedAlert: alert }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
