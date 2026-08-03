/**
 * Web fallback for FleetMap — shows a grid-based vehicle position overview
 * since react-native-maps doesn't run on web.
 *
 * #18: Shows a banner when the backend loses its Traccar connection.
 * #11: Hides the driver's own device from the fleet grid (ownDeviceId).
 */
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFleet } from '@/context/FleetContext';

const STATUS_COLORS = {
  online: '#3fb950',
  noSignal: '#d29922',
  offline: '#6e7681',
} as const;

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function FleetMap() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vehicles, connected, traccarConnected, ownDeviceId } = useFleet();

  // #11: Exclude the driver's own device from the fleet grid
  const fleetVehicles = ownDeviceId
    ? vehicles.filter((v) => v.id !== ownDeviceId)
    : vehicles;

  const staleCount = fleetVehicles.filter((v) => v.status === 'noSignal').length;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: topPad + 16,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Live Map</Text>
          <View style={[styles.badge, { backgroundColor: (connected ? colors.online : colors.offline) + '20' }]}>
            <View style={[styles.dot, { backgroundColor: connected ? colors.online : colors.offline }]} />
            <Text style={[styles.badgeText, { color: connected ? colors.online : colors.offline }]}>
              {connected ? 'Live' : 'Offline'}
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Scan the QR code in the URL bar to view the interactive map in Expo Go on your device.
        </Text>
      </View>

      {/* #18: Traccar disconnection banner */}
      {traccarConnected === false && (
        <View style={[styles.traccarBanner, { backgroundColor: colors.offline + '15', borderBottomColor: colors.offline + '30' }]}>
          <Feather name="cloud-off" size={13} color={colors.offline} />
          <Text style={[styles.traccarBannerText, { color: colors.offline }]}>
            GPS server unreachable — position data may be stale
          </Text>
        </View>
      )}

      {staleCount > 0 && (
        <View style={[styles.staleBanner, { backgroundColor: colors.warning + '15', borderBottomColor: colors.warning + '30' }]}>
          <Feather name="alert-triangle" size={13} color={colors.warning} />
          <Text style={[styles.staleText, { color: colors.warning }]}>
            {staleCount} vehicle{staleCount > 1 ? 's' : ''} not reporting GPS
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: Platform.OS === 'web' ? 34 + 60 : insets.bottom + 80 }]}
        bounces={false}
        overScrollMode="never"
      >
        {fleetVehicles.map((v) => {
          const color = STATUS_COLORS[v.status];
          return (
            <View
              key={v.id}
              style={[
                styles.vehicleCell,
                {
                  backgroundColor: colors.card,
                  borderColor: v.status === 'noSignal' ? colors.warning + '40' : colors.border,
                },
              ]}
            >
              <View style={[styles.markerCircle, { backgroundColor: color + '20' }]}>
                <Feather name="truck" size={20} color={color} />
              </View>
              <Text style={[styles.vName, { color: colors.foreground }]}>{v.name}</Text>
              <Text style={[styles.vDriver, { color: colors.mutedForeground }]} numberOfLines={1}>
                {v.driver === '—' ? 'Unassigned' : v.driver}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
                <View style={[styles.pillDot, { backgroundColor: color }]} />
                <Text style={[styles.pillText, { color }]}>
                  {v.status === 'online' ? 'Online' : v.status === 'noSignal' ? 'No Signal' : 'Offline'}
                </Text>
              </View>
              {v.status === 'online' && (
                <Text style={[styles.vSpeed, { color: colors.mutedForeground }]}>{v.speed} km/h</Text>
              )}
              {v.status === 'noSignal' && (
                <Text style={[styles.vSpeed, { color: colors.warning }]}>{timeAgo(v.lastPositionAt)}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  traccarBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1,
  },
  traccarBannerText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  staleBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  staleText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  grid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vehicleCell: {
    width: 160, borderRadius: 14, borderWidth: 1,
    padding: 14, gap: 6, alignItems: 'center',
  },
  markerCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  vName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  vDriver: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  vSpeed: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
