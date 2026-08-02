/**
 * Alerts tab — shows the alert history (stale events, geofence crossings, etc.)
 * and the current notification & location permission status.
 */

import React from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFleet, type FleetAlert } from '@/context/FleetContext';
import { useNotifications } from '@/context/NotificationContext';

function timeLabel(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

type AlertMeta = { iconName: React.ComponentProps<typeof Feather>['name']; iconColor: string; borderTint: string };

function useAlertMeta(type: FleetAlert['type'], colors: ReturnType<typeof useColors>): AlertMeta {
  switch (type) {
    case 'stale':
      return { iconName: 'wifi-off', iconColor: colors.warning, borderTint: colors.warning + '30' };
    case 'geofence_enter':
      return { iconName: 'log-in', iconColor: colors.primary, borderTint: colors.primary + '30' };
    case 'geofence_exit':
      return { iconName: 'log-out', iconColor: '#F97316', borderTint: '#F9731630' };
    default:
      return { iconName: 'check-circle', iconColor: colors.online, borderTint: colors.border };
  }
}

function AlertRow({ alert: a }: { alert: FleetAlert }) {
  const colors = useColors();
  const { iconName, iconColor, borderTint } = useAlertMeta(a.type, colors);

  return (
    <View
      style={[
        styles.alertRow,
        {
          backgroundColor: colors.card,
          borderColor: borderTint,
        },
      ]}
    >
      <View style={[styles.alertIcon, { backgroundColor: iconColor + '20' }]}>
        <Feather name={iconName} size={16} color={iconColor} />
      </View>
      <View style={styles.alertBody}>
        <Text style={[styles.alertTitle, { color: colors.foreground }]} numberOfLines={2}>
          {a.message}
        </Text>
        <Text style={[styles.alertTime, { color: colors.mutedForeground }]}>{timeLabel(a.ts)}</Text>
      </View>
    </View>
  );
}

function PermissionsCard() {
  const colors = useColors();
  const { locationGranted, backgroundLocationGranted, notificationsGranted, requestPermissions } =
    useNotifications();

  const allGranted = locationGranted && backgroundLocationGranted && notificationsGranted;
  if (allGranted) return null;

  return (
    <View
      style={[
        styles.permCard,
        { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' },
      ]}
    >
      <Feather name="shield" size={18} color={colors.primary} />
      <View style={styles.permBody}>
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Enable background tracking</Text>
        <Text style={[styles.permText, { color: colors.mutedForeground }]}>
          Grant location &amp; notifications so the app can track your vehicle and alert you when offline.
        </Text>
        <View style={styles.permStatus}>
          <PermItem granted={locationGranted} label="Foreground location" colors={colors} />
          <PermItem granted={backgroundLocationGranted} label="Background location" colors={colors} />
          <PermItem granted={notificationsGranted} label="Notifications" colors={colors} />
        </View>
      </View>
      <Pressable
        onPress={requestPermissions}
        style={({ pressed }) => [
          styles.permBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>Grant</Text>
      </Pressable>
    </View>
  );
}

function PermItem({
  granted,
  label,
  colors,
}: {
  granted: boolean;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.permItem}>
      <Feather
        name={granted ? 'check-circle' : 'circle'}
        size={13}
        color={granted ? colors.online : colors.mutedForeground}
      />
      <Text style={[styles.permItemText, { color: granted ? colors.foreground : colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alerts, clearAlerts } = useFleet();
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
          <Text style={[styles.title, { color: colors.foreground }]}>Alerts</Text>
          {alerts.length > 0 && (
            <Pressable
              onPress={clearAlerts}
              style={({ pressed }) => [styles.clearBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear all</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 34 + 60 : insets.bottom + 80 },
        ]}
        scrollEnabled={!!alerts.length}
        bounces={false}
        overScrollMode="never"
        ListHeaderComponent={<PermissionsCard />}
        renderItem={({ item }) => <AlertRow alert={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bell-off" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No alerts</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Alerts appear here when a vehicle goes stale or crosses a geofence boundary.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
  },
  clearBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  clearText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  permCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  permBody: { flex: 1, gap: 6 },
  permTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  permText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  permStatus: { gap: 4 },
  permItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  permItemText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  permBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  permBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16, gap: 0 },
  separator: { height: 8 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  alertBody: { flex: 1, gap: 3 },
  alertTitle: { fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  alertTime: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 280 },
});
