/**
 * VehicleCard
 *
 * #11: Accepts `isOwnDevice` to label the driver's own device distinctly.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Vehicle, DeviceStatus } from '@/context/FleetContext';

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColors(status: DeviceStatus, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case 'online':
      return { dot: colors.online, bg: colors.online + '20', label: 'Online', text: colors.online };
    case 'noSignal':
      return { dot: colors.warning, bg: colors.warning + '20', label: 'No Signal', text: colors.warning };
    case 'offline':
      return { dot: colors.offline, bg: colors.muted, label: 'Offline', text: colors.mutedForeground };
  }
}

interface VehicleCardProps {
  vehicle: Vehicle;
  /** When true, renders a "Your Device" tag — the viewer is this vehicle's driver. (#11) */
  isOwnDevice?: boolean;
}

export function VehicleCard({ vehicle: v, isOwnDevice = false }: VehicleCardProps) {
  const colors = useColors();
  const s = statusColors(v.status, colors);
  const isStale = v.status === 'noSignal';
  const isOffline = v.status === 'offline';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isStale ? colors.warning + '50' : colors.border,
        },
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: s.bg }]}>
        <Feather
          name={isOwnDevice ? 'navigation' : 'truck'}
          size={18}
          color={s.dot}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.row}>
          <Text
            style={[
              styles.name,
              { color: isOffline ? colors.mutedForeground : colors.foreground },
            ]}
            numberOfLines={1}
          >
            {v.name}
          </Text>
          {/* #11: Tag own device */}
          {isOwnDevice && (
            <View style={[styles.ownTag, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.ownTagText, { color: colors.primary }]}>You</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <View style={[styles.dot, { backgroundColor: s.dot }]} />
            <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {isOwnDevice ? 'Your device' : (v.driver === '—' ? 'Unassigned' : v.driver)}
          </Text>
        </View>
      </View>

      {/* Right */}
      <View style={styles.right}>
        {v.status === 'online' ? (
          <>
            <Text style={[styles.speed, { color: colors.foreground }]}>{v.speed}</Text>
            <Text style={[styles.speedUnit, { color: colors.mutedForeground }]}>km/h</Text>
          </>
        ) : isStale ? (
          <Text style={[styles.lastSeen, { color: colors.warning }]}>{timeAgo(v.lastPositionAt)}</Text>
        ) : (
          <Text style={[styles.lastSeen, { color: colors.mutedForeground }]}>Offline</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  name: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
  },
  ownTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
    flexShrink: 0,
  },
  ownTagText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    flexShrink: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  speed: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
  },
  speedUnit: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  lastSeen: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
