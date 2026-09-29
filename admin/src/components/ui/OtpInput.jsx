import { useRef } from 'react';
import { cn } from '../../lib/utils.js';

export default function OtpInput({ length = 6, value, onChange, error }) {
  const refs = useRef([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const setDigit = (i, char) => {
    const next = [...digits];
    next[i] = char;
    onChange(next.join(''));
  };

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    setDigit(i, char);
    if (char && refs.current[i + 1]) refs.current[i + 1].focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && refs.current[i - 1]) {
      refs.current[i - 1].focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      e.preventDefault();
      onChange(pasted.padEnd(length, '').slice(0, length));
    }
  };

  return (
    <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          className={cn(
            'h-14 w-12 rounded-lg border bg-slate-50 text-center text-xl font-bold text-slate-900 outline-none transition-colors focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:bg-navy-light dark:text-white',
            error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'
          )}
        />
      ))}
    </div>
  );
}
