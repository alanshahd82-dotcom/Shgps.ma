import { getDeviceStatusKey } from '../components/ui'

// One definition of "moving / stopped / offline" shared by the Home tiles and
// the vehicles list filters, so a tile's number always matches the list it opens.
//  - moving : driving now
//  - offline: not connected, or connected but still without a GPS fix
//  - stopped: everything else that is connected (idle, parked, motion unknown)
export function fleetBucket(vehicle) {
  const key = getDeviceStatusKey(vehicle)
  if (key === 'moving') return 'moving'
  if (key === 'offline' || key === 'awaiting_gps') return 'offline'
  return 'stopped'
}
