import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii } from '../../lib/theme.js';
import { sanitizePhone, toLocalPhone } from '../../lib/phone.js';
import GhanaFlag from './GhanaFlag.jsx';

// Ghana phone input: 10 digits starting with 0 (0551234567), or the 9 digits
// without it (551234567) - the leading 0 is added when the field loses focus.
export default function PhoneInput({ value, onChange, onBlur, error, placeholder = '055 123 4567', ...props }) {
  return (
    <View style={[styles.wrap, error && styles.wrapError]}>
      <View style={styles.prefix}>
        <GhanaFlag />
        <Text style={styles.prefixText}>GH</Text>
      </View>
      <TextInput
        keyboardType="phone-pad"
        value={value}
        maxLength={String(value || '').startsWith('0') || !value ? 10 : 9}
        onChangeText={(text) => onChange?.(sanitizePhone(text))}
        onBlur={(e) => {
          const local = toLocalPhone(value);
          if (local !== value) onChange?.(local);
          onBlur?.(e);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.slate400}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrapError: {
    borderColor: colors.red500,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: colors.slate200,
    height: '100%',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate700,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.slate900,
  },
});
