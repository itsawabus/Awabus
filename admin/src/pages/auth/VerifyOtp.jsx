import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import OtpInput from '../../components/ui/OtpInput.jsx';
import Button from '../../components/ui/Button.jsx';
import { verifyOtp, resendOtp } from '../../api/auth.js';
import { useResetFlowStore } from '../../store/resetFlowStore.js';
import { maskEmail } from '../../lib/utils.js';

export default function VerifyOtp() {
  const navigate = useNavigate();
  const { email, setResetToken } = useResetFlowStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!email) navigate('/forgot-password');
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(email, code),
    onSuccess: (data) => {
      setResetToken(data.resetToken);
      navigate('/reset-password');
    },
    onError: (err) => setError(err.message),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendOtp(email),
    onSuccess: () => {
      setError('');
      setCooldown(30);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) {
      setError('Enter the 6-digit verification code');
      return;
    }
    verifyMutation.mutate();
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Check your email</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Enter the 6-digit verification code sent to {maskEmail(email)}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <OtpInput value={code} onChange={setCode} error={Boolean(error)} />
        {error && <p className="text-center text-xs font-medium text-red-500">{error}</p>}

        <button
          type="button"
          disabled={cooldown > 0 || resendMutation.isPending}
          onClick={() => resendMutation.mutate()}
          className="block w-full text-center text-sm font-semibold text-brand-600 hover:underline disabled:text-slate-400 disabled:no-underline dark:text-brand-400"
        >
          {cooldown > 0 ? `Didn't receive a code? Request OTP (${cooldown}s)` : "Didn't receive a code? Request OTP"}
        </button>

        <Button type="submit" variant="auth" className="w-full" loading={verifyMutation.isPending}>
          Verify OTP
        </Button>

        <Link
          to="/sign-in"
          className="block text-center text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300"
        >
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
