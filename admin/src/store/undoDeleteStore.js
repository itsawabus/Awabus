import { create } from 'zustand';
import apiClient from '../api/client.js';
import { useAuthStore } from './authStore.js';

// Deletes wait a few seconds before they reach the server, so they can be
// undone. Until then the items are only hidden in the lists; "Undo" simply
// cancels the wait, so nothing on the server ever has to be rebuilt.
// If the page is closed or the admin signs out during the wait, the pending
// deletes are sent straight away (they were already confirmed).
// Bulk edits are saved at once instead, and offer an Undo that puts the old
// values back.

export const UNDO_SECONDS = 10;

const timers = new Map(); // job key -> timeout id
let seq = 0;

export const useUndoDeleteStore = create((set, get) => ({
  // { key, title, items: [{ id, label, path }], expiresAt, status, failures, onFinished }
  // status: 'pending' | 'running' | 'failed' | 'undone'
  jobs: [],

  /**
   * items: [{ id, label, path }] where path is the API path to DELETE, e.g. /students/123.
   * onFinished({ deleted, failed }) runs after the real delete (e.g. refresh lists);
   * it may return a promise, and items stay hidden until it settles.
   */
  scheduleDelete({ title, items, onFinished }) {
    const key = `d${(seq += 1)}`;
    const job = { key, title, items, expiresAt: Date.now() + UNDO_SECONDS * 1000, status: 'pending', failures: [], onFinished };
    set((s) => ({ jobs: [...s.jobs, job] }));
    timers.set(key, setTimeout(() => get().run(key), UNDO_SECONDS * 1000));
    return key;
  },

  /**
   * Edits are saved straight away; this offers an Undo for UNDO_SECONDS that
   * runs revert() (which puts the previous values back). Nothing happens when
   * the time runs out.
   */
  offerUndoEdit({ title, revert }) {
    const key = `e${(seq += 1)}`;
    const job = { key, kind: 'edit', title, items: [], expiresAt: Date.now() + UNDO_SECONDS * 1000, status: 'pending', failures: [], revert };
    set((s) => ({ jobs: [...s.jobs, job] }));
    timers.set(key, setTimeout(() => get().dismiss(key), UNDO_SECONDS * 1000));
    return key;
  },

  async undo(key) {
    const job = get().jobs.find((j) => j.key === key);
    if (!job || job.status !== 'pending') return;
    clearTimeout(timers.get(key));
    timers.delete(key);
    if (job.kind === 'edit') {
      set((s) => ({ jobs: s.jobs.map((j) => (j.key === key ? { ...j, status: 'running' } : j)) }));
      const failures = (await job.revert()) || [];
      if (failures.length) {
        set((s) => ({ jobs: s.jobs.map((j) => (j.key === key ? { ...j, status: 'failed', failures, deleted: 0, undoFailed: true } : j)) }));
        return;
      }
    }
    set((s) => ({ jobs: s.jobs.map((j) => (j.key === key ? { ...j, status: 'undone' } : j)) }));
    setTimeout(() => get().dismiss(key), 2500);
  },

  dismiss(key) {
    set((s) => ({ jobs: s.jobs.filter((j) => j.key !== key) }));
  },

  async run(key) {
    timers.delete(key);
    const job = get().jobs.find((j) => j.key === key);
    if (!job || job.status !== 'pending') return;
    set((s) => ({ jobs: s.jobs.map((j) => (j.key === key ? { ...j, status: 'running' } : j)) }));
    const failures = [];
    let deleted = 0;
    for (const item of job.items) {
      try {
        // One at a time: deleting one record can change what the next is allowed to do.
        // eslint-disable-next-line no-await-in-loop
        await apiClient.delete(item.path);
        deleted += 1;
      } catch (err) {
        failures.push({ label: item.label, message: err.message });
      }
    }
    try {
      await job.onFinished?.({ deleted, failed: failures.length });
    } catch {
      // refreshing the lists is best-effort
    }
    if (failures.length) {
      set((s) => ({ jobs: s.jobs.map((j) => (j.key === key ? { ...j, status: 'failed', failures, deleted } : j)) }));
    } else {
      get().dismiss(key);
    }
  },

  /** Sends every pending delete now (page closing, signing out). */
  flushAll() {
    const pending = get().jobs.filter((j) => j.status === 'pending' && j.kind !== 'edit');
    if (!pending.length) return;
    const { token } = useAuthStore.getState();
    const base = apiClient.defaults.baseURL?.replace(/\/$/, '') || '';
    pending.forEach((job) => {
      clearTimeout(timers.get(job.key));
      timers.delete(job.key);
      job.items.forEach((item) => {
        // keepalive lets the request finish even while the page is unloading.
        fetch(`${base}${item.path}`, {
          method: 'DELETE',
          keepalive: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => {});
      });
    });
    set((s) => ({ jobs: s.jobs.filter((j) => j.status !== 'pending' || j.kind === 'edit') }));
  },
}));

/** Ids waiting to be deleted (hidden from the lists until the wait is over). */
export function usePendingDeleteIds() {
  const jobs = useUndoDeleteStore((s) => s.jobs);
  const ids = new Set();
  jobs.forEach((j) => {
    if (j.status === 'pending' || j.status === 'running') j.items.forEach((i) => ids.add(i.id));
  });
  return ids;
}
