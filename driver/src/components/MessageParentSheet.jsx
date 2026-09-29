import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react-native';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import { Label, Textarea } from './ui/Input.jsx';
import { sendParentMessage } from '../api/driverApp.js';
import { guardianName } from './StudentMeta.jsx';
import { colors, radii } from '../lib/theme.js';

const MAX = 140;

// Ready-made messages, so a message takes one tap.
const quickMessages = (first) => [
  `The bus is at the pick-up point now. Please bring ${first} out.`,
  `The bus will reach you in about 5 minutes.`,
  `The bus is running a few minutes late today.`,
  `${first} was not at the pick-up point. Please call the school office.`,
];

/**
 * Sheet for texting one student's parent from the bus. The SMS goes out
 * through the AwaBus line (not the driver's own number or airtime).
 * `target` is { tripId, student } or null.
 */
export default function MessageParentSheet({ target, onClose }) {
  const [text, setText] = useState('');
  const student = target?.student;
  const parent = student?.primaryGuardian;
  const first = student?.firstName || 'your child';

  const send = useMutation({ mutationFn: () => sendParentMessage(target.tripId, student._id, text.trim()) });

  // Fresh sheet for each student.
  useEffect(() => {
    setText('');
    send.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.student?._id]);

  const close = () => {
    setText('');
    send.reset();
    onClose();
  };

  return (
    <Modal open={Boolean(target)} onClose={close}>
      {target && (
        <>
          <Text style={styles.title}>Message {guardianName(parent) || 'the parent'}</Text>
          <Text style={styles.sub}>
            About {student.firstName} {student.lastName}. Sent as an SMS from AwaBus.
          </Text>

          {send.isSuccess ? (
            <View style={styles.done}>
              <CheckCircle2 size={22} color={colors.brand600} />
              <Text style={styles.doneText}>
                {send.data?.status === 'sent' ? 'Message sent.' : 'Message saved. It will be sent once SMS is switched on for the school.'}
              </Text>
              <Button onPress={close} style={{ marginTop: 16, alignSelf: 'stretch' }}>
                Done
              </Button>
            </View>
          ) : (
            <>
              <Label style={{ marginTop: 16 }}>Quick messages</Label>
              <View style={{ gap: 8 }}>
                {quickMessages(first).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setText(m.slice(0, MAX))}
                    style={({ pressed }) => [styles.quick, text === m && styles.quickOn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.quickText}>{m}</Text>
                  </Pressable>
                ))}
              </View>

              <Label style={{ marginTop: 16 }}>Message</Label>
              <Textarea value={text} onChangeText={(v) => setText(v.slice(0, MAX))} placeholder="Type a short message" maxLength={MAX} />
              <Text style={styles.count}>
                {text.length}/{MAX}
              </Text>

              {send.isError ? <Text style={styles.error}>{send.error.message}</Text> : null}

              <Button onPress={() => send.mutate()} loading={send.isPending} disabled={!text.trim()} style={{ marginTop: 12 }}>
                Send message
              </Button>
              <Button variant="ghost" onPress={close} style={{ marginTop: 8 }}>
                Cancel
              </Button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.slate900 },
  sub: { marginTop: 4, fontSize: 13, color: colors.slate500 },
  quick: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.lg, paddingVertical: 10, paddingHorizontal: 12 },
  quickOn: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  quickText: { fontSize: 13, color: colors.slate700 },
  count: { marginTop: 4, textAlign: 'right', fontSize: 12, color: colors.slate400 },
  error: { marginTop: 8, color: colors.red600, fontSize: 13 },
  done: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  doneText: { fontSize: 15, fontWeight: '600', color: colors.slate800, textAlign: 'center' },
});
