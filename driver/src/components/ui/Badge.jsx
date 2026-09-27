import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../lib/theme.js';

const TONES = {
  success: { bg: colors.emerald50, text: colors.emerald700 },
  danger: { bg: colors.red50, text: colors.red600 },
  warning: { bg: colors.amber50, text: colors.amber700 },
  neutral: { bg: colors.slate100, text: colors.slate600 },
  brand: { bg: 'rgba(255,255,255,0.18)', text: colors.white },
};

export default function Badge({ children, tone = 'success', style }) {
  const t = TONES[tone] || TONES.success;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.text, { color: t.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
