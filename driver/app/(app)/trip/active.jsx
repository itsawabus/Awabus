import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Search } from 'lucide-react-native';
import TripHeader from '../../../src/components/layout/TripHeader.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import Modal from '../../../src/components/ui/Modal.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { useConnectionStore } from '../../../src/store/connectionStore.js';
import { useOfflineQueueStore } from '../../../src/store/offlineQueueStore.js';
import { useUiStore } from '../../../src/store/uiStore.js';
import { useGeolocation } from '../../../src/hooks/useGeolocation.js';
import { getTodaysTrip, markAttendance, pushLocation, endTrip } from '../../../src/api/driverApp.js';
import { formatClock, formatDate, timeAgo } from '../../../src/lib/utils.js';
import { colors, radii } from '../../../src/lib/theme.js';

const LOCATION_PUSH_INTERVAL_MS = 8000;

export default function ActiveTrip() {
  const queryClient = useQueryClient();
  const isOnline = useConnectionStore((s) => s.isOnline);
  const lastSyncAt = useConnectionStore((s) => s.lastSyncAt);
  const markSynced = useConnectionStore((s) => s.markSynced);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);
  const vibrationEnabled = useUiStore((s) => s.vibration);

  const [elapsed, setElapsed] = useState(0);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const lastPushRef = useRef(0);

  const { data: trip, isLoading } = useQuery({
    queryKey: ['todays-trip'],
    queryFn: getTodaysTrip,
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (trip && trip.status !== 'In Progress' && trip.status !== 'Delayed') {
      router.replace('/');
    }
  }, [trip]);

  useEffect(() => {
    if (!trip?.startedAt) return undefined;
    const started = new Date(trip.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trip?.startedAt]);

  const { position } = useGeolocation(Boolean(trip));

  useEffect(() => {
    if (!position || !trip?._id) return;
    const now = Date.now();
    if (now - lastPushRef.current < LOCATION_PUSH_INTERVAL_MS) return;
    lastPushRef.current = now;

    pushLocation(trip._id, position)
      .then(() => markSynced())
      .catch(() => enqueue({ kind: 'location', tripId: trip._id, payload: position }));
  }, [position, trip?._id, markSynced, enqueue]);

  const scanMutation = useMutation({
    mutationFn: ({ studentId }) => markAttendance(trip._id, studentId, { dropoffStatus: 'On board' }),
    onSuccess: () => {
      markSynced();
      queryClient.invalidateQueries({ queryKey: ['todays-trip'] });
    },
    onError: (_err, { studentId }) => {
      enqueue({ kind: 'scan', tripId: trip._id, studentId, payload: { dropoffStatus: 'On board' } });
      queryClient.setQueryData(['todays-trip'], (old) =>
        old
          ? {
              ...old,
              studentProgress: old.studentProgress.map((p) =>
                p.student?._id === studentId ? { ...p, dropoffStatus: 'On board', _offline: true } : p
              ),
            }
          : old
      );
    },
  });

  const handleScan = (studentId) => {
    if (vibrationEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    scanMutation.mutate({ studentId });
  };

  const endMutation = useMutation({
    mutationFn: () => endTrip(trip._id),
    onSuccess: (updatedTrip) => {
      queryClient.invalidateQueries({ queryKey: ['todays-trip'] });
      router.replace({ pathname: '/trip/completed', params: { tripId: updatedTrip._id } });
    },
  });

  const progress = trip?.studentProgress || [];
  const boardedCount = progress.filter((p) => p.dropoffStatus === 'On board' || p.dropoffStatus === 'Dropped off').length;
  const unscanned = progress.filter((p) => p.attendance === 'Present' && p.dropoffStatus === 'Pending');

  const visibleStudents = useMemo(() => {
    if (!search) return progress;
    return progress.filter((p) => `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.toLowerCase().includes(search.toLowerCase()));
  }, [progress, search]);

  if (isLoading || !trip) return <PageLoader label="Loading trip..." />;

  return (
    <View style={{ flex: 1 }}>
      <TripHeader
        status="Trip active"
        isOnline={isOnline}
        subtitle={`${trip.bus?.plateNumber || ''}, ${trip.route?.name || ''}`}
        elapsedSeconds={elapsed}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Bus: </Text>
            <Text style={styles.infoValue}>{trip.bus?.plateNumber}</Text>
          </Text>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Driver: </Text>
            <Text style={styles.infoValue}>
              {trip.driver ? `${trip.driver.firstName || ''} ${trip.driver.lastName || ''}`.trim() : '—'}
            </Text>
          </Text>
          <Text style={styles.dateText}>{formatDate(trip.date)}</Text>
        </Card>

        <Card>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={[styles.dot, { backgroundColor: isOnline ? colors.emerald600 : colors.slate400 }]} />
              <Text style={[styles.statusText, { color: isOnline ? colors.emerald700 : colors.slate500 }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <Text style={styles.syncText}>Last sync: {lastSyncAt ? timeAgo(lastSyncAt) : 'never'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.coordsRow}>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Lat: </Text>
              <Text style={styles.infoValue}>
                {position ? `${position.lat.toFixed(4)}° N` : trip.liveLocation?.lat ? `${trip.liveLocation.lat.toFixed(4)}° N` : '—'}
              </Text>
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Lon: </Text>
              <Text style={styles.infoValue}>
                {position ? `${Math.abs(position.lng).toFixed(4)}° W` : trip.liveLocation?.lng ? `${Math.abs(trip.liveLocation.lng).toFixed(4)}° W` : '—'}
              </Text>
            </Text>
          </View>
        </Card>

        {!isOnline && (
          <View style={styles.offlineBanner}>
            <AlertTriangle size={16} color={colors.amber800} />
            <Text style={styles.offlineText}>Connection lost. Keep driving. Data will sync when you reconnect.</Text>
          </View>
        )}

        <View>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Trip progress</Text>
            <Text style={styles.progressText}>
              {boardedCount} of {progress.length} scanned
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.length ? (boardedCount / progress.length) * 100 : 0}%` }]} />
          </View>
        </View>

        <View>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Students on this trip</Text>
            <Pressable onPress={() => setShowSearch((v) => !v)} hitSlop={8}>
              <Search size={18} color={colors.slate400} />
            </Pressable>
          </View>
          {showSearch && (
            <TextInput
              autoFocus
              value={search}
              onChangeText={setSearch}
              placeholder="Search students..."
              placeholderTextColor={colors.slate400}
              style={styles.searchInput}
            />
          )}
          <View style={{ gap: 8 }}>
            {visibleStudents.map((p) => {
              const boarded = p.dropoffStatus === 'On board' || p.dropoffStatus === 'Dropped off';
              return (
                <Pressable
                  key={p.student?._id}
                  disabled={boarded}
                  onPress={() => handleScan(p.student?._id)}
                  style={styles.studentRow}
                >
                  <Text style={styles.studentName}>{p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Student'}</Text>
                  {boarded ? (
                    <Text style={styles.scannedText}>
                      Scanned{p._offline || !isOnline ? ' (Offline)' : p.alertTime ? ` at ${p.alertTime}` : ''}
                    </Text>
                  ) : (
                    <Text style={styles.tapToScan}>Tap to scan</Text>
                  )}
                </Pressable>
              );
            })}
            {visibleStudents.length === 0 && <Text style={styles.emptyListText}>No students found.</Text>}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Button variant="outline" style={{ flex: 1 }} onPress={() => router.push('/trip/delay-broadcast')}>
          Delay SMS
        </Button>
        <Button variant="danger" style={{ flex: 1 }} onPress={() => setEndOpen(true)}>
          End trip
        </Button>
      </SafeAreaView>

      <Modal open={endOpen} onClose={() => setEndOpen(false)}>
        <Text style={styles.modalTitle}>End today's trip?</Text>
        <Text style={styles.modalSubtitle}>You are about to end the current trip.</Text>
        <View style={styles.summaryBox}>
          <SummaryRow label="Trip duration" value={formatClock(elapsed)} />
          <SummaryRow label="Active students" value={`${boardedCount} of ${progress.length}`} />
          <SummaryRow label="Bus" value={trip.bus?.plateNumber} />
          <SummaryRow label="Route" value={trip.route?.name} />
        </View>
        {unscanned.length > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              {unscanned.length} live student{unscanned.length === 1 ? ' has' : 's have'} not been scanned yet. Ending now
              means their trip status will remain incomplete.
            </Text>
          </View>
        )}
        <Button variant="danger" loading={endMutation.isPending} onPress={() => endMutation.mutate()} style={{ marginTop: 20 }}>
          Yes, end trip
        </Button>
        <Button variant="ghost" onPress={() => setEndOpen(false)} style={{ marginTop: 10 }}>
          Cancel
        </Button>
      </Modal>
    </View>
  );
}

const SummaryRow = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  infoLine: { fontSize: 14, marginBottom: 2 },
  infoLabel: { color: colors.slate500 },
  infoValue: { color: colors.slate800, fontWeight: '700' },
  dateText: { color: colors.slate400, fontSize: 13, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontWeight: '800', fontSize: 14 },
  syncText: { fontSize: 12, color: colors.slate400 },
  divider: { height: 1, backgroundColor: colors.slate100, marginVertical: 10 },
  coordsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  offlineBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: radii.lg,
    padding: 12,
  },
  offlineText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.amber800 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: colors.slate400 },
  progressText: { fontSize: 13, fontWeight: '800', color: colors.emerald700 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.slate200, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.navy, borderRadius: 4 },
  searchInput: {
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 8,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  studentName: { fontWeight: '700', color: colors.slate800, fontSize: 14 },
  scannedText: { fontSize: 13, fontWeight: '800', color: colors.emerald700 },
  tapToScan: { fontSize: 13, fontWeight: '700', color: colors.brand600 },
  emptyListText: { textAlign: 'center', color: colors.slate400, paddingVertical: 20, fontSize: 13 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.slate900 },
  modalSubtitle: { marginTop: 4, fontSize: 14, color: colors.slate500 },
  summaryBox: { marginTop: 20, backgroundColor: colors.slate50, borderRadius: radii.lg, padding: 16, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.slate500, fontSize: 14 },
  summaryValue: { color: colors.slate800, fontWeight: '700', fontSize: 14 },
  warningBox: { marginTop: 14, backgroundColor: colors.amber50, borderRadius: radii.lg, padding: 12 },
  warningText: { fontSize: 13, color: colors.amber800 },
});
