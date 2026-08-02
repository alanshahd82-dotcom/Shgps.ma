/**
 * DeviceList mockup
 * Shows tracked vehicles with live "last seen X ago" badges.
 * Devices that haven't reported in STALE_THRESHOLD_MS flip to `noSignal`.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Config ──────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ─── Primitives (inline so the mockup is self-contained) ────────────────────

type DeviceStatus = "online" | "offline" | "noSignal";

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusDot({ status }: { status: DeviceStatus }) {
  const base = "relative inline-flex h-2.5 w-2.5 flex-shrink-0";
  const color =
    status === "online"
      ? "bg-emerald-500"
      : status === "noSignal"
        ? "bg-amber-500"
        : "bg-gray-400";
  const ping =
    status === "online"
      ? "animate-ping bg-emerald-500"
      : status === "noSignal"
        ? "animate-ping bg-amber-400"
        : "";

  return (
    <span className={base}>
      {ping && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            ping,
          )}
        />
      )}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)} />
    </span>
  );
}

function StatusBadge({
  status,
  lastSeen,
}: {
  status: DeviceStatus;
  lastSeen: number;
}) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const update = () => {
      if (status === "noSignal") {
        setLabel(`Last seen ${timeAgo(lastSeen)}`);
      } else if (status === "online") {
        setLabel("Online");
      } else {
        setLabel("Offline");
      }
    };
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [status, lastSeen]);

  const style =
    status === "online"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : status === "noSignal"
        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
        : "bg-gray-100 text-gray-600 ring-gray-500/20";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        style,
      )}
    >
      <StatusDot status={status} />
      {label}
    </span>
  );
}

// ─── Data model ──────────────────────────────────────────────────────────────

interface Device {
  id: string;
  name: string;
  driver: string;
  speed: number; // km/h
  location: string;
  lastPositionAt: number; // epoch ms — updated on WS position event
  status: DeviceStatus;
}

function deriveStatus(lastPositionAt: number): DeviceStatus {
  if (Date.now() - lastPositionAt > STALE_THRESHOLD_MS) return "noSignal";
  return "online";
}

// ─── Simulated WS feed ───────────────────────────────────────────────────────
// In production this would connect to ws://.../ws and listen for
// `position` and `deviceStale` events from the Traccar bridge.

function useDeviceFeed() {
  const [devices, setDevices] = useState<Device[]>(() => {
    const now = Date.now();
    return [
      {
        id: "d1",
        name: "Truck #12",
        driver: "Maria G.",
        speed: 62,
        location: "I-95 N, Exit 14",
        lastPositionAt: now - 45_000,
        status: "online",
      },
      {
        id: "d2",
        name: "Van #4",
        driver: "James T.",
        speed: 0,
        location: "Warehouse Dock B",
        lastPositionAt: now - STALE_THRESHOLD_MS - 2 * 60_000, // 7 min ago → stale
        status: "noSignal",
      },
      {
        id: "d3",
        name: "Sedan #7",
        driver: "Priya S.",
        speed: 38,
        location: "Oak Ave & 3rd St",
        lastPositionAt: now - 90_000,
        status: "online",
      },
      {
        id: "d4",
        name: "Pickup #3",
        driver: "Chris L.",
        speed: 0,
        location: "Main Depot",
        lastPositionAt: now - 4 * 60_000, // 4 min → still online
        status: "online",
      },
      {
        id: "d5",
        name: "Bus #2",
        driver: "—",
        speed: 0,
        location: "Unknown",
        lastPositionAt: now - 8 * 60 * 60_000, // 8 h ago → offline
        status: "offline",
      },
    ];
  });

  // Simulate incoming position updates every ~8 s for online devices
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setDevices((prev) =>
        prev.map((d) => {
          if (d.status === "offline") return d;
          // Skip Van #4 so it stays stale
          if (d.id === "d2") return d;

          const now = Date.now();
          const updatedLastPos = now - Math.floor(Math.random() * 30_000);
          return {
            ...d,
            speed: d.id === "d4" ? 0 : Math.floor(30 + Math.random() * 60),
            lastPositionAt: updatedLastPos,
            status: deriveStatus(updatedLastPos),
          };
        }),
      );
    }, 8_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Re-evaluate staleness every 30 s even without new positions
  useEffect(() => {
    const id = setInterval(() => {
      setDevices((prev) =>
        prev.map((d) => ({
          ...d,
          status: d.status === "offline" ? "offline" : deriveStatus(d.lastPositionAt),
        })),
      );
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return devices;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DeviceList() {
  const devices = useDeviceFeed();
  const [search, setSearch] = useState("");

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.driver.toLowerCase().includes(search.toLowerCase()),
  );

  const counts = {
    online: devices.filter((d) => d.status === "online").length,
    noSignal: devices.filter((d) => d.status === "noSignal").length,
    offline: devices.filter((d) => d.status === "offline").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Fleet Devices</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {counts.online} online · {counts.noSignal} no signal · {counts.offline} offline
            </p>
          </div>
          <input
            type="search"
            placeholder="Search vehicles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Banner for stale vehicles */}
      {counts.noSignal > 0 && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span className="text-amber-500">⚠</span>
          <span>
            <strong>{counts.noSignal}</strong> vehicle
            {counts.noSignal > 1 ? "s have" : " has"} not reported a GPS position in over{" "}
            {STALE_THRESHOLD_MS / 60_000} minutes.
          </span>
        </div>
      )}

      {/* List */}
      <div className="mx-6 mt-4 space-y-2 pb-8">
        {filtered.map((d) => (
          <DeviceCard key={d.id} device={d} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed bg-white px-6 py-12 text-center text-sm text-gray-400">
            No devices match your search.
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceCard({ device: d }: { device: Device }) {
  const isStale = d.status === "noSignal";
  const isOffline = d.status === "offline";

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm transition-all",
        isStale && "border-amber-200 bg-amber-50/30",
        isOffline && "opacity-60",
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg",
          isStale ? "bg-amber-100" : isOffline ? "bg-gray-100" : "bg-blue-50",
        )}
      >
        🚛
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{d.name}</span>
          <StatusBadge status={d.status} lastSeen={d.lastPositionAt} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
          <span className="truncate">📍 {d.location}</span>
          {d.driver !== "—" && <span>👤 {d.driver}</span>}
        </div>
      </div>

      {/* Speed / last seen */}
      <div className="flex-shrink-0 text-right">
        {!isOffline && d.status === "online" ? (
          <span className="text-sm font-semibold text-gray-700 tabular-nums">
            {d.speed} km/h
          </span>
        ) : isStale ? (
          <LastSeenCounter lastSeen={d.lastPositionAt} />
        ) : (
          <span className="text-xs text-gray-400">Offline</span>
        )}
      </div>
    </div>
  );
}

/** Live-updating "last seen X ago" label. */
function LastSeenCounter({ lastSeen }: { lastSeen: number }) {
  const [text, setText] = useState(() => timeAgo(lastSeen));

  useEffect(() => {
    const update = () => setText(timeAgo(lastSeen));
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [lastSeen]);

  return (
    <span className="text-xs font-medium text-amber-600 tabular-nums">{text}</span>
  );
}
