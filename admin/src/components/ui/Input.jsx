import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export const Label = ({ children, htmlFor, required, className }) => (
  <label
    htmlFor={htmlFor}
    className={cn('mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200', className)}
  >
    {children}
    {required && <span className="ml-0.5 text-red-500">*</span>}
  </label>
);

export const FieldError = ({ children }) =>
  children ? <p className="mt-1.5 text-xs font-medium text-red-500">{children}</p> : null;

export const FieldHint = ({ children }) =>
  children ? <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{children}</p> : null;

const baseInputClasses =
  'w-full rounded-lg border bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:bg-navy-light dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-navy-light dark:focus:ring-brand-900/40';

export const Input = forwardRef(({ className, error, icon: Icon, wrapperClassName, ...props }, ref) => (
  <div className={cn('relative', wrapperClassName)}>
    {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
    <input
      ref={ref}
      className={cn(
        baseInputClasses,
        'h-11',
        Icon && 'pl-10',
        error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 dark:border-slate-700',
        className
      )}
      {...props}
    />
  </div>
));
Input.displayName = 'Input';

// Pass `visible` + `onToggleVisible` to control the eye button yourself;
// otherwise it toggles freely. `noReveal` hides the eye button altogether.
export const PasswordInput = forwardRef(({ className, error, visible: visibleProp, onToggleVisible, noReveal, value, ...props }, ref) => {
  const [visibleState, setVisibleState] = useState(false);
  const controlled = visibleProp !== undefined;
  const visible = controlled ? visibleProp : visibleState;
  const toggle = () => (controlled ? onToggleVisible?.(!visible) : setVisibleState((v) => !v));

  // `value` is deliberately not passed to the <input>: React copies a
  // controlled value into the HTML value="..." attribute, which would show the
  // typed password in the page's HTML (DevTools, extensions). The browser keeps
  // the text itself; onChange still reports every keystroke, and a new value
  // from the parent (e.g. clearing the form) is written to the field directly.
  const inputRef = useRef(null);
  const setRefs = useCallback(
    (el) => {
      inputRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && value !== undefined && el.value !== String(value ?? '')) el.value = value ?? '';
  }, [value]);

  return (
    <div className="relative">
      <input
        ref={setRefs}
        type={visible && !noReveal ? 'text' : 'password'}
        className={cn(
          baseInputClasses,
          'h-11',
          !noReveal && 'pr-10',
          error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 dark:border-slate-700',
          className
        )}
        {...props}
      />
      {!noReveal && (
        <button
          type="button"
          tabIndex={-1}
          onClick={toggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
        </button>
      )}
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

export const Textarea = forwardRef(({ className, error, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      baseInputClasses,
      'py-2.5',
      error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 dark:border-slate-700',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ className, error, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      baseInputClasses,
      'h-11 appearance-none bg-[url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>\')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
      error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 dark:border-slate-700',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export default Input;
