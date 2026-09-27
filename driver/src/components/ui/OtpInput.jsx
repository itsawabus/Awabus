import { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radii } from '../../lib/theme.js';

export default function OtpInput({ length = 6, value, onChange, error }) {
  const refs = useRef([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const setDigit = (i, char) => {
    const next = [...digits];
    next[i] = char;
    onChange(next.join(''));
  };

  const handleChange = (i, text) => {
    const char = text.replace(/\D/g, '').slice(-1);
    setDigit(i, char);
    if (char && refs.current[i + 1]) refs.current[i + 1].focus();
  };

  const handleKeyPress = (i, e) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[i] && refs.current[i - 1]) {
      refs.current[i - 1].focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChangeText={(text) => handleChange(i, text)}
          onKeyPress={(e) => handleKeyPress(i, e)}
          keyboardType="number-pad"
          maxLength={1}
          style={[styles.box, error && styles.boxError]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  box: {
    height: 56,
    width: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.slate900,
  },
  boxError: {
    borderColor: colors.red500,
  },
});
