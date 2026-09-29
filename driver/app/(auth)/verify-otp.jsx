import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Link, router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import AuthLayout from '../../src/components/layout/AuthLayout.jsx';
import OtpInput from '../../src/components/ui/OtpInput.jsx';
import Button from '../../src/components/ui/Button.jsx';
import { verifyOtp, resendOtp } from '../../src/api/driverApp.js';
import { useResetFlowStore } from '../../src/store/resetFlowStore.js';
import { colors, themed } from '../../src/lib/theme.js';

const maskPhone = (phone = '') => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  // Shown the local way: 024 *** ** 56
  const local = digits.startsWith('233') ? `0${digits.slice(3)}` : digits.startsWith('0') ? digits : `0${digits}`;
  return `${local.slice(0, 3)} *** ** ${local.slice(-2)}`;
};

export default function VerifyOtp() {
  const { phone, setResetToken } = useResetFlowStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!phone) router.replace('/forgot-password');
  }, [phone]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(phone, code),
    onSuccess: (data) => {
      setResetToken(data.resetToken);
      router.push('/reset-password');
    },
    onError: (err) => setError(err.message),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendOtp(phone),
    onSuccess: () => setCooldown(30),
  });

  const handleSubmit = () => {
    setError('');
    if (code.length !== 6) {
      setError('Enter the 6-digit verification code');
      return;
    }
    verifyMutation.mutate();
  };

  return (
    <AuthLayout>
      <Text style={styles.title}>Verify your phone</Text>
      <Text style={styles.subtitle}>Enter the 6-digit verification code sent to {maskPhone(phone)}</Text>

      <OtpInput value={code} onChange={setCode} error={Boolean(error)} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        variant="link"
        disabled={cooldown > 0 || resendMutation.isPending}
        onPress={() => resendMutation.mutate()}
        style={styles.resendButton}
      >
        <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
          {cooldown > 0 ? `Didn't receive a code? Request OTP (${cooldown}s)` : "Didn't receive a code? Request OTP"}
        </Text>
      </Button>

      <Button variant="auth" loading={verifyMutation.isPending} onPress={handleSubmit} style={styles.verifyButton}>
        Verify OTP
      </Button>

      <Link href="/sign-in" style={styles.backLink}>
        Back to sign in
      </Link>
    </AuthLayout>
  );
}

const styles = themed(() => ({
  title: { fontSize: 26, fontWeight: '800', color: colors.slate900 },
  subtitle: { marginTop: 4, fontSize: 15, color: colors.slate500, marginBottom: 28 },
  error: { marginTop: 12, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.red500 },
  resendButton: { alignSelf: 'center', marginTop: 20, marginBottom: 20 },
  resendText: { color: colors.brand600, fontWeight: '700', fontSize: 14 },
  resendTextDisabled: { color: colors.slate400 },
  verifyButton: { marginBottom: 20 },
  backLink: { textAlign: 'center', color: colors.slate500, fontWeight: '700', fontSize: 14 },
}));
