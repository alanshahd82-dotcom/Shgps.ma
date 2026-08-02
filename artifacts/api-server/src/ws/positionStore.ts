/**
 * positionStore.ts
 *
 * In-memory store for the latest GPS position of each device.
 * Used by REST endpoints so mobile clients can fetch current state on startup.
 */

export interface DevicePosition {
  deviceId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  ts: number;
}

const store = new Map<string, DevicePosition>();

export function storePosition(pos: DevicePosition): void {
  store.set(pos.deviceId, pos);
}

export function getPosition(deviceId: string): DevicePosition | undefined {
  return store.get(deviceId);
}

export function getAllPositions(): DevicePosition[] {
  return Array.from(store.values());
}
