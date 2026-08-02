/**
 * LiveMap mockup
 * SVG-based map canvas with vehicle markers.
 * Markers older than STALE_THRESHOLD_MS show a "last seen X ago" badge
 * and the device status flips to `noSignal`.
 *
 * In production this connects to the backend WS bridge and listens for
 * `position` and `deviceStale` events.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Config ──────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ───────────────────────────────────────────────────────────────────

type DeviceStatus = "online" | "offline" | "noSignal";

interface Vehicle {
  id: string;
  name: string;
  driver: string;
  // Normalized 0-1 canvas coords
  x: number;
  y: number;
  speed: number;
  heading: number; // degrees 0-360
  lastPositionAt: number; // epoch ms
  status: DeviceStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function deriveStatus(lastPositionAt: number): DeviceStatus {
  if (Date.now() - lastPositionAt > STALE_THRESHOLD_MS) return "noSignal";
  return "online";
}

const markerColor: Record<DeviceStatus, { fill: string; ring: string; label: string }> = {
  online: { fill: "#10b981", ring: "#d1fae5", label: "#065f46" },
  noSignal: { fill: "#f59e0b", ring: "#fef3c7", label: "#92400e" },
  offline: { fill: "#9ca3af", ring: "#f3f4f6", label: "#374151" },
};

// ─── Simulated feed ──────────────────────────────────────────────────────────

function useVehicleFeed() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const now = Date.now();
    return [
      {
        id: "v1",
        name: "Truck #12",
        driver: "Maria G.",
        x: 0.22,
        y: 0.38,
        speed: 62,
        heading: 45,
        lastPositionAt: now - 30_000,
        status: "online",
      },
      {
        id: "v2",
        name: "Van #4",
        driver: "James T.",
        x: 0.54,
        y: 0.6,
        speed: 0,
        heading: 180,
        lastPositionAt: now - (STALE_THRESHOLD_MS + 2 * 60_000), // 7 min stale
        status: "noSignal",
      },
      {
        id: "v3",
        name: "Sedan #7",
        driver: "Priya S.",
        x: 0.74,
        y: 0.28,
        speed: 38,
        heading: 270,
        lastPositionAt: now - 60_000,
        status: "online",
      },
      {
        id: "v4",
        name: "Pickup #3",
        driver: "Chris L.",
        x: 0.38,
        y: 0.72,
        speed: 15,
        heading: 90,
        lastPositionAt: now - 3 * 60_000,
        status: "online",
      },
    ];
  });

  const moveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    moveRef.current = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === "v2") return v; // keep stale
          const now = Date.now();
          const rad = (v.heading * Math.PI) / 180;
          const step = 0.008;
          let nx = v.x + Math.sin(rad) * step;
          let ny = v.y - Math.cos(rad) * step;
          // Bounce off edges
          let nh = v.heading;
          if (nx < 0.05 || nx > 0.95) { nh = (nh + 160 + Math.random() * 40) % 360; nx = Math.max(0.05, Math.min(0.95, nx)); }
          if (ny < 0.05 || ny > 0.9) { nh = (nh + 160 + Math.random() * 40) % 360; ny = Math.max(0.05, Math.min(0.9, ny)); }
          const lastPos = now - Math.floor(Math.random() * 20_000);
          return { ...v, x: nx, y: ny, heading: nh, lastPositionAt: lastPos, status: deriveStatus(lastPos) };
        }),
      );
    }, 2_500);

    return () => {
      if (moveRef.current) clearInterval(moveRef.current);
    };
  }, []);

  // Re-evaluate staleness every 30 s
  useEffect(() => {
    const id = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => ({
          ...v,
          status: v.status === "offline" ? "offline" : deriveStatus(v.lastPositionAt),
        })),
      );
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return vehicles;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LiveMap() {
  const vehicles = useVehicleFeed();
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedVehicle = vehicles.find((v) => v.id === selected) ?? null;

  const handleMarkerClick = useCallback((id: string) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

  const staleCount = vehicles.filter((v) => v.status === "noSignal").length;

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Live Fleet Map</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />
            {vehicles.filter((v) => v.status === "online").length} online
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 mr-1" />
            {staleCount} no signal
          </span>
        </div>
      </div>

      {/* Stale banner */}
      {staleCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300">
          <span>⚠</span>
          <span>
            <strong>{staleCount}</strong> vehicle{staleCount > 1 ? "s have" : " has"} not reported
            GPS in over {STALE_THRESHOLD_MS / 60_000} minutes. Last known position shown.
          </span>
        </div>
      )}

      {/* Map + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* SVG Map canvas */}
        <div className="relative flex-1">
          <MapCanvas ref={svgRef} vehicles={vehicles} selected={selected} onSelect={handleMarkerClick} />
        </div>

        {/* Side panel */}
        {selectedVehicle && (
          <VehiclePanel vehicle={selectedVehicle} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

// ─── Map canvas ──────────────────────────────────────────────────────────────

import { forwardRef } from "react";

const MapCanvas = forwardRef<
  SVGSVGElement,
  { vehicles: Vehicle[]; selected: string | null; onSelect: (id: string) => void }
>(function MapCanvas({ vehicles, selected, onSelect }, ref) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 800 500"
      className="h-full w-full"
      style={{ background: "#1e293b" }}
    >
      {/* Fake road grid */}
      <Roads />

      {/* Vehicle markers */}
      {vehicles.map((v) => (
        <VehicleMarker
          key={v.id}
          vehicle={v}
          selected={selected === v.id}
          onClick={() => onSelect(v.id)}
        />
      ))}
    </svg>
  );
});

function Roads() {
  const roads = [
    // Horizontals
    { x1: 0, y1: 125, x2: 800, y2: 125 },
    { x1: 0, y1: 250, x2: 800, y2: 250 },
    { x1: 0, y1: 375, x2: 800, y2: 375 },
    // Verticals
    { x1: 200, y1: 0, x2: 200, y2: 500 },
    { x1: 400, y1: 0, x2: 400, y2: 500 },
    { x1: 600, y1: 0, x2: 600, y2: 500 },
  ];

  return (
    <g>
      {roads.map((r, i) => (
        <line
          key={i}
          {...r}
          stroke="#334155"
          strokeWidth={i < 3 ? 12 : 10}
        />
      ))}
      {roads.map((r, i) => (
        <line
          key={`c-${i}`}
          {...r}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="6 8"
        />
      ))}
    </g>
  );
}

function VehicleMarker({
  vehicle: v,
  selected,
  onClick,
}: {
  vehicle: Vehicle;
  selected: boolean;
  onClick: () => void;
}) {
  const cx = v.x * 800;
  const cy = v.y * 500;
  const colors = markerColor[v.status];
  const r = 14;

  return (
    <g
      transform={`translate(${cx},${cy})`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      {/* Pulse ring for online */}
      {v.status === "online" && (
        <circle r={r + 6} fill={colors.ring} opacity={0.35}>
          <animate
            attributeName="r"
            values={`${r + 2};${r + 10};${r + 2}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.5;0;0.5"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Warn ring for noSignal */}
      {v.status === "noSignal" && (
        <circle r={r + 5} fill={colors.ring} opacity={0.4} />
      )}

      {/* Selection halo */}
      {selected && (
        <circle r={r + 8} fill="none" stroke="white" strokeWidth={2} opacity={0.7} />
      )}

      {/* Main marker */}
      <circle r={r} fill={colors.fill} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        style={{ userSelect: "none" }}
      >
        🚛
      </text>

      {/* Stale badge on marker */}
      {v.status === "noSignal" && (
        <StaleBadge lastSeen={v.lastPositionAt} cy={-r - 10} />
      )}

      {/* Vehicle name */}
      <text
        y={r + 14}
        textAnchor="middle"
        fontSize={10}
        fill="white"
        fontWeight="600"
        style={{ userSelect: "none", textShadow: "0 1px 2px #000" }}
      >
        {v.name}
      </text>
    </g>
  );
}

/** Floating "X min ago" badge rendered in SVG. */
function StaleBadge({ lastSeen, cy }: { lastSeen: number; cy: number }) {
  const [label, setLabel] = useState(() => timeAgo(lastSeen));

  useEffect(() => {
    const update = () => setLabel(timeAgo(lastSeen));
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [lastSeen]);

  const w = Math.max(label.length * 5.8 + 12, 72);

  return (
    <g transform={`translate(0,${cy})`}>
      <rect
        x={-w / 2}
        y={-10}
        width={w}
        height={18}
        rx={9}
        fill="#f59e0b"
        opacity={0.95}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight="700"
        fill="#78350f"
        style={{ userSelect: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

// ─── Side panel ──────────────────────────────────────────────────────────────

function VehiclePanel({
  vehicle: v,
  onClose,
}: {
  vehicle: Vehicle;
  onClose: () => void;
}) {
  const [relabel, setRelabel] = useState(() => timeAgo(v.lastPositionAt));
  const colors = markerColor[v.status];

  useEffect(() => {
    const update = () => setRelabel(timeAgo(v.lastPositionAt));
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [v.lastPositionAt]);

  return (
    <div className="w-64 flex-shrink-0 border-l border-gray-700 bg-gray-800 overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="font-semibold text-white text-sm">{v.name}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3 text-xs text-gray-300">
        {/* Status badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
            v.status === "online"
              ? "bg-emerald-900/40 text-emerald-300 ring-emerald-400/20"
              : v.status === "noSignal"
                ? "bg-amber-900/40 text-amber-300 ring-amber-400/20"
                : "bg-gray-700 text-gray-400 ring-gray-500/20",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              v.status === "online"
                ? "bg-emerald-400"
                : v.status === "noSignal"
                  ? "bg-amber-400"
                  : "bg-gray-500",
            )}
          />
          {v.status === "online"
            ? "Online"
            : v.status === "noSignal"
              ? "No Signal"
              : "Offline"}
        </span>

        <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
          <Row label="Driver" value={v.driver} />
          <Row label="Speed" value={v.status === "online" ? `${v.speed} km/h` : "—"} />
          <Row label="Heading" value={`${Math.round(v.heading)}°`} />
          <Row
            label="Last seen"
            value={relabel}
            highlight={v.status === "noSignal"}
          />
        </div>

        {v.status === "noSignal" && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-amber-300 text-xs">
            ⚠ GPS signal lost. Showing last known position. Check device connectivity.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={cn("font-medium tabular-nums", highlight && "text-amber-300")}>
        {value}
      </span>
    </div>
  );
}
