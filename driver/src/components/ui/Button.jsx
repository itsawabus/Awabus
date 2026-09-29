import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii } from '../../lib/theme.js';

const VARIANT_STYLES = {
  primary: { bg: colors.navy, text: colors.white },
  auth: { bg: colors.brand300, text: colors.navy },
  outline: { bg: colors.white, text: colors.brand700, border: colors.brand600 },
  danger: { bg: colors.red600, text: colors.white },
  ghost: { bg: 'transparent', text: colors.slate600 },
  link: { bg: 'transparent', text: colors.brand600 },
};

const SIZE_STYLES = {
  sm: { height: 40, paddingHorizontal: 14, fontSize: 14 },
  md: { height: 52, paddingHorizontal: 18, fontSize: 16 },
  lg: { height: 56, paddingHorizontal: 22, fontSize: 16 },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  children,
  style,
  textStyle,
}) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isLink = variant === 'link';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        !isLink && {
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: radii.lg,
          backgroundColor: v.bg,
          borderWidth: v.border ? 2 : 0,
          borderColor: v.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled || loading ? 0.6 : pressed ? 0.85 : 1,
        },
        isLink && { opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={v.text} />}
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '700',
  },
});
