import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { readLastCrash, clearLastCrash } from '../lib/crashLog.js';
import { colors, radii } from '../lib/theme.js';

/** "The app closed unexpectedly last time", with the reason, until dismissed. */
export default function LastCrashNotice({ style }) {
  const [crash, setCrash] = useState(null);
  useEffect(() => {
    readLastCrash().then(setCrash);
  }, []);
  if (!crash) return null;
  return (
    <View style={[styles.box, style]}>
      <AlertTriangle size={16} color={colors.amber800} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>The app closed unexpectedly last time</Text>
        <Text style={styles.text} selectable>
          {crash.message}
        </Text>
        <Text style={styles.hint}>Please send this message to the AwaBus team.</Text>
        <Pressable
          onPress={() => {
            clearLastCrash();
            setCrash(null);
          }}
          hitSlop={8}
        >
          <Text style={styles.dismiss}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 8, backgroundColor: colors.amber50, borderWidth: 1, borderColor: colors.warnBorder, borderRadius: radii.lg, padding: 12 },
  title: { fontSize: 13, fontWeight: '800', color: colors.amber800 },
  text: { fontSize: 12, color: colors.amber800, marginTop: 4 },
  hint: { fontSize: 11, color: colors.amber700, marginTop: 4 },
  dismiss: { fontSize: 13, fontWeight: '700', color: colors.brand600, marginTop: 6 },
});
