import { useState } from 'react';
import { History } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog.jsx';

/** Banner shown when a form was pre-filled from a saved draft. Discarding asks first. */
export default function DraftNotice({ show, onDiscard, discardLabel = 'Discard draft' }) {
  const [confirming, setConfirming] = useState(false);
  if (!show) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
      <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
        <History className="h-4 w-4" />
        We restored the details you were filling in earlier.
      </p>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
      >
        {discardLabel}
      </button>
      <ConfirmDialog
        open={confirming}
        title={`${discardLabel}?`}
        message="Everything you've entered in this form so far will be lost. This can't be undone."
        confirmLabel={discardLabel}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onDiscard();
        }}
      />
    </div>
  );
}
