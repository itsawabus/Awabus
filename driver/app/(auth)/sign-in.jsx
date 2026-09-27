import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Check, WifiOff } from 'lucide-react-native';
import AuthLayout from '../../src/components/layout/AuthLayout.jsx';
import PhoneInput from '../../src/components/ui/PhoneInput.jsx';
import { PasswordInput, Label, FieldError } from '../../src/components/ui/Input.jsx';
import Button from '../../src/components/ui/Button.jsx';
import { checkPhone, login as loginApi, setPassword as setPasswordApi } from '../../src/api/driverApp.js';
import { formatPhone, isValidPhone, toLocalPhone } from '../../src/lib/phone.js';
import { useAuthStore } from '../../src/store/authStore.js';
import { colors, radii } from '../../src/lib/theme.js';

const MAX_TRIES = 6;

const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'At least one uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'number', label: 'At least one number', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'At least one special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function SignIn() {
  const setAuth = useAuthStore((s) => s.setAuth);

  // 'phone' -> check whether this number has an account & a password yet.
  // 'password' -> existing driver, ask for their password.
  // 'create' -> driver record exists but has never set a password.
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null); // { kind: 'lookup' | 'network', message }

  const [password, setPassword] = useState('');
  const [error, setError] = useState(null); // { kind: 'credentials' | 'network', message }
  const [triesLeft, setTriesLeft] = useState(MAX_TRIES);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createError, setCreateError] = useState('');

  // Sent as 0XXXXXXXXX; the server normalizes it to +233XXXXXXXXX.
  const fullPhone = toLocalPhone(phone);
  const phoneValid = isValidPhone(phone);

  const checkPhoneMutation = useMutation({
    mutationFn: () => checkPhone(fullPhone),
    onSuccess: (data) => {
      setStep(data.hasPassword ? 'password' : 'create');
    },
    onError: (err) => {
      if (err.isNetworkError) {
        setPhoneError({ kind: 'network', message: err.message });
        return;
      }
      setPhoneError({ kind: 'lookup', message: err.message });
    },
  });

  const loginMutation = useMutation({
    mutationFn: () => loginApi(fullPhone, password),
    onSuccess: async (data) => {
      await setAuth(data);
      router.replace('/');
    },
    onError: (err) => {
      if (err.isNetworkError) {
        setError({ kind: 'network', message: err.message });
        return;
      }
      const remaining = Math.max(triesLeft - 1, 0);
      setTriesLeft(remaining);
      setError({
        kind: 'credentials',
        message:
          remaining > 0
            ? `Wrong password. You have ${remaining} ${remaining === 1 ? 'try' : 'tries'} left.`
            : 'Too many failed attempts. Please try again later or reset your password.',
      });
    },
  });

  const createPasswordMutation = useMutation({
    mutationFn: () => setPasswordApi(fullPhone, newPassword),
    onSuccess: async (data) => {
      await setAuth(data);
      router.replace('/');
    },
    onError: (err) => setCreateError(err.message),
  });

  const allRulesValid = useMemo(() => PASSWORD_RULES.every((r) => r.test(newPassword)), [newPassword]);

  const backToPhone = () => {
    setStep('phone');
    setPassword('');
    setError(null);
    setTriesLeft(MAX_TRIES);
    setNewPassword('');
    setConfirmPassword('');
    setCreateError('');
  };

  const handlePhoneSubmit = () => {
    setPhoneError(null);
    if (!phoneValid) return;
    checkPhoneMutation.mutate();
  };

  const handlePasswordSubmit = () => {
    setError(null);
    if (!password) return;
    loginMutation.mutate();
  };

  const handleCreateSubmit = () => {
    setCreateError('');
    if (!allRulesValid) {
      setCreateError('Please meet all password requirements');
      return;
    }
    if (newPassword !== confirmPassword) {
      setCreateError('Passwords do not match');
      return;
    }
    createPasswordMutation.mutate();
  };

  if (step === 'phone') {
    return (
      <AuthLayout>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Enter your phone number to continue</Text>

        <View style={styles.field}>
          <Label>Phone Number</Label>
          <PhoneInput value={phone} onChange={setPhone} />
        </View>

        {phoneError && (
          <View style={[styles.banner, phoneError.kind === 'network' ? styles.bannerNeutral : styles.bannerError]}>
            {phoneError.kind === 'network' ? (
              <WifiOff size={16} color={colors.slate600} />
            ) : (
              <AlertCircle size={16} color={colors.red600} />
            )}
            <Text
              style={[styles.bannerText, phoneError.kind === 'network' ? styles.bannerTextNeutral : styles.bannerTextError]}
            >
              {phoneError.message}
            </Text>
          </View>
        )}

        <Button
          variant="auth"
          loading={checkPhoneMutation.isPending}
          disabled={!phoneValid}
          onPress={handlePhoneSubmit}
          style={{ marginTop: 4 }}
        >
          Continue
        </Button>

        <Text style={styles.terms}>
          By signing in, you agree to our <Text style={styles.termsLink}>Terms and Conditions.</Text>
        </Text>
      </AuthLayout>
    );
  }

  if (step === 'create') {
    return (
      <AuthLayout>
        <Pressable onPress={backToPhone} style={styles.backRow} hitSlop={10}>
          <ArrowLeft size={16} color={colors.slate500} />
          <Text style={styles.backText}>{formatPhone(fullPhone)}</Text>
        </Pressable>

        <Text style={styles.title}>Create your password</Text>
        <Text style={styles.subtitle}>
          This is your first time signing in on this device. Create a password for your driver account.
        </Text>

        <View style={styles.field}>
          <Label>New password</Label>
          <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" />
        </View>
        <View style={styles.field}>
          <Label>Confirm password</Label>
          <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" />
          <FieldError>{createError}</FieldError>
        </View>

        <View style={styles.rules}>
          {PASSWORD_RULES.map((r) => {
            const passed = r.test(newPassword);
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

        <Button variant="auth" loading={createPasswordMutation.isPending} onPress={handleCreateSubmit}>
          Create password & sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Pressable onPress={backToPhone} style={styles.backRow} hitSlop={10}>
        <ArrowLeft size={16} color={colors.slate500} />
        <Text style={styles.backText}>{formatPhone(fullPhone)}</Text>
      </Pressable>

      <Text style={styles.title}>Enter your password</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.field}>
        <Label>Password</Label>
        <PasswordInput value={password} onChangeText={setPassword} placeholder="••••••••" autoFocus />
      </View>

      {error && (
        <View style={[styles.banner, error.kind === 'network' ? styles.bannerNeutral : styles.bannerError]}>
          {error.kind === 'network' ? (
            <WifiOff size={16} color={colors.slate600} />
          ) : (
            <AlertCircle size={16} color={colors.red600} />
          )}
          <Text style={[styles.bannerText, error.kind === 'network' ? styles.bannerTextNeutral : styles.bannerTextError]}>
            {error.message}
          </Text>
        </View>
      )}

      <Link href="/forgot-password" style={styles.forgotLink}>
        Forgot password?
      </Link>

      <Button variant="auth" loading={loginMutation.isPending} disabled={triesLeft === 0} onPress={handlePasswordSubmit}>
        {loginMutation.isPending ? 'Signing you in...' : 'Login'}
      </Button>

      <Text style={styles.terms}>
        By signing in, you agree to our <Text style={styles.termsLink}>Terms and Conditions.</Text>
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.slate900,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: colors.slate500,
    marginBottom: 20,
  },
  field: {
    marginBottom: 18,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  bannerError: {
    backgroundColor: colors.red50,
    borderColor: '#fecaca',
  },
  bannerNeutral: {
    backgroundColor: colors.slate50,
    borderColor: colors.slate200,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  bannerTextError: {
    color: colors.red600,
  },
  bannerTextNeutral: {
    color: colors.slate600,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    color: colors.brand600,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 20,
  },
  terms: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 12,
    color: colors.slate500,
  },
  termsLink: {
    fontWeight: '700',
    color: colors.slate700,
    textDecorationLine: 'underline',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate500,
  },
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
