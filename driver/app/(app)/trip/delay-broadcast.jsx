import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import { Label, Textarea } from '../../../src/components/ui/Input.jsx';
import { OptionField } from '../../../src/components/ui/OptionPicker.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import Modal from '../../../src/components/ui/Modal.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { getTodaysTrip, sendDelayBroadcast } from '../../../src/api/driverApp.js';
import { colors, radii } from '../../../src/lib/theme.js';
import { delayAffects } from '../../../src/lib/runs.js';

// Same limit as the server, so the SMS stays one message.
const MAX_MESSAGE = 100;

const REASONS = ['Heavy traffic', 'Vehicle breakdown', 'Weather conditions', 'Road closure', 'Other'].map((r) => ({
  value: r,
  label: r,
}));

export default function DelayBroadcast() {
  const { data: trip, isLoading } = useQuery({ queryKey: ['todays-trip'], queryFn: getTodaysTrip });
  const [reason, setReason] = useState(REASONS[0].value);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [message, setMessage] = useState('We expect to be about 25 minutes late.');
  const [confirmSend, setConfirmSend] = useState(false);

  const mutation = useMutation({
    mutationFn: () => sendDelayBroadcast(trip._id, { reason, message }),
    onSuccess: (result) =>
      router.push({
        pathname: '/trip/delay-broadcast-sent',
        params: {
          recipientCount: result.data.recipientCount,
          deliveredCount: result.data.deliveredCount,
          failedCount: result.data.failedCount,
          sentAt: result.data.sentAt,
        },
      }),
  });

  if (isLoading || !trip) return <PageLoader />;

  // Same rule as the server: only children still waiting on this run.
  const attending = (trip.studentProgress || []).filter((p) => delayAffects(p, trip.session)).length;
  const preview = `AwaBus: ${trip.route?.name || 'Your route'} is running late. ${message}`.trim();

  return (
    <View style={{ flex: 1 }}>
      <Header title="Delay broadcast" back />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <Mail size={28} color={colors.ink} />
        </View>
        <Text style={styles.title}>Notify attending parents</Text>
        <Text style={styles.subtitle}>
          Sends one SMS to the parents of the {attending} student{attending === 1 ? '' : 's'} still waiting
          {trip.session === 'morning' ? ' to be picked up' : trip.session === 'evening' ? ' to be dropped home' : ''}. Children already
          {trip.session === 'morning' ? ' picked up' : ' dropped'} are left out.
        </Text>

        <View style={styles.field}>
          <Label>Delay reason</Label>
          <OptionField
            label="Delay reason"
            value={reason}
            options={REASONS}
            onChange={setReason}
            open={reasonOpen}
            onOpen={() => setReasonOpen(true)}
            onClose={() => setReasonOpen(false)}
          />
        </View>

        <View style={styles.field}>
          <Label>Additional message</Label>
          <Textarea value={message} onChangeText={setMessage} maxLength={MAX_MESSAGE} />
          <Text style={styles.counter}>
            {message.length}/{MAX_MESSAGE}
          </Text>
        </View>

        <View style={styles.field}>
          <Label>Preview</Label>
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Button onPress={() => setConfirmSend(true)}>Send SMS broadcast</Button>
      </SafeAreaView>

      <Modal open={confirmSend} onClose={() => setConfirmSend(false)}>
        <Text style={styles.sheetTitle}>Send this SMS?</Text>
        <Text style={styles.sheetSubtitle}>
          It goes to the parents of {attending} student{attending === 1 ? '' : 's'} right away and can't be unsent.
        </Text>
        {mutation.isError && <Text style={styles.errorText}>{mutation.error.message}</Text>}
        <Button loading={mutation.isPending} onPress={() => mutation.mutate()} style={{ marginTop: 16 }}>
          Send SMS
        </Button>
        <Button variant="ghost" onPress={() => setConfirmSend(false)} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingTop: 24 },
  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.slate900, textAlign: 'center' },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.slate500, textAlign: 'center', marginBottom: 24 },
  field: { marginBottom: 20 },
  counter: { marginTop: 4, fontSize: 12, color: colors.slate400, textAlign: 'right' },
  previewBox: { backgroundColor: colors.slate100, borderRadius: radii.lg, padding: 14 },
  previewText: { fontSize: 14, color: colors.slate700, lineHeight: 20 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.slate900 },
  sheetSubtitle: { fontSize: 14, color: colors.slate500, marginTop: 6, lineHeight: 20 },
  errorText: { fontSize: 13, color: colors.red600, marginTop: 10 },
});
