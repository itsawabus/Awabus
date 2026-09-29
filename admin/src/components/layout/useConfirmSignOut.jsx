import { useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { useUndoDeleteStore } from '../../store/undoDeleteStore.js';

/**
 * Sign-out behind an "are you sure" dialog: signing out also deletes any
 * unsaved form drafts. Returns [requestSignOut, dialog] - render the dialog.
 */
export default function useConfirmSignOut() {
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const dialog = (
    <ConfirmDialog
      open={open}
      title="Sign out?"
      message="You'll need to sign in again, and any forms you haven't saved yet will be cleared."
      confirmLabel="Sign out"
      onClose={() => setOpen(false)}
      onConfirm={() => {
        setOpen(false);
        // Deletes still in their undo window were confirmed, so send them first.
        useUndoDeleteStore.getState().flushAll();
        logout();
      }}
    />
  );
  return [() => setOpen(true), dialog];
}
