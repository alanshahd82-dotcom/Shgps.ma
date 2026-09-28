// Which devices count as "not connected", and the most likely reason.
// Reasons are hints derived from data we really have; they are never certain.

export function isNotConnected(device) {
  return device?.status !== 'online' || device?.trackingEnabled === false
}

export function offlineReason(device, now = Date.now()) {
  if (device?.trackingEnabled === false || device?.subscriptionStatus === 'expired') return { code: 'subscription' }
  if (device?.powerDisconnected) return { code: 'power' }
  const last = device?.lastUpdate ? Date.parse(device.lastUpdate) : NaN
  if (!Number.isFinite(last)) return { code: 'never' }
  const hours = Math.max(0, (now - last) / 3600e3)
  if (hours >= 24) return { code: 'long', days: Math.floor(hours / 24) }
  return { code: 'recent', minutes: Math.floor(hours * 60) }
}

// Longest disconnected first; devices that never connected come first of all.
export function offlineSortValue(device) {
  const last = device?.lastUpdate ? Date.parse(device.lastUpdate) : NaN
  return Number.isFinite(last) ? last : -Infinity
}
