import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themed } from '../../lib/theme.js';
import { formatClock } from '../../lib/utils.js';
import ThemeButton from '../ThemeButton.jsx';

// Good morning / afternoon / evening, by the phone's clock.
export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// The bar's colour is the connection status: green while the network is good,
// yellow when it is lost or poor.
const LOOK = {
  ok: { bg: '#15803d', text: '#ffffff' },
  poor: { bg: '#facc15', text: '#422006' },
};

export default function TripHeader({ driverName, networkOk = true, elapsedSeconds }) {
  const insets = useSafeAreaInsets();
  const look = networkOk ? LOOK.ok : LOOK.poor;
  return (
    <View
      style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: look.bg }]}
      testID="trip-header"
      accessibilityLabel={networkOk ? 'Network good' : 'Network poor or lost'}
    >
      <View style={styles.row}>
        <ThemeButton color={look.text} style={{ marginLeft: -8, marginRight: 4 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: look.text }]}>{greeting()}{driverName ? ',' : ''}</Text>
          {driverName ? (
            <Text style={[styles.title, { color: look.text }]} numberOfLines={1}>
              {driverName}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.timer, { color: look.text }]}>{formatClock(elapsedSeconds)}</Text>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hello: { fontSize: 14, fontWeight: '700', opacity: 0.9 },
  title: { fontSize: 20, fontWeight: '800' },
  timer: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
}));
