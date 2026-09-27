import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, radii } from '../../lib/theme.js';

export const Label = ({ children, style }) => <Text style={[styles.label, style]}>{children}</Text>;

export const FieldError = ({ children }) => (children ? <Text style={styles.error}>{children}</Text> : null);

export const Input = forwardRef(({ style, error, ...props }, ref) => (
  <TextInput
    ref={ref}
    placeholderTextColor={colors.slate400}
    style={[styles.input, error && styles.inputError, style]}
    {...props}
  />
));
Input.displayName = 'Input';

export const PasswordInput = forwardRef(({ style, error, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordWrap}>
      <TextInput
        ref={ref}
        secureTextEntry={!visible}
        placeholderTextColor={colors.slate400}
        style={[styles.input, { paddingRight: 44 }, error && styles.inputError, style]}
        {...props}
      />
      <Pressable onPress={() => setVisible((v) => !v)} style={styles.eyeButton} hitSlop={10}>
        {visible ? <EyeOff size={20} color={colors.slate400} /> : <Eye size={20} color={colors.slate400} />}
      </Pressable>
    </View>
  );
});
PasswordInput.displayName = 'PasswordInput';

export const Textarea = forwardRef(({ style, error, ...props }, ref) => (
  <TextInput
    ref={ref}
    multiline
    textAlignVertical="top"
    placeholderTextColor={colors.slate400}
    style={[styles.input, styles.textarea, error && styles.inputError, style]}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 6,
  },
  error: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.red500,
    marginTop: 6,
  },
  input: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.slate900,
  },
  inputError: {
    borderColor: colors.red500,
  },
  textarea: {
    height: 96,
    paddingTop: 12,
    paddingBottom: 12,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
  },
});

export default Input;
