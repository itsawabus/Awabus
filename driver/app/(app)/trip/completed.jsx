import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../../src/components/ui/Card.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { getTripById } from '../../../src/api/driverApp.js';
import { formatDateTime, formatDuration } from '../../../src/lib/utils.js';
import { colors } from '../../../src/lib/theme.js';

export default function TripCompleted() {
  const { tripId } = useLocalSearchParams();
  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTripById(tripId),
    enabled: Boolean(tripId),
  });

  if (isLoading || !trip) return <PageLoader />;

  const progress = trip.studentProgress || [];
  const attending = progress.filter((p) => p.attendance === 'Present').length;
  const unresolved = progress.filter(
    (p) => p.attendance === 'Present' && p.dropoffStatus !== 'On board' && p.dropoffStatus !== 'Dropped off'
  ).length;
  const broadcasts = trip.delayBroadcasts || [];
  const totalRecipients = broadcasts.reduce((sum, b) => sum + (b.recipientCount || 0), 0);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={styles.banner}>
        <View style={styles.iconWrap}>
          <CheckCheck size={28} color={colors.white} />
        </View>
        <Text style={styles.bannerTitle}>Trip completed</Text>
        <Text style={styles.bannerSubtitle}>Nice work. Every parent has been notified.</Text>
      </SafeAreaView>

      <View style={styles.content}>
        <Card>
          <Text style={styles.sectionLabel}>Trip performance summary</Text>
          <Row label="Trip duration" value={formatDuration(trip.durationMinutes)} />
          <Row label="Students on trip" value={attending} />
          <Row label="Alerts / check" value={unresolved} />
          <Row label="Delay broadcasts" value={broadcasts.length ? `${broadcasts.length} sent to ${totalRecipients} parents` : '0'} />
          <Row label="Trip ended" value={formatDateTime(trip.endedAt || trip.date)} last />
        </Card>

        <Text style={styles.syncNote}>
          All offline events and background tasks successfully synchronized with the central school management
          server.
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

const Row = ({ label, value, last }) => (
  <View style={[styles.row, !last && styles.rowBorder]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
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
  syncNote: { textAlign: 'center', color: colors.slate500, fontSize: 13 },
  footer: { padding: 16, gap: 4 },
  linkButton: { alignSelf: 'center', marginTop: 8 },
});
