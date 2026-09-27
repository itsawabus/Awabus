import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Input, { FieldError, Select } from './Input.jsx';
import { cn } from '../../lib/utils.js';

/**
 * Change the same fields on several selected items at once.
 *
 * fields: [{
 *   key, label, type: 'select' | 'text' | 'number',
 *   options?: string[] | [{ value, label }],        // for select
 *   loadOptions?: () => Promise<[{ value, label }]>, // for select, fetched when opened
 *   queryKey?: string,                               // cache key for loadOptions
 *   get: (item) => value,                            // the item's current value
 *   validate?: (value) => '' | message,
 *   hint?: string,
 * }]
 * Each ticked field is sent as { [key]: value } through the page's normal
 * update call, so every rule of the single-item edit still applies.
 */
export default function BulkEditModal({ open, onClose, items, fields, noun, singular, onApply }) {
  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({});
  const [progress, setProgress] = useState(null);
  const [failures, setFailures] = useState([]);

  useEffect(() => {
    if (!open) return;
    setEnabled({});
    setValues({});
    setProgress(null);
    setFailures([]);
  }, [open]);

  const count = items.length;
  const chosen = fields.filter((f) => enabled[f.key]);
  const errors = Object.fromEntries(
    chosen.map((f) => {
      const v = values[f.key] ?? '';
      if (v === '' && f.type !== 'text') return [f.key, 'Choose a value'];
      return [f.key, f.validate?.(v) || ''];
    })
  );
  const invalid = chosen.length === 0 || Object.values(errors).some(Boolean);

  const apply = async () => {
    const payload = Object.fromEntries(chosen.map((f) => [f.key, f.type === 'number' ? Number(values[f.key]) : values[f.key]]));
    setProgress({ done: 0, total: count });
    const result = await onApply(payload, (done) => setProgress({ done, total: count }));
    setProgress(null);
    if (result.failures.length) setFailures(result.failures);
    else onClose();
  };

  return (
    <Modal
      open={open}
      onClose={progress ? undefined : onClose}
      title={failures.length ? 'Some items were not changed' : `Edit ${count} ${count === 1 ? singular : noun}`}
      size="lg"
      footer={
        failures.length ? (
          <Button onClick={onClose}>OK</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={Boolean(progress)}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={invalid} loading={Boolean(progress)}>
              {progress ? `Saving ${progress.done}/${progress.total}...` : `Apply to ${count} ${count === 1 ? singular : noun}`}
            </Button>
          </>
        )
      }
    >
      {failures.length ? (
        <div className="space-y-2 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            {count - failures.length} changed. These were left as they were:
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {failures.map((f, i) => (
              <li key={i} className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                <span className="font-semibold">{f.label}:</span> {f.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="max-h-[62vh] space-y-1 overflow-y-auto pr-1">
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Tick the fields you want to change. Everything else stays as it is. You can undo for a few seconds afterwards.
          </p>
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              items={items}
              open={open}
              on={Boolean(enabled[f.key])}
              value={values[f.key] ?? ''}
              error={enabled[f.key] ? errors[f.key] : ''}
              onToggle={(on) => setEnabled((e) => ({ ...e, [f.key]: on }))}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
          ))}
          <p className="flex items-start gap-2 pt-2 text-xs text-slate-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Fields that must be different for every item (like a driver&apos;s bus or a bus&apos;s route) can only be changed one at a time.
          </p>
        </div>
      )}
    </Modal>
  );
}

function FieldRow({ field, items, open, on, value, error, onToggle, onChange }) {
  const { data: loaded = [] } = useQuery({
    queryKey: [field.queryKey || `bulk-${field.key}`],
    queryFn: field.loadOptions,
    enabled: open && Boolean(field.loadOptions),
  });
  const options = (field.loadOptions ? loaded : field.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  // What the selected items have now: one shared value, or "mixed".
  const current = [...new Set(items.map((i) => String(field.get(i) ?? '')))];
  const show = (v) => (v === '' ? 'empty' : options.find((o) => String(o.value) === v)?.label || v);
  const currentText = current.length === 1 ? `All: ${show(current[0])}` : `Mixed (${current.length} different values)`;

  return (
    <div className={cn('rounded-xl border px-4 py-3 transition-colors', on ? 'border-brand-300 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-500/5' : 'border-slate-200 dark:border-slate-700')}>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{field.label}</span>
        <span className="text-xs text-slate-400">{currentText}</span>
      </label>
      {on && (
        <div className="mt-3 pl-7">
          {field.type === 'select' ? (
            <Select value={value} onChange={(e) => onChange(e.target.value)} error={Boolean(error)}>
              <option value="">Choose...</option>
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={field.type === 'number' ? 'number' : 'text'}
              inputMode={field.type === 'number' ? 'numeric' : undefined}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              error={Boolean(error)}
              placeholder={field.type === 'text' ? 'Leave empty to clear it' : undefined}
            />
          )}
          <FieldError>{error}</FieldError>
          {!error && field.hint && <p className="mt-1.5 text-xs text-slate-400">{field.hint}</p>}
        </div>
      )}
    </div>
  );
}
