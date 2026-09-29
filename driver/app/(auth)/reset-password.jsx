import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import AuthLayout from '../../src/components/layout/AuthLayout.jsx';
import { PasswordInput, Label, FieldError } from '../../src/components/ui/Input.jsx';
import Button from '../../src/components/ui/Button.jsx';
import { resetPassword } from '../../src/api/driverApp.js';
import { useResetFlowStore } from '../../src/store/resetFlowStore.js';
import { colors } from '../../src/lib/theme.js';

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'At least one uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'number', label: 'At least one number', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'At least one special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function ResetPassword() {
  const { resetToken, clear } = useResetFlowStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resetToken) router.replace('/forgot-password');
  }, [resetToken]);

  const allValid = useMemo(() => RULES.every((r) => r.test(password)), [password]);

  const mutation = useMutation({
    mutationFn: () => resetPassword(resetToken, password),
    onSuccess: () => {
      clear();
      router.replace('/reset-success');
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = () => {
    setError('');
    if (!allValid) {
      setError('Please meet all password requirements');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    mutation.mutate();
  };

  return (
    <AuthLayout>
      <Text style={styles.title}>Create new password</Text>
      <Text style={styles.subtitle}>Create a secure new password for your driver account</Text>

      <View style={styles.field}>
        <Label>New password</Label>
        <PasswordInput value={password} onChangeText={setPassword} />
      </View>
      <View style={styles.field}>
        <Label>Confirm password</Label>
        <PasswordInput value={confirm} onChangeText={setConfirm} />
        <FieldError>{error}</FieldError>
      </View>

      <View style={styles.rules}>
        {RULES.map((r) => {
          const passed = r.test(password);
          return (
            <View key={r.key} style={styles.ruleRow}>
              <View style={[styles.ruleDot, passed && styles.ruleDotActive]}>
                {passed && <Check size={12} color={colors.brand600} />}
              </View>
              <Text style={[styles.ruleText, passed && styles.ruleTextActive]}>{r.label}</Text>
            </View>
          );
        })}
      </View>

      <Button variant="auth" loading={mutation.isPending} onPress={handleSubmit}>
        Reset password
      </Button>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.slate900 },
  subtitle: { marginTop: 4, fontSize: 15, color: colors.slate500, marginBottom: 20 },
  field: { marginBottom: 18 },
  rules: { marginBottom: 24, gap: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleDotActive: { backgroundColor: colors.brand100 },
  ruleText: { fontSize: 13, color: colors.slate400 },
  ruleTextActive: { color: colors.brand700, fontWeight: '600' },
});
