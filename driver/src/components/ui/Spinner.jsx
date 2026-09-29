import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme.js';

export default function Spinner({ size = 'small', color = colors.brand500 }) {
  return <ActivityIndicator size={size} color={color} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.brand500} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 96,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate400,
  },
});
