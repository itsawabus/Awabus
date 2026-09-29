import { clsx } from 'clsx';

export const cn = (...args) => clsx(...args);

export const formatDate = (value, opts = {}) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...opts });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(date)}, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

export const timeAgo = (value) => {
  if (!value) return '—';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

// jane.doe@school.com -> j*******@school.com
export const maskEmail = (email = '') => email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(b.length, 1))}${c}`);

export const maskPhone = (phone = '') => {
  // 024 *** ** 83
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const local = digits.startsWith('233') ? `0${digits.slice(3)}` : digits.startsWith('0') ? digits : `0${digits}`;
  return `${local.slice(0, 3)} *** ** ${local.slice(-2)}`;
};

export const genderLabel = (g) => g || '—';

export const statusToneMap = {
  Active: 'success',
  Present: 'success',
  Completed: 'neutral',
  Verified: 'success',
  Idle: 'neutral',
  Pending: 'neutral',
  Expected: 'neutral',
  'In Progress': 'success',
  'In Transit': 'success',
  Delayed: 'danger',
  Absent: 'danger',
  'Not on board': 'danger',
  'Trip cancelled': 'danger',
  'On board': 'success',
  'Dropped off': 'success',
  'Trip not started': 'neutral',
  'Awaiting pickup': 'warning',
  'Not scanned': 'warning',
  'Not on this trip': 'neutral',
  'No trip today': 'neutral',
  Cancelled: 'danger',
  Failed: 'danger',
  Maintenance: 'warning',
  Inactive: 'neutral',
  Offline: 'neutral',
};
