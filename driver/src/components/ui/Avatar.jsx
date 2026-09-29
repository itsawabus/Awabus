import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme.js';
import { initials } from '../../lib/utils.js';

const SIZES = { sm: 36, md: 48, lg: 64 };

export default function Avatar({ name, src, size = 'md', style }) {
  const dimension = SIZES[size];
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={[{ width: dimension, height: dimension, borderRadius: dimension / 2 }, style]}
      />
    );
  }
  return (
    <View
      style={[
        styles.circle,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: dimension * 0.36 }]}>{initials(name) || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.brand500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontWeight: '700',
  },
});
