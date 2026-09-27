import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, Moon, Phone, ShieldCheck } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Label, FieldError, PasswordInput } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import OtpInput from '../../components/ui/OtpInput.jsx';
import AccountTabs, { SuccessNote } from '../../components/account/AccountTabs.jsx';
import PasswordChecklist from '../../components/account/PasswordChecklist.jsx';
import useCountdown from '../../components/account/useCountdown.js';
import RevealPasswordModal from '../../components/account/RevealPasswordModal.jsx';
import NotificationSettings from '../../components/notifications/NotificationSettings.jsx';
import { changePassword, requestVerification } from '../../api/account.js';
import { isStrongPassword } from '../../lib/password.js';
import { formatPhone } from '../../lib/phone.js';
import { cn } from '../../lib/utils.js';
import { useAuthStore } from '../../store/authStore.js';
import { useUiStore } from '../../store/uiStore.js';

const emptyPassword = { current: '', next: '', confirm: '' };

export default function AccountSettings() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Account settings'] });
  const admin = useAuthStore((s) => s.admin);
  const { darkMode, toggleDarkMode } = useUiStore();

  const [pw, setPw] = useState(emptyPassword);
  const [channel, setChannel] = useState(admin?.email ? 'email' : 'phone');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cooldown = useCountdown();
  const who = { email: admin?.email, name: admin?.name };
  const { hash } = useLocation();

  // Links such as /account/settings#notifications jump to that section.
  useEffect(() => {
    if (!hash) return undefined;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [hash]);

  // Showing the typed current password needs an emailed code first; once
  // verified it can be toggled freely until revealUntil, then hides again.
  const [showCurrent, setShowCurrent] = useState(false);
  const [revealUntil, setRevealUntil] = useState(0);
  const [revealOpen, setRevealOpen] = useState(false);

  useEffect(() => {
    if (!revealUntil) return undefined;
    const t = setTimeout(() => {
      setShowCurrent(false);
      setRevealUntil(0);
    }, Math.max(revealUntil - Date.now(), 0));
    return () => clearTimeout(t);
  }, [revealUntil]);

  const toggleCurrent = (show) => {
    if (!show) return setShowCurrent(false);
    if (Date.now() < revealUntil) return setShowCurrent(true);
    return setRevealOpen(true);
  };

  const sendMutation = useMutation({
    mutationFn: () => requestVerification({ purpose: 'change_password', channel }),
    onSuccess: (res) => {
      setSentTo(res.sentTo);
      setCode('');
      setError('');
      cooldown.start(60);
    },
    onError: (err) => setError(err.message),
  });

  const changeMutation = useMutation({
    mutationFn: () => changePassword({ currentPassword: pw.current, newPassword: pw.next, code }),
    onSuccess: () => {
      setPw(emptyPassword);
      setSentTo('');
      setCode('');
      setError('');
      setNotice('Your password has been changed');
    },
    onError: (err) => setError(err.message),
  });

  const requestCode = () => {
    setError('');
    if (!pw.current) return setError('Enter your current password');
    if (!isStrongPassword(pw.next, who)) return setError('Your new password doesn\'t meet all the password requirements yet');
    if (pw.next !== pw.confirm) return setError('The new passwords do not match');
    if (pw.next === pw.current) return setError('Choose a password different from your current one');
    return sendMutation.mutate();
  };

  return (
    <div>
      <PageHeader title="Account settings" subtitle="Security and preferences for your AwaBus account." />
      <AccountTabs />
      <SuccessNote message={notice} onDone={() => setNotice('')} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader
            title="Change password"
            subtitle="For your security, we'll confirm the change with a code sent to your email or phone."
          />
          <CardBody className="space-y-5">
            <div>
              <Label>Current password</Label>
              <PasswordInput
                value={pw.current}
                onChange={(e) => {
                  setError('');
                  setPw((p) => ({ ...p, current: e.target.value }));
                }}
                autoComplete="current-password"
                disabled={Boolean(sentTo)}
                visible={showCurrent}
                onToggleVisible={toggleCurrent}
              />
              <RevealPasswordModal
                open={revealOpen}
                email={admin?.email}
                onClose={() => setRevealOpen(false)}
                onVerified={(until) => {
                  setRevealUntil(until);
                  setShowCurrent(true);
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>New password</Label>
                <PasswordInput
                  value={pw.next}
                  onChange={(e) => {
                  setError('');
                  setPw((p) => ({ ...p, next: e.target.value }));
                }}
                  autoComplete="new-password"
                  disabled={Boolean(sentTo)}
                />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <PasswordInput
                  value={pw.confirm}
                  onChange={(e) => {
                  setError('');
                  setPw((p) => ({ ...p, confirm: e.target.value }));
                }}
                  autoComplete="new-password"
                  error={Boolean(pw.confirm) && pw.confirm !== pw.next}
                  disabled={Boolean(sentTo)}
                />
                {pw.confirm && pw.confirm !== pw.next && <FieldError>Passwords do not match</FieldError>}
              </div>
            </div>
            {!sentTo && <PasswordChecklist password={pw.next} {...who} />}

            {!sentTo ? (
              <div>
                <Label>Send the verification code to</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ChannelOption
                    icon={Mail}
                    label="Email"
                    detail={admin?.email || 'No email on account'}
                    selected={channel === 'email'}
                    disabled={!admin?.email}
                    onSelect={() => setChannel('email')}
                  />
                  <ChannelOption
                    icon={Phone}
                    label="SMS"
                    detail={admin?.phone ? formatPhone(admin.phone) : 'No phone on account'}
                    selected={channel === 'phone'}
                    disabled={!admin?.phone}
                    onSelect={() => setChannel('phone')}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-5 text-center dark:bg-navy">
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                  Enter the 6-digit code sent to <span className="font-semibold">{sentTo}</span>
                </p>
                <OtpInput value={code} onChange={setCode} error={Boolean(error)} />
                <button
                  type="button"
                  disabled={cooldown.seconds > 0 || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                  className="mt-3 text-sm font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  {cooldown.seconds > 0 ? `Resend code in ${cooldown.seconds}s` : 'Resend code'}
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              {sentTo ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSentTo('');
                      setCode('');
                      setError('');
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => changeMutation.mutate()}
                    disabled={code.length !== 6}
                    loading={changeMutation.isPending}
                  >
                    Update password
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={requestCode} loading={sendMutation.isPending}>
                  <ShieldCheck className="h-4 w-4" />
                  Send verification code
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 self-start">
          <Card>
            <CardHeader title="Appearance" />
            <CardBody>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Moon className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dark mode</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Saved on this browser.</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={darkMode}
                  onClick={toggleDarkMode}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    darkMode ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                      darkMode ? 'left-[22px]' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            </CardBody>
          </Card>
          <NotificationSettings id="notifications" />
        </div>
      </div>
    </div>
  );
}

function ChannelOption({ icon: Icon, label, detail, selected, disabled, onSelect }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10'
          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-navy'
      )}
    >
      <Icon className={cn('h-5 w-5', selected ? 'text-brand-600' : 'text-slate-400')} />
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{detail}</span>
      </span>
    </button>
  );
}
