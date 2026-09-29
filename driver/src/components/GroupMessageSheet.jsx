import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import { Label, Textarea } from './ui/Input.jsx';
import { sendParentMessage } from '../api/driverApp.js';
import { colors, radii, themed } from '../lib/theme.js';

const MAX = 140;

// Ready-made messages for several parents at once (no child's name in them).
const quickMessages = (session) => [
  session === 'evening' ? 'The bus has left school and is on the way home.' : 'The bus is on the way to your pick-up point.',
  'The bus will reach you in about 5 minutes.',
  'The bus is running a few minutes late today.',
  session === 'evening' ? 'Please be ready to meet your child at the drop-off point.' : 'Please have your child ready at the pick-up point.',
];

/**
 * One SMS to the parents of several students (the students selected on the
 * trip screen). Brothers and sisters share a parent, so each parent gets the
 * message once. `target` is { tripId, session, students: [student] } or null.
 */
export default function GroupMessageSheet({ target, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { sent, saved, failed: [{ name, reason }] }

  useEffect(() => {
    setText('');
    setResult(null);
  }, [target]);

  const students = target?.students || [];
  // One per parent phone; the first child's record carries the message.
  const byParent = [];
  const seen = new Set();
  const noPhone = [];
  for (const s of students) {
    const phone = s?.primaryGuardian?.phone;
    if (!phone) {
      noPhone.push(s);
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    byParent.push(s);
  }

  const send = async () => {
    setSending(true);
    const out = { sent: 0, saved: 0, failed: noPhone.map((s) => ({ name: s.firstName, reason: 'no parent phone' })) };
    for (const s of byParent) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await sendParentMessage(target.tripId, s._id, text.trim());
        if (res?.status === 'sent') out.sent += 1;
        else out.saved += 1;
      } catch (err) {
        out.failed.push({ name: s.firstName, reason: err.message });
      }
    }
    setSending(false);
    setResult(out);
  };

  const close = () => {
    if (sending) return;
    onClose(Boolean(result));
  };

  return (
    <Modal open={Boolean(target)} onClose={close}>
      {target && (
        <>
          <Text style={styles.title}>Message {byParent.length} parent{byParent.length === 1 ? '' : 's'}</Text>
          <Text style={styles.sub}>
            For {students.map((s) => s.firstName).join(', ')}. Sent as an SMS from AwaBus
            {byParent.length < students.length - noPhone.length ? '; brothers and sisters share one message' : ''}.
          </Text>

          {result ? (
            <View style={styles.done}>
              <CheckCircle2 size={22} color={colors.brand600} />
              <Text style={styles.doneText}>
                {result.sent ? `Sent to ${result.sent} parent${result.sent === 1 ? '' : 's'}.` : ''}
                {result.saved ? ` ${result.saved} saved: they go out once SMS is switched on for the school.` : ''}
              </Text>
              {result.failed.map((f) => (
                <Text key={f.name + f.reason} style={styles.error}>
                  {f.name}: {f.reason}
                </Text>
              ))}
              <Button onPress={() => onClose(true)} style={{ marginTop: 16, alignSelf: 'stretch' }}>
                Done
              </Button>
            </View>
          ) : (
            <>
              <Label style={{ marginTop: 16 }}>Quick messages</Label>
              <View style={{ gap: 8 }}>
                {quickMessages(target.session).map((m) => (
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
              {noPhone.length ? (
                <Text style={styles.note}>No parent phone for {noPhone.map((s) => s.firstName).join(', ')}.</Text>
              ) : null}

              <Button onPress={send} loading={sending} disabled={!text.trim() || !byParent.length} style={{ marginTop: 12 }}>
                Send to {byParent.length} parent{byParent.length === 1 ? '' : 's'}
              </Button>
              <Button variant="ghost" onPress={close} disabled={sending} style={{ marginTop: 8 }}>
                Cancel
              </Button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

const styles = themed(() => ({
  title: { fontSize: 20, fontWeight: '800', color: colors.slate900 },
  sub: { marginTop: 4, fontSize: 13, color: colors.slate500 },
  quick: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.lg, paddingVertical: 10, paddingHorizontal: 12 },
  quickOn: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  quickText: { fontSize: 13, color: colors.slate700 },
  count: { marginTop: 4, textAlign: 'right', fontSize: 12, color: colors.slate400 },
  note: { marginTop: 4, fontSize: 12, color: colors.amber700 },
  error: { marginTop: 4, color: colors.red600, fontSize: 13, textAlign: 'center' },
  done: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  doneText: { fontSize: 15, fontWeight: '600', color: colors.slate800, textAlign: 'center' },
}));
