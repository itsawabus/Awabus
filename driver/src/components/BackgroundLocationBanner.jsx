import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import Button from './ui/Button.jsx';
import { backgroundPermission, askBackgroundPermission } from '../lib/backgroundLocation.js';
import { useLiveGpsStore } from '../store/liveGpsStore.js';
import { colors, radii, themed } from '../lib/theme.js';

/**
 * Asks the driver to set location to "Allow all the time", so the school
 * keeps seeing the bus with the screen off or another app open. Shows only
 * while that isn't allowed yet (checked again whenever the app comes back to
 * the front, e.g. after the phone settings).
 */
export default function BackgroundLocationBanner({ style }) {
  const [permission, setPermission] = useState('unknown');
  const [asking, setAsking] = useState(false);
  const background = useLiveGpsStore((s) => s.background);
  const backgroundError = useLiveGpsStore((s) => s.backgroundError);

  const check = useCallback(async () => {
    const now = await backgroundPermission();
    setPermission(now);
    // Allowed while a trip runs: start the screen-off tracking straight away.
    const { background: bg, setBackground } = useLiveGpsStore.getState();
    if (now === 'granted' && bg === 'no_permission') setBackground('retry');
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (Platform.OS === 'web' || permission === 'unknown' || permission === 'unavailable') return null;

  if (permission === 'granted') {
    if (background !== 'failed') return null;
    return (
      <View style={[styles.box, style]}>
        <View style={styles.row}>
          <MapPin size={18} color={colors.amber800} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Screen-off tracking could not start</Text>
            <Text style={styles.text}>Keep the AwaBus app open during the trip so the school can see the bus.</Text>
            {backgroundError ? <Text style={styles.steps}>Phone says: {backgroundError}</Text> : null}
          </View>
        </View>
        <Button size="sm" variant="outline" onPress={() => useLiveGpsStore.getState().setBackground('retry')} style={{ marginTop: 10 }}>
          Try again
        </Button>
      </View>
    );
  }

  const allow = async () => {
    setAsking(true);
    await askBackgroundPermission();
    setAsking(false);
    check();
  };

  return (
    <View style={[styles.box, style]}>
      <View style={styles.row}>
        <MapPin size={18} color={colors.amber800} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Allow location "All the time"</Text>
          <Text style={styles.text}>
            So the school and parents keep seeing the bus when your screen is off or you open another app. AwaBus only uses
            it while a trip is running
            {Platform.OS === 'android' ? ', and shows a notification the whole time' : ''}.
          </Text>
          {permission === 'blocked' || Platform.OS === 'ios' ? (
            <Text style={styles.steps}>In the settings, tap Location, then choose "Allow all the time"{Platform.OS === 'ios' ? ' ("Always")' : ''}.</Text>
          ) : null}
        </View>
      </View>
      <Button
        size="sm"
        loading={asking}
        onPress={permission === 'blocked' ? () => Linking.openSettings().catch(() => {}) : allow}
        style={{ marginTop: 10 }}
      >
        {permission === 'blocked' ? 'Open settings' : 'Allow all the time'}
      </Button>
    </View>
  );
}

const styles = themed(() => ({
  box: { backgroundColor: colors.amber50, borderWidth: 1, borderColor: colors.warnBorder, borderRadius: radii.lg, padding: 12 },
  row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 14, fontWeight: '800', color: colors.amber800 },
  text: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.amber800, marginTop: 2 },
  steps: { fontSize: 12, color: colors.amber800, marginTop: 6, fontWeight: '700' },
}));
