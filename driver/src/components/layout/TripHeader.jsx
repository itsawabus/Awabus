import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../../lib/theme.js';
import { formatClock } from '../../lib/utils.js';

export default function TripHeader({ status, isOnline, subtitle, elapsedSeconds }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{status}</Text>
            <View style={[styles.pill, { backgroundColor: isOnline ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)' }]}>
              <Text style={styles.pillText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
            </View>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text style={styles.timer}>{formatClock(elapsedSeconds)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  timer: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
});
