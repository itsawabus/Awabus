import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import { PasswordInput, Input, Label, FieldError } from '../../components/ui/Input.jsx';
import Checkbox from '../../components/ui/Checkbox.jsx';
import Button from '../../components/ui/Button.jsx';
import { checkEmail, login as loginApi, setPassword as setPasswordApi } from '../../api/auth.js';
import PasswordChecklist from '../../components/account/PasswordChecklist.jsx';
import { isStrongPassword } from '../../lib/password.js';
import { useAuthStore } from '../../store/authStore.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEP = {
  EMAIL: 'email',
  CREATE_PASSWORD: 'create_password',
  ENTER_PASSWORD: 'enter_password',
};

export default function SignIn() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(STEP.EMAIL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  const emailValid = EMAIL_REGEX.test(email.trim());

  const checkEmailMutation = useMutation({
    mutationFn: () => checkEmail({ email: email.trim() }),
    onSuccess: (data) => {
      if (!data.exists) {
        setFormError('No account found with this email address');
        return;
      }
      setFormError('');
      setStep(data.hasPassword ? STEP.ENTER_PASSWORD : STEP.CREATE_PASSWORD);
    },
    onError: (err) => setFormError(err.message),
  });

  const loginMutation = useMutation({
    mutationFn: () =>
      loginApi({
        email: email.trim(),
        password,
        rememberDevice: remember,
        deviceId: 'web-admin-portal',
      }),
    onSuccess: (data) => {
      setAuth(data);
      setSuccess(true);
      const destination = data.admin?.role === 'superadmin' ? '/platform' : '/';
      setTimeout(() => navigate(destination), 900);
    },
    onError: (err) => setFormError(err.message),
  });

  const createPasswordMutation = useMutation({
    mutationFn: () =>
      setPasswordApi({
        email: email.trim(),
        password,
        deviceId: 'web-admin-portal',
      }),
    onSuccess: (data) => {
      setAuth(data);
      setSuccess(true);
      const destination = data.admin?.role === 'superadmin' ? '/platform' : '/';
      setTimeout(() => navigate(destination), 900);
    },
    onError: (err) => setFormError(err.message),
  });

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!emailValid) {
      setFormError('Enter a valid email address');
      return;
    }
    checkEmailMutation.mutate();
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!password) {
      setFormError('Please enter your password');
      return;
    }
    loginMutation.mutate();
  };

  const handleCreatePasswordSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!isStrongPassword(password, { email })) {
      setFormError('Your password doesn\'t meet all the password requirements yet');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    createPasswordMutation.mutate();
  };

  const handleBackToEmail = () => {
    setStep(STEP.EMAIL);
    setPassword('');
    setConfirmPassword('');
    setFormError('');
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="mb-4 h-14 w-14 text-brand-500" />
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Sign in successful</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Taking you to the AwaBus Admin Portal...
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {step !== STEP.EMAIL && (
        <button
          onClick={handleBackToEmail}
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
        {step === STEP.EMAIL && 'Sign in'}
        {step === STEP.ENTER_PASSWORD && 'Enter your password'}
        {step === STEP.CREATE_PASSWORD && 'Create a password'}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {step === STEP.EMAIL && 'Sign in to manage and monitor bus operations'}
        {step === STEP.ENTER_PASSWORD && email}
        {step === STEP.CREATE_PASSWORD && `Set a password for ${email}`}
      </p>

      {formError && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {formError}
        </div>
      )}

      {step === STEP.EMAIL && (
        <form onSubmit={handleEmailSubmit} className="mt-6 space-y-5">
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              error={email.length > 0 && !emailValid}
              autoFocus
            />
            <FieldError>{email.length > 0 && !emailValid ? 'Enter a valid email address' : ''}</FieldError>
          </div>

          <Button type="submit" variant="auth" className="w-full" loading={checkEmailMutation.isPending}>
            {checkEmailMutation.isPending ? 'Checking...' : 'Continue'}
          </Button>
        </form>
      )}

      {step === STEP.ENTER_PASSWORD && (
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5">
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <Checkbox checked={remember} onChange={setRemember} label="Remember this device" />
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="auth" className="w-full" loading={loginMutation.isPending}>
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      )}

      {step === STEP.CREATE_PASSWORD && (
        <form onSubmit={handleCreatePasswordSubmit} className="mt-6 space-y-5">
          <div>
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              autoFocus
            />
            <PasswordChecklist password={password} email={email} />
          </div>

          <div>
            <Label htmlFor="confirm-password">Confirm password</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
            />
            <FieldError>
              {confirmPassword.length > 0 && password !== confirmPassword ? 'Passwords do not match' : ''}
            </FieldError>
          </div>

          <Button type="submit" variant="auth" className="w-full" loading={createPasswordMutation.isPending}>
            {createPasswordMutation.isPending ? 'Creating account...' : 'Create password & sign in'}
          </Button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            By continuing, you agree to our{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">Terms and conditions</span>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}