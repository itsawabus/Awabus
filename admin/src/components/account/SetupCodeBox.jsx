import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { formatDate } from '../../lib/utils.js';

/**
 * Shows a one-time setup code once, right after it is made. Only a hash is
 * kept on the server, so it cannot be shown again (a new one can be made).
 */
export default function SetupCodeBox({ code, expires, children }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is on screen to read out */
    }
  };
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-left dark:border-brand-900 dark:bg-brand-950/30">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <KeyRound className="h-4 w-4 shrink-0 text-brand-600" /> Setup code
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span data-testid="setup-code" className="select-all font-mono text-2xl font-extrabold tracking-widest text-slate-900 dark:text-white">
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-navy dark:text-slate-300"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
        {children} Valid until {formatDate(expires)}. It is shown only now; if it is lost, make a new one.
      </p>
    </div>
  );
}
