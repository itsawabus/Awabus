import { useState } from 'react';
import { cn } from '../../lib/utils.js';
import GhanaFlag from './GhanaFlag.jsx';
import { isValidPhone, sanitizePhone, toLocalPhone } from '../../lib/phone.js';

/**
 * Ghana phone input. Accepts 10 digits starting with 0 (0244123456) or the
 * 9 digits without it (244123456); the leading 0 is added when the field loses
 * focus. The value passed to onChange is digits only.
 */
export default function PhoneInput({ value, onChange, onBlur, error, placeholder = '024 412 3456', className, ...props }) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && value && !isValidPhone(value);
  const maxLength = String(value || '').startsWith('0') || !value ? 10 : 9;

  return (
    <div className={className}>
      <div
        className={cn(
          'flex h-11 items-center overflow-hidden rounded-lg border bg-slate-50 focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 dark:bg-navy-light dark:focus-within:bg-navy-light',
          error || invalid ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
        )}
      >
        <span className="flex h-full items-center gap-1.5 border-r border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <GhanaFlag className="h-3.5 w-[21px] rounded-[2px] ring-1 ring-black/10" />
          GH
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange?.(sanitizePhone(e.target.value))}
          onBlur={(e) => {
            setTouched(true);
            const local = toLocalPhone(value);
            if (local !== value) onChange?.(local);
            onBlur?.(e);
          }}
          placeholder={placeholder}
          className="h-full flex-1 bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          {...props}
        />
      </div>
      {invalid && !error && (
        <p className="mt-1.5 text-xs font-medium text-red-500">Enter a 10-digit number starting with 0, e.g. 024 412 3456</p>
      )}
    </div>
  );
}
