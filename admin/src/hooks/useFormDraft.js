import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';

// Unsaved form input is kept in localStorage so an admin can leave a page and
// pick up where they stopped. Drafts are namespaced per admin and wiped on
// logout (see authStore), because they can hold personal details of students and drivers.
const PREFIX = 'awabus.draft.';

const storageKey = (key) => `${PREFIX}${useAuthStore.getState().admin?._id || 'anon'}.${key}`;

function readDraft(fullKey) {
  try {
    const raw = localStorage.getItem(fullKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(fullKey, value) {
  try {
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch {
    // storage full or unavailable - the form still works, it just isn't remembered
  }
}

function removeDraft(fullKey) {
  try {
    localStorage.removeItem(fullKey);
  } catch {
    // ignore
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * State for a "create" form. Starts from the saved draft if there is one,
 * saves on every change, and forgets the draft once it's back to `initial`.
 * Returns [value, setValue, { restored, clear }].
 */
export function useCreateDraft(key, initial) {
  const fullKey = storageKey(key);
  const initialRef = useRef(initial);
  const [value, setValue] = useState(() => readDraft(fullKey) ?? initial);
  const [restored, setRestored] = useState(() => readDraft(fullKey) != null);

  useEffect(() => {
    if (same(value, initialRef.current)) removeDraft(fullKey);
    else writeDraft(fullKey, value);
  }, [fullKey, value]);

  const clear = useCallback(() => {
    removeDraft(fullKey);
    setValue(initialRef.current);
    setRestored(false);
  }, [fullKey]);

  return [value, setValue, { restored, clear }];
}

/**
 * State for an "edit" form. `baseline` is the record as loaded from the server
 * (null while loading). Unsaved changes are kept as a draft and restored the
 * next time the page opens; a form matching the server record stores nothing.
 * Returns [form, setForm, { restored, discard, clear }].
 */
export function useEditDraft(key, baseline) {
  const fullKey = storageKey(key);
  const [form, setForm] = useState(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (baseline && form === null) {
      const draft = readDraft(fullKey);
      setForm(draft ?? baseline);
      setRestored(draft != null && !same(draft, baseline));
    }
  }, [baseline, form, fullKey]);

  useEffect(() => {
    if (!form || !baseline) return;
    if (same(form, baseline)) removeDraft(fullKey);
    else writeDraft(fullKey, form);
    // Only react to the admin's edits; a refreshed baseline alone shouldn't write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, fullKey]);

  const discard = useCallback(() => {
    removeDraft(fullKey);
    setForm(baseline);
    setRestored(false);
  }, [fullKey, baseline]);

  const clear = useCallback(() => removeDraft(fullKey), [fullKey]);

  return [form, setForm, { restored, discard, clear }];
}

/**
 * Draft state for a multi-step "create" wizard: the form plus the current step.
 * Fields added to `initialForm` later are filled in for older saved drafts.
 */
export function useWizardDraft(key, initialForm) {
  const [draft, setDraft, { restored, clear }] = useCreateDraft(key, { form: initialForm, step: 1 });
  const form = { ...initialForm, ...draft.form };
  const setForm = useCallback(
    (update) =>
      setDraft((d) => {
        const current = { ...initialForm, ...d.form };
        return { ...d, form: typeof update === 'function' ? update(current) : update };
      }),
    // initialForm is a module-level constant in callers
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setDraft]
  );
  const setStep = useCallback(
    (update) => setDraft((d) => ({ ...d, step: typeof update === 'function' ? update(d.step) : update })),
    [setDraft]
  );
  return { form, setForm, step: draft.step, setStep, restored, clear };
}
