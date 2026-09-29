import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import { PasswordInput, Label, FieldError } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { resetPassword } from '../../api/auth.js';
import { useResetFlowStore } from '../../store/resetFlowStore.js';
import { cn } from '../../lib/utils.js';

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'At least one uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'At least one lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'At least one number', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'At least one special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function ResetPassword() {
  const navigate = useNavigate();
  const { resetToken, clear } = useResetFlowStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resetToken) navigate('/forgot-password');
  }, [resetToken, navigate]);

  const allValid = useMemo(() => RULES.every((r) => r.test(password)), [password]);

  const mutation = useMutation({
    mutationFn: () => resetPassword(resetToken, password),
    onSuccess: () => {
      clear();
      navigate('/reset-success');
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
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
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Create new password</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Create a secure new password for your AwaBus Admin Portal account
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <FieldError>{error}</FieldError>
        </div>

        <ul className="space-y-1.5">
          {RULES.map((r) => {
            const passed = r.test(password);
            return (
              <li key={r.key} className={cn('flex items-center gap-2 text-sm', passed ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400')}>
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', passed ? 'bg-brand-100 dark:bg-brand-500/20' : 'bg-slate-100 dark:bg-navy')}>
                  {passed && <Check className="h-3 w-3" />}
                </span>
                {r.label}
              </li>
            );
          })}
        </ul>

        <Button type="submit" variant="auth" className="w-full" loading={mutation.isPending}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
