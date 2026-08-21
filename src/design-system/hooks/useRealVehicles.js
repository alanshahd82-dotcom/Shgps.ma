import { useApp } from '../../context/AppContext'
import { timeAgo } from '../../components/ui'

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Hook to transform real devices from AppContext into the format
 * needed by the new design system screens (MapScreen, VehiclesScreen).
 *
 * Returns real-time tracking data, respects powerDisconnected flag,
 * and handles WebSocket live updates.
 */
export function useRealVehicles() {
  const {
    devices,
    alertsList,
    lang,
    devicesLoading,
    devicesLoaded,
    networkError,
  } = useApp()

  if (!Array.isArray(devices)) {
    return {
      vehicles: [],
      loading: devicesLoading && !devicesLoaded,
      refreshing: devicesLoading && devicesLoaded,
      error: networkError ? 'تعذر تحديث بيانات المركبات' : null,
      alertCount: 0,
    }
  }

  // Transform each device into the shape expected by design system screens
  const vehicles = devices.map(device => {
    const lastUpdateTime = device.lastUpdate || device.last_update
    const latitude = optionalNumber(device.lat ?? device.latitude)
    const longitude = optionalNumber(device.lng ?? device.longitude)
    const speed = optionalNumber(device.speed ?? device.last_speed)
    const battery = optionalNumber(device.batteryLevel ?? device.battery)
    const voltage = optionalNumber(device.voltage)
    const ignition = device.engineOn ?? device.ignition

    return {
      // Core identifiers
      id: device.id == null ? null : String(device.id),
      name: device.name || 'Unknown',
      type: device.type || 'car',
      traccarId: device.traccarId == null && device.traccar_id == null
        ? null
        : String(device.traccarId ?? device.traccar_id),

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
      ignition: ignition == null ? null : Boolean(ignition),
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
    loading: devicesLoading && !devicesLoaded,
    refreshing: devicesLoading && devicesLoaded,
    error: networkError ? 'تعذر تحديث بيانات المركبات' : null,
    alertCount,
  }
}
