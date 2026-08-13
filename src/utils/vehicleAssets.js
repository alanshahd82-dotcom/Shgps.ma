import carUrl from '../assets/car-marker.png'
import bikeUrl from '../assets/bike-marker.png'
import truckUrl from '../assets/truck-marker.png'

export const VEHICLE_MARKERS = {
  // The replacement cut-outs point north in their source artwork, so the
  // existing bearing rotation can be applied without a heading correction.
  car: { url: carUrl, offset: 0 },
  bike: { url: bikeUrl, offset: 0 },
  truck: { url: truckUrl, offset: 0 },
}

export function markerFor(type) {
  return VEHICLE_MARKERS[type] || VEHICLE_MARKERS.bike
}