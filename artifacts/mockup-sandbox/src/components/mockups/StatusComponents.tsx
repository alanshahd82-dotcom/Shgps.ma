/**
 * StatusComponents mockup
 * Shared primitives: StatusDot, StatusBadge, timeAgo
 * Used by LiveMap and DeviceList to surface GPS staleness.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// ─── timeAgo ────────────────────────────────────────────────────────────────

/** Returns a human-readable string like "2 min ago" or "just now". */
export function timeAgo(date: Date | string | number): string {
  const now = Date.now();
  const ts = typeof date === "object" ? date.getTime() : Number(date);
  const diff = Math.floor((now - ts) / 1000); // seconds

  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Device status type ──────────────────────────────────────────────────────

export type DeviceStatus = "online" | "offline" | "noSignal";

// ─── StatusDot ───────────────────────────────────────────────────────────────

const dotColors: Record<DeviceStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-gray-400",
  noSignal: "bg-amber-500",
};

const dotPulse: Record<DeviceStatus, string> = {
  online: "animate-ping bg-emerald-500",
  offline: "",
  noSignal: "animate-ping bg-amber-400",
};

interface StatusDotProps {
  status: DeviceStatus;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span className={cn("relative inline-flex h-3 w-3", className)}>
      {dotPulse[status] && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            dotPulse[status],
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-3 w-3 rounded-full",
          dotColors[status],
        )}
      />
    </span>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const badgeStyles: Record<DeviceStatus, string> = {
  online: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  offline: "bg-gray-100 text-gray-600 ring-gray-500/20",
  noSignal: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const badgeLabels: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  noSignal: "No Signal",
};

interface StatusBadgeProps {
  status: DeviceStatus;
  lastSeen?: Date | string | number | null;
  className?: string;
}

export function StatusBadge({ status, lastSeen, className }: StatusBadgeProps) {
  const [label, setLabel] = useState<string>(badgeLabels[status]);

  useEffect(() => {
    if (status !== "noSignal" || lastSeen == null) {
      setLabel(badgeLabels[status]);
      return;
    }
    const update = () => setLabel(`Last seen ${timeAgo(lastSeen)}`);
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [status, lastSeen]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeStyles[status],
        className,
      )}
    >
      <StatusDot status={status} className="h-2 w-2" />
      {label}
    </span>
  );
}

// ─── Demo / Preview ───────────────────────────────────────────────────────────

const STALE_MINS = 5;

interface DemoDevice {
  id: string;
  name: string;
  status: DeviceStatus;
  lastSeen: Date;
}

const NOW = new Date();
const devices: DemoDevice[] = [
  { id: "v1", name: "Truck #1", status: "online", lastSeen: new Date(NOW.getTime() - 30_000) },
  {
    id: "v2",
    name: "Van #4",
    status: "noSignal",
    lastSeen: new Date(NOW.getTime() - STALE_MINS * 60_000 - 90_000),
  },
  { id: "v3", name: "Sedan #7", status: "offline", lastSeen: new Date(NOW.getTime() - 3_600_000) },
];

export default function StatusComponentsPreview() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Status Primitives</h1>
          <p className="mt-1 text-sm text-gray-500">
            Shared components used by LiveMap and DeviceList to show GPS staleness.
            Threshold: {STALE_MINS} min.
          </p>
        </div>

        {/* StatusDot row */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            StatusDot
          </h2>
          <div className="flex items-center gap-8 bg-white rounded-lg border p-4">
            {(["online", "noSignal", "offline"] as DeviceStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-2 text-sm text-gray-700">
                <StatusDot status={s} />
                <span className="capitalize">{s}</span>
              </div>
            ))}
          </div>
        </section>

        {/* StatusBadge row */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            StatusBadge
          </h2>
          <div className="flex flex-wrap gap-3 bg-white rounded-lg border p-4">
            {devices.map((d) => (
              <StatusBadge key={d.id} status={d.status} lastSeen={d.lastSeen} />
            ))}
          </div>
        </section>

        {/* timeAgo */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            timeAgo
          </h2>
          <div className="bg-white rounded-lg border divide-y text-sm">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-gray-700">{d.name}</span>
                <span className="text-gray-500 tabular-nums">{timeAgo(d.lastSeen)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
