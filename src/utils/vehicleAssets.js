import carUrl from '../assets/car-marker.png'
import bikeUrl from '../assets/bike-marker.png'

export const VEHICLE_MARKERS = {
  car: { url: carUrl, offset: -135 },
  bike: { url: bikeUrl, offset: -135 },
}

export function markerFor(type) {
  return VEHICLE_MARKERS[type] || VEHICLE_MARKERS.bike
}