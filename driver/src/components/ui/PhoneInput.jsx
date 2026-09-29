import { Text, TextInput, View } from 'react-native';
import { colors, radii, themed } from '../../lib/theme.js';
import { sanitizePhone } from '../../lib/phone.js';
import GhanaFlag from './GhanaFlag.jsx';

// Ghana phone input with the flag and +233 in front. Takes the 10 digits with
// the leading 0 (0551234567) or the 9 digits without it (551234567); the 0 is
// added in the background when the number is sent (toLocalPhone), so the box
// keeps exactly what the driver typed. The length is capped by sanitizePhone,
// not by a changing maxLength, which some phones apply late and cut numbers
// short.
export default function PhoneInput({ value, onChange, error, placeholder = '055 123 4567', ...props }) {
  return (
    <View style={[styles.wrap, error && styles.wrapError]}>
      <View style={styles.prefix}>
        <GhanaFlag />
        <Text style={styles.prefixText}>+233</Text>
      </View>
      <TextInput
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        value={value}
        maxLength={16}
        onChangeText={(text) => onChange?.(sanitizePhone(text))}
        placeholder={placeholder}
        placeholderTextColor={colors.slate400}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = themed(() => ({
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
}));
