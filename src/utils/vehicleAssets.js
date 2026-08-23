import carUrl from '../assets/car-marker.png'
import bikeUrl from '../assets/bike-marker.png'
import truckUrl from '../assets/truck-marker.png'

export const VEHICLE_MARKERS = {
  // The supplied artwork points north-east in its source canvas. The live
  // marker adds this calibration before applying the GPS course.
  car: { url: carUrl, offset: -45 },
  bike: { url: bikeUrl, offset: -45 },
  truck: { url: truckUrl, offset: -45 },
}

export function normalizeVehicleType(type) {
  const normalized = String(type || '').trim().toLowerCase()
  if (normalized === 'motorcycle' || normalized === 'motorbike' || normalized === 'motor-bike') return 'bike'
  if (normalized === 'truck' || normalized === 'car' || normalized === 'bike') return normalized
  return 'car'
}

export function markerFor(type) {
  return VEHICLE_MARKERS[normalizeVehicleType(type)]
}