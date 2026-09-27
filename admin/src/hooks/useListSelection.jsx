import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UNDO_SECONDS, useUndoDeleteStore } from '../store/undoDeleteStore.js';
import { AlertTriangle, CheckSquare, Pencil, Trash2, X } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import BulkEditModal from '../components/ui/BulkEditModal.jsx';
import { cn } from '../lib/utils.js';

const HOLD_MS = 500;

function SelectBox({ checked, indeterminate = false, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded border transition-colors',
        checked || indeterminate
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white hover:border-brand-500 dark:border-slate-600 dark:bg-navy-light'
      )}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      )}
      {!checked && indeterminate && <span className="h-0.5 w-2.5 rounded bg-white" />}
    </button>
  );
}

/**
 * Multi-select for a list page. Select mode starts from the "Select" button or
 * by pressing and holding a row. While selecting, clicking a row ticks it
 * instead of opening it, and a bar at the bottom offers Delete.
 *
 * Deletes go through the undo wait (see undoDeleteStore) and then the page's
 * normal delete endpoint one by one, so every existing safety rule still
 * applies; anything that can't be deleted is reported with the reason.
 */
export default function useListSelection({ items, getLabel, deletePath, noun, singular, invalidate = [], bulkEdit = null }) {
  const queryClient = useQueryClient();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Map()); // id -> item (kept across pages)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const holdTimer = useRef(null);
  const heldRef = useRef(false);

  const stop = useCallback(() => {
    setSelecting(false);
    setSelected(new Map());
  }, []);

  // Esc leaves select mode.
  useEffect(() => {
    if (!selecting) return undefined;
    const onKey = (e) => e.key === 'Escape' && !confirmOpen && !editOpen && stop();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selecting, confirmOpen, editOpen, stop]);

  const toggle = (item, on) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const want = on ?? !next.has(item._id);
      if (want) next.set(item._id, item);
      else next.delete(item._id);
      return next;
    });

  const pageIds = items.map((i) => i._id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const allOnPage = pageIds.length > 0 && pageSelected === pageIds.length;
  const setAllOnPage = (on) =>
    setSelected((prev) => {
      const next = new Map(prev);
      items.forEach((i) => (on ? next.set(i._id, i) : next.delete(i._id)));
      return next;
    });

  const cancelHold = () => clearTimeout(holdTimer.current);

  /** Props for a <Tr>: click opens (or ticks, while selecting); press-and-hold starts selecting. */
  const rowProps = (item, open) => ({
    className: cn('cursor-pointer select-none', selected.has(item._id) && 'bg-brand-50/70 dark:bg-brand-500/10'),
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      heldRef.current = false;
      cancelHold();
      holdTimer.current = setTimeout(() => {
        heldRef.current = true;
        setSelecting(true);
        toggle(item, true);
        if (navigator.vibrate) navigator.vibrate(30);
      }, HOLD_MS);
    },
    onPointerUp: cancelHold,
    onPointerLeave: cancelHold,
    onPointerCancel: cancelHold,
    onContextMenu: (e) => {
      // A long press on a phone opens the context menu; keep it for selecting.
      if (heldRef.current || selecting) e.preventDefault();
    },
    onClick: () => {
      if (heldRef.current) {
        heldRef.current = false; // this click ends the long press
        return;
      }
      if (selecting) toggle(item);
      else open();
    },
  });

  const headerCell = selecting ? (
    <th className="w-10 px-4 py-3">
      <SelectBox
        checked={allOnPage}
        indeterminate={!allOnPage && pageSelected > 0}
        onChange={setAllOnPage}
        label="Select all on this page"
      />
    </th>
  ) : null;

  const cell = (item) =>
    selecting ? (
      <td className="w-10 px-4 py-3.5">
        <SelectBox checked={selected.has(item._id)} onChange={(on) => toggle(item, on)} label={`Select ${getLabel(item)}`} />
      </td>
    ) : null;

  const toolbarButton = (
    <Button
      variant="outline"
      onClick={() => (selecting ? stop() : setSelecting(true))}
      title="Select several items, e.g. to delete them together. You can also press and hold a row."
    >
      <CheckSquare className="h-4 w-4" /> {selecting ? 'Cancel selection' : 'Select'}
    </Button>
  );

  const scheduleDelete = useUndoDeleteStore((st) => st.scheduleDelete);
  const offerUndoEdit = useUndoDeleteStore((st) => st.offerUndoEdit);
  const refresh = () =>
    Promise.all([...invalidate, 'dashboard'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

  // Bulk edit: save the same fields on every selected item through the normal
  // update call, then offer an Undo that puts each item's old values back.
  const applyEdit = async (payload, onProgress) => {
    const targets = [...selected.values()];
    const changed = [];
    const failures = [];
    for (const [i, item] of targets.entries()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await bulkEdit.updateOne(item._id, payload);
        changed.push(item);
      } catch (err) {
        failures.push({ label: getLabel(item), message: err.message });
      }
      onProgress(i + 1);
    }
    await refresh();
    if (changed.length) {
      const keys = Object.keys(payload);
      offerUndoEdit({
        title: changed.length === 1 ? getLabel(changed[0]) : `${changed.length} ${noun}`,
        revert: async () => {
          const undoFailures = [];
          for (const item of changed) {
            const previous = Object.fromEntries(keys.map((k) => [k, bulkEdit.fields.find((fl) => fl.key === k).get(item) ?? '']));
            try {
              // eslint-disable-next-line no-await-in-loop
              await bulkEdit.updateOne(item._id, previous);
            } catch (err) {
              undoFailures.push({ label: getLabel(item), message: err.message });
            }
          }
          await refresh();
          return undoFailures;
        },
      });
    }
    if (!failures.length) stop();
    return { failures };
  };

  const runDelete = () => {
    const targets = [...selected.values()];
    scheduleDelete({
      title: targets.length === 1 ? getLabel(targets[0]) : `${targets.length} ${noun}`,
      items: targets.map((item) => ({ id: item._id, label: getLabel(item), path: deletePath(item._id) })),
      onFinished: refresh,
    });
    stop();
  };

  const count = selected.size;
  const names = [...selected.values()].map(getLabel);

  const bar = selecting ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:pl-64">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl dark:border-slate-700 dark:bg-navy-light">
        <span className="mr-auto text-sm font-semibold text-slate-800 dark:text-slate-100">
          {count ? `${count} selected` : `Tap ${noun} to select them`}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setAllOnPage(!allOnPage)} disabled={!items.length}>
          {allOnPage ? 'Unselect this page' : 'Select all on this page'}
        </Button>
        {count > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Map())}>
            Clear
          </Button>
        )}
        {bulkEdit && (
          <Button size="sm" variant="outline" disabled={!count} onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit{count ? ` (${count})` : ''}
          </Button>
        )}
        <Button size="sm" variant="danger" disabled={!count} onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete{count ? ` (${count})` : ''}
        </Button>
        <button
          type="button"
          onClick={stop}
          aria-label="Done selecting"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-navy"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  ) : null;

  const dialog = (
    <>
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete ${count} ${count === 1 ? singular : noun}?`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                runDelete();
                setConfirmOpen(false);
              }}
            >
              Yes, delete {count}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p>You&apos;ll have {UNDO_SECONDS} seconds to undo. After that it&apos;s permanent.</p>
            <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-slate-800 dark:text-slate-100">
              {names.slice(0, 8).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            {names.length > 8 && <p className="mt-1 text-slate-500">…and {names.length - 8} more</p>}
          </div>
        </div>
      </Modal>
      {bulkEdit && (
        <BulkEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          items={[...selected.values()]}
          fields={bulkEdit.fields}
          noun={noun}
          singular={singular}
          onApply={applyEdit}
        />
      )}
    </>
  );

  return { selecting, rowProps, headerCell, cell, toolbarButton, bar, dialog };
}
