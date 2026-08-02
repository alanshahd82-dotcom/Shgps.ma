/**
 * FleetContext
 *
 * - Opens a WebSocket to the shared API server
 * - Receives `position` and `deviceStale` messages
 * - Persists vehicle state to AsyncStorage for offline-first loading
 * - Exposes helpers to send own location position updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeviceStatus = 'online' | 'noSignal' | 'offline';

export interface Vehicle {
  id: string;
  name: string;
  driver: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  lastPositionAt: number;
  status: DeviceStatus;
}

export interface FleetAlert {
  id: string;
  type: 'stale' | 'recovered' | 'position' | 'geofence_enter' | 'geofence_exit';
  deviceId: string;
  deviceName: string;
  message: string;
  ts: number;
  /** Only present for geofence_enter / geofence_exit alerts */
  geofenceName?: string;
}

interface FleetContextValue {
  vehicles: Vehicle[];
  alerts: FleetAlert[];
  connected: boolean;
  sendPosition: (deviceId: string, lat: number, lng: number) => void;
  clearAlerts: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const CACHE_KEY = 'fleet:vehicles:v2';
const RECONNECT_DELAY_MS = 3000;

/** Seed vehicles shown until real WS data arrives */
const SEED_VEHICLES: Vehicle[] = [
  {
    id: 'truck-12',
    name: 'Truck #12',
    driver: 'Maria G.',
    lat: 40.7128,
    lng: -74.006,
    speed: 62,
    heading: 45,
    lastPositionAt: Date.now() - 45_000,
    status: 'online',
  },
  {
    id: 'van-4',
    name: 'Van #4',
    driver: 'James T.',
    lat: 40.7282,
    lng: -73.994,
    speed: 0,
    heading: 180,
    lastPositionAt: Date.now() - STALE_THRESHOLD_MS - 2 * 60_000,
    status: 'noSignal',
  },
  {
    id: 'sedan-7',
    name: 'Sedan #7',
    driver: 'Priya S.',
    lat: 40.7489,
    lng: -73.968,
    speed: 38,
    heading: 270,
    lastPositionAt: Date.now() - 90_000,
    status: 'online',
  },
  {
    id: 'pickup-3',
    name: 'Pickup #3',
    driver: 'Chris L.',
    lat: 40.7023,
    lng: -74.016,
    speed: 0,
    heading: 90,
    lastPositionAt: Date.now() - 4 * 60_000,
    status: 'online',
  },
  {
    id: 'bus-2',
    name: 'Bus #2',
    driver: '—',
    lat: 40.718,
    lng: -73.985,
    speed: 0,
    heading: 0,
    lastPositionAt: Date.now() - 8 * 60 * 60_000,
    status: 'offline',
  },
];

// ─── Context ─────────────────────────────────────────────────────────────────

const FleetContext = createContext<FleetContextValue>({
  vehicles: SEED_VEHICLES,
  alerts: [],
  connected: false,
  sendPosition: () => {},
  clearAlerts: () => {},
});

export function useFleet() {
  return useContext(FleetContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface FleetProviderProps {
  children: React.ReactNode;
  onStaleAlert?: (deviceId: string, deviceName: string) => void;
}

function deriveStatus(lastPositionAt: number): DeviceStatus {
  const age = Date.now() - lastPositionAt;
  if (age > 8 * 60 * 60_000) return 'offline';
  if (age > STALE_THRESHOLD_MS) return 'noSignal';
  return 'online';
}

export function FleetProvider({ children, onStaleAlert }: FleetProviderProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(SEED_VEHICLES);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  // ── Bootstrap from REST then override with AsyncStorage cache ───────────
  useEffect(() => {
    const domain = process.env['EXPO_PUBLIC_DOMAIN'];

    // First try the live REST endpoint, fallback to AsyncStorage cache
    const loadFromRest = domain
      ? fetch(`https://${domain}/api/devices`)
          .then((r) => r.json())
          .then(({ devices }: { devices: Array<{ deviceId: string; lat: number; lng: number; speed: number; heading: number; ts: number }> }) => {
            if (devices.length > 0) {
              setVehicles((prev) => {
                const next = [...prev];
                for (const d of devices) {
                  const idx = next.findIndex((v) => v.id === d.deviceId);
                  const updated: Vehicle = {
                    id: d.deviceId,
                    name: d.deviceId,
                    driver: '—',
                    lat: d.lat,
                    lng: d.lng,
                    speed: d.speed,
                    heading: d.heading,
                    lastPositionAt: d.ts,
                    status: deriveStatus(d.ts),
                  };
                  if (idx >= 0) {
                    next[idx] = { ...next[idx], ...updated };
                  }
                  // Only add truly unknown devices that didn't come from seed data
                  // (avoid duplicating seed entries that use friendly IDs)
                }
                return next;
              });
            }
          })
          .catch(() => {})
      : Promise.resolve();

    // Also restore AsyncStorage cache
    loadFromRest.then(() =>
      AsyncStorage.getItem(CACHE_KEY)
        .then((raw) => {
          if (raw) {
            const cached: Vehicle[] = JSON.parse(raw);
            if (cached.length > 0) setVehicles(cached);
          }
        })
        .catch(() => {})
    );
  }, []);

  // ── Persist vehicles to AsyncStorage whenever state changes ───────────────
  useEffect(() => {
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(vehicles)).catch(() => {});
  }, [vehicles]);

  // ── Staleness sweep every 30 s ────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => ({
          ...v,
          status: deriveStatus(v.lastPositionAt),
        }))
      );
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // ── WebSocket connection ──────────────────────────────────────────────────
  const addAlert = useCallback(
    (alert: Omit<FleetAlert, 'id'>) => {
      const full: FleetAlert = {
        ...alert,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      };
      setAlerts((prev) => [full, ...prev.slice(0, 49)]);
    },
    []
  );

  const connect = useCallback(() => {
    if (!isMounted.current) return;
    const domain = process.env['EXPO_PUBLIC_DOMAIN'];
    if (!domain) return;

    try {
      const ws = new WebSocket(`wss://${domain}/api/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted.current) return;
        setConnected(true);
      };

      ws.onmessage = (evt) => {
        if (!isMounted.current) return;
        let msg: { type: string; [k: string]: unknown };
        try {
          msg = JSON.parse(evt.data as string);
        } catch {
          return;
        }

        if (msg.type === 'position') {
          const { deviceId, lat, lng, speed, ts } = msg as {
            type: string;
            deviceId: string;
            lat: number;
            lng: number;
            speed?: number;
            ts: number;
          };
          setVehicles((prev) => {
            const idx = prev.findIndex((v) => v.id === deviceId);
            if (idx >= 0) {
              // Update existing vehicle
              return prev.map((v) =>
                v.id === deviceId
                  ? { ...v, lat, lng, speed: speed ?? v.speed, lastPositionAt: ts, status: 'online' as DeviceStatus }
                  : v
              );
            }
            // Upsert: new device seen for the first time via WS
            const newVehicle: Vehicle = {
              id: deviceId,
              name: deviceId,
              driver: '—',
              lat,
              lng,
              speed: speed ?? 0,
              heading: 0,
              lastPositionAt: ts,
              status: 'online',
            };
            return [...prev, newVehicle];
          });
        } else if (msg.type === 'deviceStale') {
          const { deviceId, lastSeenAt } = msg as {
            type: string;
            deviceId: string;
            lastSeenAt: number;
          };
          setVehicles((prev) =>
            prev.map((v) =>
              v.id === deviceId
                ? { ...v, status: 'noSignal' as DeviceStatus, lastPositionAt: lastSeenAt }
                : v
            )
          );
          const vehicle = vehicles.find((v) => v.id === deviceId);
          const name = vehicle?.name ?? deviceId;
          addAlert({
            type: 'stale',
            deviceId,
            deviceName: name,
            message: `${name} has not reported GPS in over 5 minutes.`,
            ts: Date.now(),
          });
          onStaleAlert?.(deviceId, name);
        } else if (msg.type === 'geofenceAlert') {
          const { eventType, deviceId, deviceName, geofenceName, ts } = msg as {
            type: string;
            eventType: 'enter' | 'exit';
            deviceId: string;
            deviceName: string;
            geofenceId: number;
            geofenceName: string;
            ts: number;
          };
          const alertType = eventType === 'enter' ? 'geofence_enter' : 'geofence_exit';
          const verb = eventType === 'enter' ? 'entered' : 'exited';
          addAlert({
            type: alertType,
            deviceId,
            deviceName,
            message: `${deviceName} ${verb} ${geofenceName}.`,
            geofenceName,
            ts,
          });
        }
      };

      ws.onclose = () => {
        if (!isMounted.current) return;
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  }, [vehicles, addAlert, onStaleAlert]);

  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendPosition = useCallback((deviceId: string, lat: number, lng: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'position', deviceId, lat, lng }));
    }
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return (
    <FleetContext.Provider value={{ vehicles, alerts, connected, sendPosition, clearAlerts }}>
      {children}
    </FleetContext.Provider>
  );
}
