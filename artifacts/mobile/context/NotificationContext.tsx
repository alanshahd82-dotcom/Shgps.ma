/**
 * NotificationContext
 *
 * - Requests foreground + background location permissions
 * - Starts background location tracking via expo-task-manager
 * - Requests push notification permissions
 * - Registers the Expo push token with the backend
 * - Exposes helpers to schedule local notifications
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'fleet-background-location';

// ─── Background task (must be at module top-level) ───────────────────────────

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }: { data: unknown; error: TaskManager.TaskManagerError | null }) => {
    if (error) {
      console.warn('[BG location]', error.message);
      return;
    }
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations[locations.length - 1];
    if (!loc) return;

    const domain = process.env['EXPO_PUBLIC_DOMAIN'];
    if (!domain) return;

    // Send position to the API server from the background context via HTTP
    const deviceId = `driver-device-${process.env['EXPO_PUBLIC_REPL_ID'] ?? 'unknown'}`;
    await fetch(`https://${domain}/fleet/devices/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        speed: loc.coords.speed ?? 0,
        heading: loc.coords.heading ?? 0,
        ts: loc.timestamp,
      }),
    }).catch(() => {});
  }
);

// ─── Notification handler ────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,
  }),
});

// ─── Context ─────────────────────────────────────────────────────────────────

interface NotificationContextValue {
  locationGranted: boolean;
  backgroundLocationGranted: boolean;
  notificationsGranted: boolean;
  requestPermissions: () => Promise<void>;
  scheduleStaleAlert: (deviceName: string) => Promise<void>;
  ownDeviceId: string;
}

const NotificationContext = createContext<NotificationContextValue>({
  locationGranted: false,
  backgroundLocationGranted: false,
  notificationsGranted: false,
  requestPermissions: async () => {},
  scheduleStaleAlert: async () => {},
  ownDeviceId: 'driver-device-unknown',
});

export function useNotifications() {
  return useContext(NotificationContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [locationGranted, setLocationGranted] = useState(false);
  const [backgroundLocationGranted, setBackgroundLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const ownDeviceId = `driver-device-${process.env['EXPO_PUBLIC_REPL_ID'] ?? 'dev'}`;
  const notifListener = useRef<Notifications.EventSubscription | null>(null);

  // ── Request all permissions on mount ─────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    // 1. Notifications
    const notifStatus = await Notifications.requestPermissionsAsync();
    setNotificationsGranted(notifStatus.granted);

    if (notifStatus.granted) {
      // Register push token with backend
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const domain = process.env['EXPO_PUBLIC_DOMAIN'];
        if (domain) {
          await fetch(`https://${domain}/fleet/alerts/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenData.data, deviceId: ownDeviceId }),
          }).catch(() => {});
        }
      } catch {
        // Push token not available in Expo Go without project ID — local notifications still work
      }
    }

    if (Platform.OS === 'web') return;

    // 2. Foreground location
    const fgStatus = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(fgStatus.granted);
    if (!fgStatus.granted) return;

    // 3. Background location
    const bgStatus = await Location.requestBackgroundPermissionsAsync();
    setBackgroundLocationGranted(bgStatus.granted);

    if (bgStatus.granted) {
      await startBackgroundLocation();
    }
  }, [ownDeviceId]);

  useEffect(() => {
    requestPermissions();

    // Listen for incoming notifications while app is open
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    return () => {
      notifListener.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Schedule a local stale-vehicle notification ───────────────────────────
  const scheduleStaleAlert = useCallback(async (deviceName: string) => {
    if (!notificationsGranted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠ Vehicle Signal Lost',
        body: `${deviceName} has not reported GPS in over 5 minutes. Last known position shown.`,
        sound: true,
        data: { type: 'stale', deviceName },
      },
      trigger: null, // fire immediately
    });
  }, [notificationsGranted]);

  return (
    <NotificationContext.Provider
      value={{
        locationGranted,
        backgroundLocationGranted,
        notificationsGranted,
        requestPermissions,
        scheduleStaleAlert,
        ownDeviceId,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Background location helpers ─────────────────────────────────────────────

async function startBackgroundLocation() {
  if (Platform.OS === 'web') return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    }
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 50, // meters — update every 50m of movement
      timeInterval: 30_000,  // or every 30 s
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Fleet Tracker',
        notificationBody: 'Tracking your location in the background.',
        notificationColor: '#2f81f7',
      },
    });
  } catch (err) {
    // Background location requires a development build in Expo Go
    console.info('[BG location] Could not start background tracking:', err);
  }
}
