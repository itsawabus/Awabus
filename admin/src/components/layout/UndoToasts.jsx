import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { UNDO_SECONDS, useUndoDeleteStore } from '../../store/undoDeleteStore.js';

/** Bottom-corner notices for deletes that can still be undone. */
export default function UndoToasts() {
  const jobs = useUndoDeleteStore((s) => s.jobs);
  const undo = useUndoDeleteStore((s) => s.undo);
  const dismiss = useUndoDeleteStore((s) => s.dismiss);
  const flushAll = useUndoDeleteStore((s) => s.flushAll);
  const [now, setNow] = useState(Date.now());

  // Closing or reloading the page sends pending deletes straight away.
  useEffect(() => {
    window.addEventListener('pagehide', flushAll);
    return () => window.removeEventListener('pagehide', flushAll);
  }, [flushAll]);

  const counting = jobs.some((j) => j.status === 'pending');
  useEffect(() => {
    if (!counting) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [counting]);

  // Failure notices go away on their own after a while.
  useEffect(() => {
    const failed = jobs.filter((j) => j.status === 'failed');
    if (!failed.length) return undefined;
    const t = setTimeout(() => failed.forEach((j) => dismiss(j.key)), 15000);
    return () => clearTimeout(t);
  }, [jobs, dismiss]);

  if (!jobs.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end lg:bottom-6 lg:right-6">
      {jobs.map((job) => {
        const left = Math.max(0, Math.ceil((job.expiresAt - now) / 1000));
        const fraction = Math.max(0, Math.min(1, (job.expiresAt - now) / (UNDO_SECONDS * 1000)));
        return (
          <div
            key={job.key}
            role="status"
            className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl bg-navy text-white shadow-2xl ring-1 ring-white/10"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              {job.status === 'pending' && <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />}
              {job.status === 'running' && <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-slate-300" />}
              {job.status === 'undone' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />}
              {job.status === 'failed' && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />}

              <div className="min-w-0 flex-1 text-sm">
                {job.status === 'pending' && job.kind === 'edit' && (
                  <>
                    <p className="font-semibold">Updated {job.title}</p>
                    <p className="text-xs text-slate-300">Undo within {left}s to put the old values back.</p>
                  </>
                )}
                {job.status === 'pending' && job.kind !== 'edit' && (
                  <>
                    <p className="font-semibold">Deleted {job.title}</p>
                    <p className="text-xs text-slate-300">Undo within {left}s, after that it&apos;s gone for good.</p>
                  </>
                )}
                {job.status === 'running' && (
                  <p className="font-semibold">{job.kind === 'edit' ? `Undoing changes to ${job.title}…` : `Deleting ${job.title}…`}</p>
                )}
                {job.status === 'undone' && (
                  <p className="font-semibold">
                    {job.kind === 'edit' ? `Changes to ${job.title} undone.` : `Restored ${job.title}. Nothing was deleted.`}
                  </p>
                )}
                {job.status === 'failed' && (
                  <>
                    <p className="font-semibold">
                      {job.undoFailed
                        ? `${job.failures.length} could not be put back`
                        : `${job.deleted ? `${job.deleted} deleted, but ` : ''}${job.failures.length} could not be deleted`}
                    </p>
                    <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-xs text-slate-300">
                      {job.failures.map((f, i) => (
                        <li key={i}>
                          <span className="font-semibold text-white">{f.label}:</span> {f.message}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {job.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => undo(job.key)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-brand-200 hover:bg-white/20"
                >
                  <RotateCcw className="h-4 w-4" /> Undo
                </button>
              )}
              {(job.status === 'failed' || job.status === 'undone') && (
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismiss(job.key)}
                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {job.status === 'pending' && (
              <div className="h-1 bg-white/10">
                <div className="h-full bg-brand-400 transition-[width] duration-200 ease-linear" style={{ width: `${fraction * 100}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
