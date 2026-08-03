/**
 * Vehicles tab — scrollable fleet device list with status, speed, and last-seen.
 *
 * #11: Tags the driver's own device as "Your Device" instead of hiding it,
 *      so dispatchers who are also drivers still see the full fleet.
 * #18: Shows Traccar connection status alongside the WS badge.
 */

import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFleet } from '@/context/FleetContext';
import { VehicleCard } from '@/components/VehicleCard';

export default function VehiclesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vehicles, connected, traccarConnected, ownDeviceId, refresh } = useFleet();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = vehicles.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.driver.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    online: vehicles.filter((v) => v.status === 'online').length,
    noSignal: vehicles.filter((v) => v.status === 'noSignal').length,
    offline: vehicles.filter((v) => v.status === 'offline').length,
  };

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1500);
  };

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
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Fleet</Text>
            <View style={styles.countsRow}>
              <CountPill count={counts.online} label="online" color={colors.online} />
              {counts.noSignal > 0 && (
                <CountPill count={counts.noSignal} label="no signal" color={colors.warning} />
              )}
              <CountPill count={counts.offline} label="offline" color={colors.offline} />
            </View>
          </View>
          {/* Connection badges — WS + Traccar (#18) */}
          <View style={styles.badges}>
            <View
              style={[
                styles.wsIndicator,
                { backgroundColor: (connected ? colors.online : colors.offline) + '20' },
              ]}
            >
              <View
                style={[
                  styles.wsDot,
                  { backgroundColor: connected ? colors.online : colors.offline },
                ]}
              />
              <Text
                style={[
                  styles.wsLabel,
                  { color: connected ? colors.online : colors.offline },
                ]}
              >
                {connected ? 'Live' : 'Offline'}
              </Text>
            </View>
            {/* #18: Traccar health indicator */}
            {traccarConnected === false && (
              <View style={[styles.wsIndicator, { backgroundColor: colors.offline + '20' }]}>
                <Feather name="cloud-off" size={10} color={colors.offline} />
                <Text style={[styles.wsLabel, { color: colors.offline }]}>GPS off</Text>
              </View>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search vehicles or drivers…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {search.length > 0 && (
            <Feather
              name="x"
              size={15}
              color={colors.mutedForeground}
              onPress={() => setSearch('')}
            />
          )}
        </View>
      </View>

      {/* #18: Traccar disconnected banner */}
      {traccarConnected === false && (
        <View
          style={[
            styles.traccarBanner,
            { backgroundColor: colors.offline + '15', borderBottomColor: colors.offline + '30' },
          ]}
        >
          <Feather name="cloud-off" size={13} color={colors.offline} />
          <Text style={[styles.traccarText, { color: colors.offline }]}>
            GPS server unreachable — position data may be stale
          </Text>
        </View>
      )}

      {/* Stale banner */}
      {counts.noSignal > 0 && (
        <View
          style={[
            styles.staleBanner,
            { backgroundColor: colors.warning + '15', borderBottomColor: colors.warning + '30' },
          ]}
        >
          <Feather name="alert-triangle" size={13} color={colors.warning} />
          <Text style={[styles.staleText, { color: colors.warning }]}>
            <Text style={{ fontFamily: 'Inter_700Bold' }}>{counts.noSignal}</Text>{' '}
            vehicle{counts.noSignal > 1 ? 's have' : ' has'} not reported GPS in over 5 minutes
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(v) => v.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 34 + 60 : insets.bottom + 80 },
        ]}
        scrollEnabled={!!filtered.length}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <VehicleCard
            vehicle={item}
            isOwnDevice={!!ownDeviceId && item.id === ownDeviceId}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="truck" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No vehicles found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {search ? 'Try a different search term.' : 'Waiting for vehicle data…'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function CountPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '20' }]}>
      <Text style={[styles.pillText, { color }]}>
        {count} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
  },
  countsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  pillText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  badges: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  wsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  wsDot: { width: 6, height: 6, borderRadius: 3 },
  wsLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  traccarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  traccarText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  staleText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 0,
  },
  separator: { height: 8 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
