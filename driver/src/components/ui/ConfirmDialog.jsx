import { StyleSheet, Text } from 'react-native';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { colors } from '../../lib/theme.js';

/**
 * "Are you sure?" sheet shown before an action is carried out.
 * `request` is { title, message, confirmLabel, danger, onConfirm } or null.
 */
export default function ConfirmDialog({ request, onClose, loading = false }) {
  const open = Boolean(request);
  return (
    <Modal open={open} onClose={onClose}>
      {request && (
        <>
          <Text style={styles.title}>{request.title}</Text>
          {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          <Button
            variant={request.danger ? 'danger' : 'primary'}
            loading={loading}
            onPress={() => {
              const run = request.onConfirm;
              onClose();
              run?.();
            }}
            style={{ marginTop: 20 }}
          >
            {request.confirmLabel || 'Yes, continue'}
          </Button>
          <Button variant="ghost" onPress={onClose} style={{ marginTop: 10 }}>
            Cancel
          </Button>
        </>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.slate900 },
  message: { marginTop: 6, fontSize: 14, color: colors.slate500, lineHeight: 20 },
});
