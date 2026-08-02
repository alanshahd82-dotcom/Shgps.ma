/**
 * broadcast.ts
 *
 * Shared singleton that lets any module (HTTP routes, WS handler, scanners)
 * broadcast a WebSocket event to all connected clients.
 *
 * Call `setWss(wss)` once after the WebSocketServer is created in index.ts.
 */

import { WebSocket, WebSocketServer } from "ws";

let _wss: WebSocketServer | null = null;

export function setWss(wss: WebSocketServer): void {
  _wss = wss;
}

export function broadcastPosition(
  deviceId: string,
  lat: number,
  lng: number,
  speed: number,
  heading: number,
  ts: number
): void {
  if (!_wss) return;
  const msg = JSON.stringify({ type: "position", deviceId, lat, lng, speed, heading, ts });
  _wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

export interface GeofenceAlertPayload {
  type: "geofenceAlert";
  eventType: "enter" | "exit";
  deviceId: string;
  deviceName: string;
  geofenceId: number;
  geofenceName: string;
  ts: number;
}

/**
 * Broadcast a geofence enter/exit event to all connected WebSocket clients.
 */
export function broadcastGeofenceAlert(payload: GeofenceAlertPayload): void {
  if (!_wss) return;
  const msg = JSON.stringify(payload);
  _wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}
