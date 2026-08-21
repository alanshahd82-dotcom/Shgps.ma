import { useApp } from '../../context/AppContext'
import { timeAgo } from '../../components/ui'

/**
 * Hook to transform real devices from AppContext into the format
 * needed by the new design system screens (MapScreen, VehiclesScreen).
 *
 * Returns real-time tracking data, respects powerDisconnected flag,
 * and handles WebSocket live updates.
 */
export function useRealVehicles() {
  const { devices, alertsList, lang } = useApp()

  if (!Array.isArray(devices)) {
    return {
      vehicles: [],
      loading: false,
      error: null,
      alertCount: 0,
    }
  }

  // Transform each device into the shape expected by design system screens
  const vehicles = devices.map(device => {
    const lastUpdateTime = device.lastUpdate || device.last_update
    const latitude = Number(device.lat ?? device.latitude ?? 0)
    const longitude = Number(device.lng ?? device.longitude ?? 0)
    const speed = Number(device.speed ?? device.last_speed ?? 0)
    const battery = device.batteryLevel ?? device.battery ?? null
    const voltage = device.voltage ?? null

    return {
      // Core identifiers
      id: device.id,
      name: device.name || 'Unknown',
      type: device.type || 'car',
      traccarId: device.traccarId ?? device.traccar_id,

      // Location
      lat: latitude,
      lng: longitude,
      location: device.location,

      // Motion & speed
      speed: speed,
      course: device.course,

      // Connection status
      status: device.status || 'offline',
      powerDisconnected: device.powerDisconnected === true,

      // Power & battery
      battery: battery,
      batteryLevel: battery,
      voltage: voltage,
      ignition: device.engineOn ?? device.ignition ?? false,
      charge: device.charge,

      // Timestamps
      lastUpdate: lastUpdateTime,
      lastUpdateFormatted: timeAgo(lastUpdateTime, lang),
      fixTime: device.fixTime,

      // Additional metadata
      plate: device.plate,
      driver: device.driver,
      alerts: device.alerts || [],
      subscription: device.subscription,
      geofence: device.geofence,
      geofenceActive: device.geofenceActive,

      // Original device reference (for fallback)
      _raw: device,
    }
  })

  // Count unread alerts
  const alertCount = Array.isArray(alertsList)
    ? alertsList.filter(a => !a.read).length
    : 0

  return {
    vehicles,
    loading: false,
    error: null,
    alertCount,
  }
}
