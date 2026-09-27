import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Input, { Label, FieldError } from '../../components/ui/Input.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import Button from '../../components/ui/Button.jsx';
import { forgotPassword } from '../../api/auth.js';
import { useResetFlowStore } from '../../store/resetFlowStore.js';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const setEmail = useResetFlowStore((s) => s.setEmail);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const email = value.trim().toLowerCase();

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email),
    onSuccess: () => {
      setEmail(email);
      navigate('/verify-otp');
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email)) {
      setError('Enter the email address you sign in with');
      return;
    }
    mutation.mutate();
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Forgot password?</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Enter the email address you sign in with and we'll send you a 6-digit verification code.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="name@school.edu.gh"
            error={Boolean(error)}
            autoFocus
          />
          <FieldError>{error}</FieldError>
        </div>

        <Button type="submit" variant="auth" className="w-full" loading={mutation.isPending}>
          Send OTP
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
