import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input, { Label, FieldError } from '../ui/Input.jsx';
import PhoneInput from '../ui/PhoneInput.jsx';
import OtpInput from '../ui/OtpInput.jsx';
import { confirmEmailChange, confirmPhoneChange, requestVerification } from '../../api/account.js';
import { isValidPhone, toLocalPhone } from '../../lib/phone.js';
import { useAuthStore } from '../../store/authStore.js';
import useCountdown from './useCountdown.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Two-step change of the account email or phone: enter the new value, then the
 * 6-digit code sent to it. The change only takes effect once the code is verified.
 */
export default function ChangeContactModal({ type, open, onClose, onChanged }) {
  const updateAdmin = useAuthStore((s) => s.updateAdmin);
  const isEmail = type === 'email';
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const cooldown = useCountdown();

  useEffect(() => {
    if (open) {
      setValue('');
      setCode('');
      setSentTo('');
      setError('');
    }
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: () =>
      requestVerification(
        isEmail
          ? { purpose: 'change_email', email: value.trim() }
          : { purpose: 'change_phone', phone: toLocalPhone(value) }
      ),
    onSuccess: (res) => {
      setSentTo(res.sentTo);
      setCode('');
      setError('');
      cooldown.start(60);
    },
    onError: (err) => setError(err.message),
  });

  const confirmMutation = useMutation({
    mutationFn: () => (isEmail ? confirmEmailChange(code) : confirmPhoneChange(code)),
    onSuccess: (admin) => {
      updateAdmin(admin);
      onChanged?.(isEmail ? 'Email address updated' : 'Phone number updated');
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const send = () => {
    setError('');
    if (isEmail ? !EMAIL_RE.test(value.trim()) : !isValidPhone(value)) {
      setError(isEmail ? 'Enter a valid email address' : 'Enter a 10-digit number starting with 0, e.g. 024 412 3456');
      return;
    }
    sendMutation.mutate();
  };

  const label = isEmail ? 'email address' : 'phone number';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change ${label}`}
      footer={
        sentTo ? (
          <>
            <Button type="button" variant="outline" onClick={() => setSentTo('')}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => confirmMutation.mutate()}
              disabled={code.length !== 6}
              loading={confirmMutation.isPending}
            >
              Verify & update
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={send} loading={sendMutation.isPending}>
              Send code
            </Button>
          </>
        )
      }
    >
      {!sentTo ? (
        <div>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            We&apos;ll send a 6-digit code to the new {label} to confirm it&apos;s yours.
          </p>
          <Label>New {label}</Label>
          {isEmail ? (
            <Input
              type="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="name@school.edu.gh"
              error={Boolean(error)}
              autoFocus
            />
          ) : (
            <PhoneInput value={value} onChange={setValue} error={Boolean(error)} />
          )}
          <FieldError>{error}</FieldError>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Enter the 6-digit code sent to <span className="font-semibold text-slate-800 dark:text-slate-100">{sentTo}</span>.
          </p>
          <OtpInput value={code} onChange={setCode} error={Boolean(error)} />
          <FieldError>{error}</FieldError>
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
    </Modal>
  );
}
