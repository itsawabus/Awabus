import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgXml } from 'react-native-svg';
import { QrCode, ShieldCheck, Users } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import ConfirmDialog from '../../../src/components/ui/ConfirmDialog.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { AssistantLine } from '../../../src/components/AssistantStatus.jsx';
import { createAssistPass, getAssistPass, getTodaysTrip, stopAssistPass } from '../../../src/api/driverApp.js';
import { colors, radii } from '../../../src/lib/theme.js';

// The last QR code shown for a trip is kept on this phone, so reopening this
// screen shows the same code (making a new one would cut the teacher off).
const QR_KEY = 'awabus.assistQr';
const loadQr = async (tripId) => {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(QR_KEY)) || 'null');
    return saved?.tripId === tripId ? saved : null;
  } catch {
    return null;
  }
};
const saveQr = (value) => AsyncStorage.setItem(QR_KEY, JSON.stringify(value)).catch(() => {});
const clearQr = () => AsyncStorage.removeItem(QR_KEY).catch(() => {});

const OPEN = ['Scheduled', 'In Progress', 'Delayed'];

/**
 * Bus assistant: the teacher on bus duty scans this QR code with their own
 * phone to help with the trip (roll call, boarding, messages to parents,
 * delay notices). The code works only until this trip ends.
 */
export default function Assistant() {
  return <AssistantScreen />;
}

/** Also opened from the trip screen (app/(app)/trip/assistant.jsx), with a back arrow. */
export function AssistantScreen({ back = false }) {
  const qc = useQueryClient();
  const { data: trip, isLoading } = useQuery({ queryKey: ['todays-trip'], queryFn: getTodaysTrip });
  const tripId = trip && OPEN.includes(trip.status) ? trip._id : null;
  const [qr, setQr] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const status = useQuery({
    queryKey: ['assist-pass', tripId],
    queryFn: () => getAssistPass(tripId),
    enabled: Boolean(tripId),
    refetchInterval: 15000,
  });

  useEffect(() => {
    let alive = true;
    if (tripId) loadQr(tripId).then((saved) => alive && setQr(saved));
    else setQr(null);
    return () => {
      alive = false;
    };
  }, [tripId]);

  // A code whose pass was stopped or has run out is not shown any more. Only
  // a status fetched after the code was made counts (right after "Show QR
  // code" the previous, pre-code status is still on screen for a moment).
  const active = status.data?.active;
  useEffect(() => {
    if (status.data && !active && qr && status.dataUpdatedAt > (qr.shownAt || 0)) {
      setQr(null);
      clearQr();
    }
  }, [status.data, status.dataUpdatedAt, active, qr]);

  const create = useMutation({
    mutationFn: () => createAssistPass(tripId),
    onSuccess: (data) => {
      const value = { tripId, url: data.url, qrSvg: data.qrSvg, expiresAt: data.expiresAt, shownAt: Date.now() };
      setQr(value);
      saveQr(value);
      qc.invalidateQueries({ queryKey: ['assist-pass', tripId] });
    },
  });
  const stop = useMutation({
    mutationFn: () => stopAssistPass(tripId),
    onSuccess: () => {
      setQr(null);
      clearQr();
      qc.invalidateQueries({ queryKey: ['assist-pass', tripId] });
    },
  });

  const helpers = status.data?.assistants || [];

  return (
    <View style={{ flex: 1 }}>
      <Header title="Bus assistant" back={back} right={<View style={{ width: 36 }} />} />
      {isLoading ? (
        <PageLoader />
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <QrCode size={18} color={colors.navy} />
              </View>
              <Text style={styles.intro}>
                Let the teacher on bus duty help you: they scan the code with their phone and can do the roll call, mark
                boarding and drop-off, text parents and send a delay notice. It stops working when this trip ends.
              </Text>
            </View>
          </Card>

          {!tripId ? (
            <Card style={styles.card}>
              <Text style={styles.empty}>There is no trip right now. Open this page when today&apos;s trip is ready.</Text>
            </Card>
          ) : qr && (active || !(status.dataUpdatedAt > (qr.shownAt || 0))) ? (
            <Card style={[styles.card, styles.qrCard]}>
              <View style={styles.qrBox}>
                <SvgXml xml={qr.qrSvg} width={240} height={240} />
              </View>
              <Text style={styles.qrHint}>Ask the teacher to scan this with their phone camera.</Text>
              <Text style={styles.link} selectable>
                {qr.url}
              </Text>
              <Button
                variant="ghost"
                onPress={() =>
                  setConfirm({
                    title: 'Make a new code?',
                    message: 'The current code stops working. Anyone using it will need to scan the new one.',
                    confirmLabel: 'New code',
                    onConfirm: () => create.mutate(),
                  })
                }
                loading={create.isPending}
                style={{ marginTop: 12 }}
              >
                New code
              </Button>
              <Button
                variant="danger"
                onPress={() =>
                  setConfirm({
                    title: 'Stop sharing this trip?',
                    message: 'The teacher’s page stops working straight away.',
                    confirmLabel: 'Stop sharing',
                    danger: true,
                    onConfirm: () => stop.mutate(),
                  })
                }
                loading={stop.isPending}
                style={{ marginTop: 8 }}
              >
                Stop sharing
              </Button>
            </Card>
          ) : (
            <Card style={styles.card}>
              {active ? (
                <Text style={styles.empty}>A teacher already has a link for this trip. Show a new code to add someone (the old code stops working).</Text>
              ) : null}
              <Button onPress={() => create.mutate()} loading={create.isPending} style={{ marginTop: active ? 12 : 0 }}>
                Show QR code
              </Button>
              {create.isError ? <Text style={styles.error}>{create.error.message}</Text> : null}
            </Card>
          )}

          {tripId && helpers.length ? (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Users size={16} color={colors.slate500} />
                <Text style={styles.helpersTitle}>Helping on this trip</Text>
              </View>
              {helpers.map((h) => (
                <AssistantLine key={h.name} assistant={h} style={{ marginTop: 8 }} />
              ))}
            </Card>
          ) : null}

          <View style={[styles.row, { paddingHorizontal: 4 }]}>
            <ShieldCheck size={14} color={colors.slate400} />
            <Text style={styles.note}>
              The teacher cannot start or end the trip. What they do is recorded as &quot;Bus assistant&quot; for the school.
            </Text>
          </View>
        </ScrollView>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  card: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  intro: { flex: 1, fontSize: 13, color: colors.slate600, lineHeight: 19 },
  empty: { fontSize: 14, color: colors.slate600 },
  qrCard: { alignItems: 'center' },
  qrBox: { padding: 12, backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.slate200 },
  qrHint: { marginTop: 12, fontSize: 14, fontWeight: '700', color: colors.slate800, textAlign: 'center' },
  link: { marginTop: 6, fontSize: 11, color: colors.slate400, textAlign: 'center' },
  error: { marginTop: 8, color: colors.red600, fontSize: 13 },
  helpersTitle: { fontSize: 14, fontWeight: '800', color: colors.slate800 },
  helper: { marginTop: 6, fontSize: 14, color: colors.slate700 },
  note: { flex: 1, fontSize: 12, color: colors.slate400 },
});
