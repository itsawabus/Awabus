import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import OtpInput from '../ui/OtpInput.jsx';
import { FieldError } from '../ui/Input.jsx';
import { confirmPasswordReveal, requestVerification } from '../../api/account.js';
import { maskEmail } from '../../lib/utils.js';
import useCountdown from './useCountdown.js';

/**
 * Asks for a code sent to the account email before a typed password may be
 * shown on screen. onVerified(allowedUntil) is called once the code checks out.
 */
export default function RevealPasswordModal({ open, email, onClose, onVerified }) {
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const cooldown = useCountdown();

  useEffect(() => {
    if (open) {
      setSentTo('');
      setCode('');
      setError('');
    }
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: () => requestVerification({ purpose: 'reveal_password' }),
    onSuccess: (res) => {
      setSentTo(res.sentTo);
      setError('');
      cooldown.start(60);
    },
    onError: (err) => setError(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () => confirmPasswordReveal(code),
    onSuccess: (res) => {
      onVerified(new Date(res.allowedUntil).getTime());
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verify it's you"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {sentTo ? (
            <Button
              type="button"
              onClick={() => verifyMutation.mutate()}
              disabled={code.length !== 6}
              loading={verifyMutation.isPending}
            >
              Verify & show
            </Button>
          ) : (
            <Button type="button" onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
              Send code
            </Button>
          )}
        </>
      }
    >
      {!sentTo ? (
        <p className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            For your security, we&apos;ll email a 6-digit code to{' '}
            <span className="font-semibold">{email ? maskEmail(email) : 'your account email'}</span> before showing your
            password.
          </span>
        </p>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Enter the code sent to <span className="font-semibold text-slate-800 dark:text-slate-100">{sentTo}</span>.
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
      <FieldError>{error}</FieldError>
    </Modal>
  );
}
