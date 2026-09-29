import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../../src/components/ui/Card.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { useOfflineQueueStore } from '../../../src/store/offlineQueueStore.js';
import { getTripById } from '../../../src/api/driverApp.js';
import { formatDateTime, formatDuration } from '../../../src/lib/utils.js';
import { colors } from '../../../src/lib/theme.js';
import { runWords } from '../../../src/lib/runs.js';

export default function TripCompleted() {
  const { tripId } = useLocalSearchParams();
  const waitingToSync = useOfflineQueueStore((s) => s.queue.filter((q) => q.tripId === tripId).length);
  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTripById(tripId),
    enabled: Boolean(tripId),
  });

  if (isLoading || !trip) return <PageLoader />;

  const progress = trip.studentProgress || [];
  const riding = progress.filter((p) => p.attendance !== 'Absent' && p.attendance !== 'Cancelled');
  const count = (status) => riding.filter((p) => p.dropoffStatus === status).length;
  const droppedOff = count('Dropped off');
  const stillOnBoard = count('On board');
  const notHere = count('Not on board');
  const neverScanned = riding.length - droppedOff - stillOnBoard - notHere;
  const absent = progress.length - riding.length;
  const allGood = stillOnBoard === 0 && neverScanned === 0;
  const w = runWords(trip.session);
  const broadcasts = trip.delayBroadcasts || [];
  const totalRecipients = broadcasts.reduce((sum, b) => sum + (b.recipientCount || 0), 0);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={styles.banner}>
        <View style={styles.iconWrap}>
          <CheckCheck size={28} color={colors.white} />
        </View>
        <Text style={styles.bannerTitle}>{trip.session ? `${w.name} completed` : 'Trip completed'}</Text>
        <Text style={styles.bannerSubtitle}>
          {allGood ? 'Every student on this trip is accounted for.' : 'Some students need checking. See below.'}
        </Text>
      </SafeAreaView>

      <View style={styles.content}>
        <Card>
          <Text style={styles.sectionLabel}>Trip performance summary</Text>
          <Row label="Trip duration" value={formatDuration(trip.durationMinutes)} />
          <Row label={w.drop} value={`${droppedOff} of ${riding.length}`} />
          {stillOnBoard > 0 && <Row label={`Still marked ${w.onBus}`} value={stillOnBoard} warn />}
          {neverScanned > 0 && <Row label={`Never marked ${w.board.toLowerCase()}`} value={neverScanned} warn />}
          {notHere > 0 && <Row label={w.notHere} value={notHere} />}
          {absent > 0 && <Row label="Absent" value={absent} />}
          <Row label="Delay broadcasts" value={broadcasts.length ? `${broadcasts.length} sent to ${totalRecipients} parents` : '0'} />
          <Row label="Trip ended" value={formatDateTime(trip.endedAt || trip.date)} last />
        </Card>

        <Text style={styles.syncNote}>
          {waitingToSync
            ? `${waitingToSync} update${waitingToSync === 1 ? ' is' : 's are'} still waiting to reach the school. Keep the app open when you are back online.`
            : 'Everything from this trip has reached the school.'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button onPress={() => router.replace('/')}>Back to home</Button>
        <Button variant="link" style={styles.linkButton} onPress={() => router.replace('/trip-history')}>
          View trip history
        </Button>
      </View>
    </View>
  );
}

const Row = ({ label, value, last, warn }) => (
  <View style={[styles.row, !last && styles.rowBorder]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, warn && styles.rowWarn]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    paddingBottom: 32,
    paddingTop: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bannerTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  bannerSubtitle: { marginTop: 4, color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  content: { flex: 1, padding: 16, gap: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: colors.slate400, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  rowLabel: { color: colors.slate500, fontSize: 14 },
  rowValue: { color: colors.slate800, fontWeight: '700', fontSize: 14 },
  rowWarn: { color: colors.red600 },
  syncNote: { textAlign: 'center', color: colors.slate500, fontSize: 13 },
  footer: { padding: 16, gap: 4 },
  linkButton: { alignSelf: 'center', marginTop: 8 },
});
