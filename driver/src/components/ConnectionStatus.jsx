import { Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import Badge from './ui/Badge.jsx';
import { useConnectionStore } from '../store/connectionStore.js';
import { useLocationStatusStore, busOnlineFrom, busOfflineReason } from '../store/locationStatusStore.js';
import { colors, radii, themed } from '../lib/theme.js';

/** The driver's two readings, the same ones the school sees. */
export function useConnectionStatus() {
  const isOnline = useConnectionStore((s) => s.isOnline);
  const location = useLocationStatusStore((s) => s.state);
  const busOnline = busOnlineFrom(location, isOnline);
  return { isOnline, location, busOnline, reason: busOnline ? '' : busOfflineReason(location, isOnline) };
}

/**
 * "Online / Offline" (mobile data: the app reaches the school) and
 * "Bus online / Bus offline" (location on and being read).
 */
export function ConnectionBadges({ style }) {
  const { isOnline, busOnline } = useConnectionStatus();
  return (
    <View style={[styles.badges, style]}>
      <Badge tone={isOnline ? 'success' : 'neutral'}>{isOnline ? 'Driver online' : 'Driver offline'}</Badge>
      <Badge tone={busOnline ? 'success' : 'warning'}>{busOnline ? 'Bus online' : 'Bus offline'}</Badge>
    </View>
  );
}

/** A warning saying whether data or location is off, shown only when the bus is offline. */
export function BusOfflineBanner({ style }) {
  const { busOnline, reason, location } = useConnectionStatus();
  if (busOnline || location === 'unknown' || !reason) return null;
  return (
    <View style={[styles.banner, style]}>
      <AlertTriangle size={16} color={colors.amber800} />
      <Text style={styles.bannerText}>Bus offline. {reason}</Text>
    </View>
  );
}

const styles = themed(() => ({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  banner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: colors.warnBorder,
    borderRadius: radii.lg,
    padding: 12,
  },
  bannerText: { flex: 1, color: colors.amber800, fontSize: 13, lineHeight: 18 },
}));
