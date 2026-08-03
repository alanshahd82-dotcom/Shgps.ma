/**
 * pushNotifications.ts
 *
 * Sends push notifications to mobile devices via the Expo Push Notifications
 * service (https://exp.host/--/api/v2/push/send).
 *
 * Delivery is best-effort — errors are logged but never throw to callers.
 */

import { logger } from "./logger.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

/**
 * Send one or more push notifications to Expo-registered devices.
 * Batches all messages into a single HTTP request (Expo supports up to 100/batch).
 */
export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Filter out invalid tokens (Expo tokens start with "ExponentPushToken[")
  const valid = messages.filter(
    (m) => typeof m.to === "string" && m.to.startsWith("ExponentPushToken[")
  );
  if (valid.length === 0) return;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(valid),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo push: non-OK response");
    }
  } catch (err) {
    logger.warn({ err }, "Expo push: request failed (non-fatal)");
  }
}
