import carUrl from '../assets/car-marker.png'
import bikeUrl from '../assets/bike-marker.png'
import truckUrl from '../assets/truck-marker.png'

export const VEHICLE_MARKERS = {
  // The supplied cut-outs face down-right in their source artwork. These
  // offsets rotate each nose to north when the live course is 0°.
  car: { url: carUrl, offset: -125 },
  bike: { url: bikeUrl, offset: -130 },
  truck: { url: truckUrl, offset: -120 },
}

export function markerFor(type) {
  return VEHICLE_MARKERS[type] || VEHICLE_MARKERS.bike
}