import carUrl from '../assets/car-marker.png'
import bikeUrl from '../assets/bike-marker.jpg'
import truckUrl from '../assets/truck-marker.png'

export const VEHICLE_MARKERS = {
  // All three official assets share the same neutral source orientation.
  // LiveVehicleMarker applies the real GPS course when one is available.
  car: { url: carUrl, offset: 0 },
  bike: { url: bikeUrl, offset: 0 },
  truck: { url: truckUrl, offset: 0 },
}

export function markerFor(type) {
  return VEHICLE_MARKERS[type] || VEHICLE_MARKERS.bike
}