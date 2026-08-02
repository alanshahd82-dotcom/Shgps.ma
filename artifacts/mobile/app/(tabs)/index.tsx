/**
 * Map tab — delegates to FleetMap which has platform-specific implementations:
 *   - FleetMap.native.tsx: react-native-maps (iOS/Android)
 *   - FleetMap.tsx: vehicle grid overview (web)
 */
import React from 'react';
import { FleetMap } from '@/components/FleetMap';

export default function MapScreen() {
  return <FleetMap />;
}
