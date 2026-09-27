import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Mail, MapPin } from 'lucide-react-native';
import Header from '../../../../src/components/layout/Header.jsx';
import Card from '../../../../src/components/ui/Card.jsx';
import Badge from '../../../../src/components/ui/Badge.jsx';
import { PageLoader } from '../../../../src/components/ui/Spinner.jsx';
import { getTripById } from '../../../../src/api/driverApp.js';
import { formatDate, formatDuration, formatTime } from '../../../../src/lib/utils.js';
import { colors } from '../../../../src/lib/theme.js';

const STATUS_TONE = { Completed: 'success', Cancelled: 'danger', Delayed: 'warning' };
const DROPOFF_TONE = { 'Dropped off': 'success', 'On board': 'warning', 'Not picked up': 'neutral' };

export default function TripHistoryDetail() {
  const { id } = useLocalSearchParams();
  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => getTripById(id),
    enabled: Boolean(id),
  });

  if (isLoading || !trip) return <PageLoader />;

  const progress = trip.studentProgress || [];
  const attending = progress.filter((p) => p.attendance === 'Present');
  const broadcasts = trip.delayBroadcasts || [];

  return (
    <View style={{ flex: 1 }}>
      <Header title="Trip details" back />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.headCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.routeName}>{trip.route?.name}</Text>
              <Text style={styles.plate}>{trip.bus?.plateNumber}</Text>
            </View>
            <Badge tone={STATUS_TONE[trip.status] || 'neutral'}>{trip.status}</Badge>
          </View>
          <Text style={styles.dateText}>{formatDate(trip.date)}</Text>

          <View style={styles.statsRow}>
            <Stat label="Departure" value={formatTime(trip.departureTime || trip.startedAt)} />
            <Stat label="Arrival" value={formatTime(trip.arrivalTime || trip.endedAt)} />
            <Stat label="Duration" value={formatDuration(trip.durationMinutes)} />
          </View>
        </Card>

        <Text style={styles.sectionTitle}>
          Student roster ({attending.length}/{progress.length} attending)
        </Text>
        <Card style={styles.rosterCard}>
          {progress.length === 0 ? (
            <Text style={styles.emptyText}>No students were scheduled for this trip.</Text>
          ) : (
            progress.map((p, index) => (
              <View
                key={p.student?._id || p._id}
                style={[styles.studentRow, index < progress.length - 1 && styles.studentRowBorder]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{p.student?.name || 'Unknown student'}</Text>
                  <Text style={styles.studentMeta}>{p.attendance === 'Present' ? 'Attending' : 'Not attending'}</Text>
                </View>
                {p.attendance === 'Present' && (
                  <Badge tone={DROPOFF_TONE[p.dropoffStatus] || 'neutral'}>{p.dropoffStatus || 'Not picked up'}</Badge>
                )}
              </View>
            ))
          )}
        </Card>

        <Text style={styles.sectionTitle}>Delay broadcasts ({broadcasts.length})</Text>
        <Card style={styles.rosterCard}>
          {broadcasts.length === 0 ? (
            <View style={styles.emptyBroadcast}>
              <MapPin size={22} color={colors.slate300} />
              <Text style={styles.emptyText}>No delay broadcasts were sent on this trip.</Text>
            </View>
          ) : (
            broadcasts.map((b, index) => (
              <View key={b._id || index} style={[styles.broadcastRow, index < broadcasts.length - 1 && styles.studentRowBorder]}>
                <View style={styles.broadcastIcon}>
                  <Mail size={16} color={colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{b.reason}</Text>
                  <Text style={styles.studentMeta}>{b.message}</Text>
                  <Text style={styles.broadcastMeta}>
                    Sent to {b.recipientCount} parent{b.recipientCount === 1 ? '' : 's'} · {formatTime(b.sentAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const Stat = ({ label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  headCard: { gap: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeName: { fontWeight: '800', color: colors.slate900, fontSize: 17 },
  plate: { color: colors.slate500, fontSize: 13 },
  dateText: { color: colors.slate500, fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: 14 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontWeight: '800', color: colors.slate800, fontSize: 15 },
  statLabel: { color: colors.slate400, fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate500, marginTop: 4 },
  rosterCard: { padding: 0, overflow: 'hidden' },
  studentRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  studentRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  studentName: { fontWeight: '700', color: colors.slate800, fontSize: 14 },
  studentMeta: { color: colors.slate400, fontSize: 12, marginTop: 2 },
  broadcastRow: { flexDirection: 'row', padding: 14, gap: 10 },
  broadcastIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastMeta: { color: colors.slate400, fontSize: 11, marginTop: 4 },
  emptyText: { color: colors.slate400, fontSize: 13, textAlign: 'center', padding: 20 },
  emptyBroadcast: { alignItems: 'center', gap: 8, paddingVertical: 12 },
});
