import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { downloadImportTemplate, uploadImportFile } from '../../api/import.js';
import { cn } from '../../lib/utils.js';

const ORDER = ['routes', 'buses', 'drivers', 'students'];
const NEEDS = {
  routes: null,
  buses: 'Each bus needs a route, so add routes first.',
  drivers: 'Each driver needs a bus that has no driver yet, so add buses first.',
  students: 'Each student needs a route, so add routes first.',
};
const MAX_MB = 10;

/**
 * Bulk upload for one kind of record: download the Excel template, fill it in,
 * upload it, see every problem by row and column, then import. Nothing is
 * imported until the whole file checks out.
 */
export default function BulkUploadModal({ open, onClose, entity, label, singular }) {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null); // response of the last check / import
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const noun = label.toLowerCase();

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
      setLocalError('');
    }
  }, [open]);

  const templateMutation = useMutation({ mutationFn: () => downloadImportTemplate(entity) });
  const checkMutation = useMutation({
    mutationFn: (f) => uploadImportFile(entity, f),
    onSuccess: setResult,
  });
  const importMutation = useMutation({
    mutationFn: () => uploadImportFile(entity, file, true),
    onSuccess: (res) => {
      setResult(res);
      if (res.created) queryClient.invalidateQueries();
    },
  });

  const pick = (f) => {
    setResult(null);
    setLocalError('');
    checkMutation.reset();
    importMutation.reset();
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setFile(null);
      setLocalError('Upload the template as an Excel .xlsx file. If you saved it as .xls or .csv, open it and "Save as" Excel Workbook (.xlsx).');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      setLocalError(`That file is larger than ${MAX_MB} MB. Split it into smaller files.`);
      return;
    }
    setFile(f);
    checkMutation.mutate(f);
  };

  const done = result?.committed;
  const ready = result?.ok && !done;
  const busy = checkMutation.isPending || importMutation.isPending;
  const requestError = checkMutation.error?.message || importMutation.error?.message || templateMutation.error?.message;

  const footer = done ? (
    <Button onClick={onClose}>Done</Button>
  ) : (
    <>
      <Button variant="outline" onClick={onClose} disabled={importMutation.isPending}>
        Cancel
      </Button>
      <Button onClick={() => importMutation.mutate()} disabled={!ready} loading={importMutation.isPending}>
        <Upload className="h-4 w-4" />
        {ready ? `Import ${result.total} ${result.total === 1 ? singular : noun}` : `Import ${noun}`}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={`Bulk upload ${noun}`} size="xl" footer={footer}>
      <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
        {!done && (
          <>
            <Step number={1} title="Download the template">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                An Excel file with one column per detail. Mandatory columns are marked <strong>*</strong> and highlighted, and
                dropdowns and rules in the file stop most mistakes as you type. The first sheet explains every column with an
                example.
              </p>
              {NEEDS[entity] && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {NEEDS[entity]} Recommended order: {ORDER.map((e) => e[0].toUpperCase() + e.slice(1)).join(' → ')}.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => templateMutation.mutate()}
                loading={templateMutation.isPending}
              >
                <Download className="h-4 w-4" /> Download {noun} template (.xlsx)
              </Button>
            </Step>

            <Step number={2} title="Upload the filled-in file">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
                  dragging
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-navy'
                )}
              >
                <FileSpreadsheet className="h-8 w-8 text-brand-600" />
                {file ? (
                  <span className="text-sm">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{file.name}</span>
                    <span className="text-slate-400"> · {(file.size / 1024).toFixed(0)} KB · click to choose another</span>
                  </span>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-brand-600">Choose a file</span> or drag it here (.xlsx)
                  </span>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </Step>
          </>
        )}

        {checkMutation.isPending && <Notice tone="info">Checking every row in your file...</Notice>}
        {(localError || requestError) && <Notice tone="error">{localError || requestError}</Notice>}
        {result?.fileError && <Notice tone="error">{result.fileError}</Notice>}

        {result && !result.fileError && !done && result.errors.length > 0 && (
          <ProblemList result={result} imported={false} />
        )}

        {ready && (
          <div>
            <Notice tone="success">
              All {result.total} rows are correct and ready. Press <strong>Import</strong> to add them.
            </Notice>
            <PreviewList rows={result.preview} total={result.total} />
          </div>
        )}

        {done && (
          <div className="space-y-4">
            {result.created > 0 && (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-brand-500" />
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {result.created} {noun} imported
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">They now appear in your {noun} list.</p>
              </div>
            )}
            {result.errors.length > 0 && <ProblemList result={result} imported />}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Step({ number, title, children }) {
  return (
    <section className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="mb-1 font-semibold text-slate-900 dark:text-white">{title}</h4>
        {children}
      </div>
    </section>
  );
}

function Notice({ tone, children }) {
  const styles = {
    info: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-navy dark:text-slate-300',
    error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400',
    success: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-500/10 dark:text-brand-300',
  };
  const Icon = tone === 'error' ? XCircle : tone === 'success' ? CheckCircle2 : FileSpreadsheet;
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm', styles[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function ProblemList({ result, imported }) {
  const rowsWithProblems = new Set(result.errors.map((e) => e.row)).size;
  return (
    <div>
      <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          {imported ? (
            <>These rows could not be added. Fix them in your file and upload only those rows again.</>
          ) : (
            <>
              Found <strong>{result.errors.length}</strong> {result.errors.length === 1 ? 'problem' : 'problems'} in{' '}
              <strong>{rowsWithProblems}</strong> of {result.total} rows. <strong>Nothing has been imported yet.</strong> Fix
              these in your Excel file, save it, and upload it again. The row numbers match the rows in Excel.
            </>
          )}
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-navy dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Column</th>
              <th className="px-3 py-2">Problem</th>
            </tr>
          </thead>
          <tbody>
            {result.errors.map((e, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{e.row}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{e.column || '—'}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                  {e.message.charAt(0).toUpperCase() + e.message.slice(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewList({ rows, total }) {
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-navy dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Will be added</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2 text-slate-500">{r.row}</td>
              <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{r.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > rows.length && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400 dark:border-slate-800">
          …and {total - rows.length} more
        </p>
      )}
    </div>
  );
}
