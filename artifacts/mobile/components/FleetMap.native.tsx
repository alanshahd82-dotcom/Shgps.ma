/**
 * Native (iOS/Android) map implementation — uses react-native-maps.
 * Imported only on native platforms via .native.tsx extension.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFleet, type Vehicle } from '@/context/FleetContext';

const STATUS_COLORS = {
  online: '#3fb950',
  noSignal: '#d29922',
  offline: '#6e7681',
} as const;

export function FleetMap() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vehicles, connected } = useFleet();
  const mapRef = useRef<MapView>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedVehicle = vehicles.find((v) => v.id === selected) ?? null;

  const handleMarkerPress = useCallback((id: string) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

  const fitAll = useCallback(() => {
    const coords = vehicles
      .filter((v) => v.status !== 'offline')
      .map((v) => ({ latitude: v.lat, longitude: v.lng }));
    if (coords.length > 0) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, bottom: 160, left: 40, right: 40 },
        animated: true,
      });
    }
  }, [vehicles]);

  const staleCount = vehicles.filter((v) => v.status === 'noSignal').length;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 40.7282,
          longitude: -73.994,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
      >
        {vehicles.map((v) => (
          <VehicleMarker
            key={v.id}
            vehicle={v}
            selected={selected === v.id}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

      {/* HUD */}
      <View
        style={[
          styles.hud,
          {
            top: insets.top + 12,
            backgroundColor: colors.card + 'e0',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.hudLeft}>
          <View style={[styles.liveDot, { backgroundColor: connected ? colors.online : colors.offline }]} />
          <Text style={[styles.hudText, { color: colors.foreground }]}>
            {connected ? 'Live' : 'Reconnecting…'}
          </Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={[styles.hudCount, { color: colors.online }]}>
            {vehicles.filter((v) => v.status === 'online').length} online
          </Text>
          {staleCount > 0 && (
            <Text style={[styles.hudCount, { color: colors.warning }]}>
              {staleCount} no signal
            </Text>
          )}
        </View>
      </View>

      {staleCount > 0 && (
        <View
          style={[
            styles.staleBanner,
            {
              top: insets.top + 60,
              backgroundColor: colors.warning + '20',
              borderColor: colors.warning + '40',
            },
          ]}
        >
          <Feather name="alert-triangle" size={13} color={colors.warning} />
          <Text style={[styles.staleText, { color: colors.warning }]}>
            {staleCount} vehicle{staleCount > 1 ? 's' : ''} not reporting GPS
          </Text>
        </View>
      )}

      <Pressable
        onPress={fitAll}
        style={({ pressed }) => [
          styles.fitBtn,
          {
            bottom: insets.bottom + 80,
            right: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="maximize-2" size={18} color={colors.foreground} />
      </Pressable>

      {selectedVehicle && (
        <VehicleDetailCard
          vehicle={selectedVehicle}
          onClose={() => setSelected(null)}
          colors={colors}
          insets={insets}
        />
      )}
    </View>
  );
}

function VehicleMarker({
  vehicle: v,
  selected,
  onPress,
}: {
  vehicle: Vehicle;
  selected: boolean;
  onPress: (id: string) => void;
}) {
  const color = STATUS_COLORS[v.status];
  return (
    <Marker
      coordinate={{ latitude: v.lat, longitude: v.lng }}
      onPress={() => onPress(v.id)}
      tracksViewChanges={false}
    >
      <View style={[styles.markerOuter, selected && styles.markerSelected]}>
        <View style={[styles.markerInner, { backgroundColor: color }]}>
          <Feather name="truck" size={12} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

function VehicleDetailCard({
  vehicle: v,
  onClose,
  colors,
  insets,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  function timeAgo(ts: number) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  const statusColor = STATUS_COLORS[v.status];

  return (
    <View
      style={[
        styles.detailCard,
        {
          bottom: insets.bottom + 80,
          marginHorizontal: 16,
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.detailHeader}>
        <View style={styles.detailTitle}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.detailName, { color: colors.foreground }]}>{v.name}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={styles.detailRow}>
        <DetailItem label="Driver" value={v.driver === '—' ? 'Unassigned' : v.driver} colors={colors} />
        <DetailItem label="Speed" value={v.status === 'online' ? `${v.speed} km/h` : '—'} colors={colors} />
        <DetailItem
          label="Last seen"
          value={timeAgo(v.lastPositionAt)}
          colors={colors}
          highlight={v.status === 'noSignal'}
          highlightColor={colors.warning}
        />
      </View>
      {v.status === 'noSignal' && (
        <View style={[styles.staleNotice, { backgroundColor: colors.warning + '20' }]}>
          <Feather name="wifi-off" size={12} color={colors.warning} />
          <Text style={[styles.staleNoticeText, { color: colors.warning }]}>
            GPS signal lost — showing last known position
          </Text>
        </View>
      )}
    </View>
  );
}

function DetailItem({
  label, value, colors, highlight, highlightColor,
}: {
  label: string; value: string; colors: ReturnType<typeof useColors>;
  highlight?: boolean; highlightColor?: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: highlight ? highlightColor : colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  hud: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  hudLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  hudText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hudRight: { flexDirection: 'row', gap: 12 },
  hudCount: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  staleBanner: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
  },
  staleText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  fitBtn: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  markerOuter: { padding: 3, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  markerSelected: { borderColor: '#fff', shadowColor: '#fff', shadowOpacity: 0.6, shadowRadius: 4 },
  markerInner: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailCard: {
    position: 'absolute', left: 0, right: 0,
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  detailName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailItem: { alignItems: 'center', gap: 2 },
  detailLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  detailValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  staleNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  staleNoticeText: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 },
});
