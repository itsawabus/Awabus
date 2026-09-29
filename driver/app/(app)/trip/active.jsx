import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Search } from 'lucide-react-native';
import TripHeader from '../../../src/components/layout/TripHeader.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import Modal from '../../../src/components/ui/Modal.jsx';
import ConfirmDialog from '../../../src/components/ui/ConfirmDialog.jsx';
import StudentMeta, { guardianName } from '../../../src/components/StudentMeta.jsx';
import MessageParentSheet from '../../../src/components/MessageParentSheet.jsx';
import { formatPhone } from '../../../src/lib/phone.js';
import { useLiveGpsStore } from '../../../src/store/liveGpsStore.js';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { useConnectionStore } from '../../../src/store/connectionStore.js';
import { useOfflineQueueStore } from '../../../src/store/offlineQueueStore.js';
import { useUiStore } from '../../../src/store/uiStore.js';
import { useAuthStore } from '../../../src/store/authStore.js';
import { getTodaysTrip, markAttendance, endTrip } from '../../../src/api/driverApp.js';
import { formatClock, formatDate, formatLat, formatLng, timeAgo } from '../../../src/lib/utils.js';
import { colors, radii } from '../../../src/lib/theme.js';

export default function ActiveTrip() {
  const queryClient = useQueryClient();
  const isOnline = useConnectionStore((s) => s.isOnline);
  const lastSyncAt = useConnectionStore((s) => s.lastSyncAt);
  const markSynced = useConnectionStore((s) => s.markSynced);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);
  const vibrationEnabled = useUiStore((s) => s.vibration);
  const driverId = useAuthStore((s) => s.driver?.id);
  const driverName = useAuthStore((s) => s.driver?.name);
  const queue = useOfflineQueueStore((s) => s.queue);

  const [elapsed, setElapsed] = useState(0);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // pending "are you sure?" request
  const [messageTo, setMessageTo] = useState(null); // { tripId, student } for the message sheet
  // Position sent by the background tracker (src/components/BackgroundWork.jsx).
  const position = useLiveGpsStore((s) => s.position);
  const gpsError = useLiveGpsStore((s) => s.error);

  const { data: trip, isLoading } = useQuery({
    queryKey: ['todays-trip'],
    queryFn: getTodaysTrip,
    refetchInterval: 20000,
  });

  // Back to the start screen when this trip is no longer running, but only
  // while this screen is in view (a background refresh never moves screens).
  const notLive = Boolean(trip) && trip.status !== 'In Progress' && trip.status !== 'Delayed';
  useFocusEffect(
    useCallback(() => {
      if (notLive) router.replace('/');
    }, [notLive])
  );

  useEffect(() => {
    if (!trip?.startedAt) return undefined;
    const started = new Date(trip.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trip?.startedAt]);

  // Every status change for a student (board, drop off, not here) goes through
  // here. Offline, it is queued and shown straight away with an "(offline)" tag.
  const statusMutation = useMutation({
    mutationFn: ({ studentId, dropoffStatus }) => markAttendance(trip._id, studentId, { dropoffStatus }),
    onSuccess: () => {
      markSynced();
      queryClient.invalidateQueries({ queryKey: ['todays-trip'] });
    },
    onError: (_err, { studentId, dropoffStatus }) => {
      enqueue({ kind: 'scan', tripId: trip._id, studentId, driverId, payload: { dropoffStatus } });
      queryClient.setQueryData(['todays-trip'], (old) =>
        old
          ? {
              ...old,
              studentProgress: old.studentProgress.map((p) =>
                p.student?._id === studentId ? { ...p, dropoffStatus, _offline: true } : p
              ),
            }
          : old
      );
    },
  });

  // Every step is confirmed first, so a stray tap changes nothing.
  const STEP = {
    'On board': { verb: 'boarded', label: 'Yes, on board' },
    'Dropped off': { verb: 'dropped off', label: 'Yes, dropped off' },
    'Not on board': { verb: 'not here', label: 'Yes, not here', danger: true },
  };
  const askStatus = (p, dropoffStatus) => {
    const name = p.student ? `${p.student.firstName} ${p.student.lastName}` : 'this student';
    const step = STEP[dropoffStatus];
    setConfirm({
      title: `Mark ${name} as ${step.verb}?`,
      message: p.student?.classGrade ? `${p.student.classGrade}` : '',
      confirmLabel: step.label,
      danger: step.danger,
      onConfirm: () => setStatus(p.student?._id, dropoffStatus),
    });
  };

  const callParent = (g) =>
    setConfirm({
      title: `Call ${guardianName(g) || 'the parent'}?`,
      message: `This opens your phone app to call ${formatPhone(g.phone)}.`,
      confirmLabel: 'Call',
      onConfirm: () => Linking.openURL(`tel:${g.phone}`).catch(() => {}),
    });

  const setStatus = (studentId, dropoffStatus) => {
    if (vibrationEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    useOfflineQueueStore.getState().dropScansFor(trip._id, studentId); // this newer step wins
    statusMutation.mutate({ studentId, dropoffStatus });
  };

  const endMutation = useMutation({
    mutationFn: () => endTrip(trip._id),
    onSuccess: (updatedTrip) => {
      queryClient.invalidateQueries({ queryKey: ['todays-trip'] });
      router.replace({ pathname: '/trip/completed', params: { tripId: updatedTrip._id } });
    },
  });

  const waiting = queue.filter((q) => q.tripId === trip?._id).length;
  const progress = trip?.studentProgress || [];
  // Students marked absent at roll call are not expected on the bus.
  const riding = progress.filter((p) => p.attendance !== 'Absent' && p.attendance !== 'Cancelled');
  const droppedCount = riding.filter((p) => p.dropoffStatus === 'Dropped off').length;
  const onBoard = riding.filter((p) => p.dropoffStatus === 'On board');
  const notHere = riding.filter((p) => p.dropoffStatus === 'Not on board');
  const unscanned = riding.filter((p) => !p.dropoffStatus || p.dropoffStatus === 'Pending' || p.dropoffStatus === 'Boarding now');

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
              {(trip.driver?.firstName ? `${trip.driver.firstName} ${trip.driver.lastName || ''}`.trim() : driverName) || '—'}
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
            <Text style={styles.syncText}>
              {waiting ? `${waiting} waiting to send · ` : ''}Last sync: {lastSyncAt ? timeAgo(lastSyncAt) : 'never'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.coordsRow}>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Lat: </Text>
              <Text style={styles.infoValue}>
                {formatLat(position ? position.lat : trip.liveLocation?.lat)}
              </Text>
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Lon: </Text>
              <Text style={styles.infoValue}>
                {formatLng(position ? position.lng : trip.liveLocation?.lng)}
              </Text>
            </Text>
          </View>
        </Card>

        {gpsError ? (
          <View style={styles.offlineBanner}>
            <AlertTriangle size={16} color={colors.amber800} />
            <Text style={styles.offlineText}>GPS is off: {gpsError} The school cannot see the bus until location is allowed.</Text>
          </View>
        ) : null}

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
              {droppedCount} of {riding.length} dropped off
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressOnBoard, { width: `${riding.length ? ((droppedCount + onBoard.length) / riding.length) * 100 : 0}%` }]} />
            <View style={[styles.progressFill, { width: `${riding.length ? (droppedCount / riding.length) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.progressDetail}>
            {onBoard.length} on board · {unscanned.length} waiting{notHere.length ? ` · ${notHere.length} not here` : ''}
            {progress.length - riding.length ? ` · ${progress.length - riding.length} absent` : ''}
          </Text>
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
            {visibleStudents.map((p) => (
              <StudentRow key={p.student?._id} p={p} isOnline={isOnline} onSet={(status) => askStatus(p, status)} onCall={callParent} onMessage={(student) => setMessageTo({ tripId: trip._id, student })} />
            ))}
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

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <MessageParentSheet target={messageTo} onClose={() => setMessageTo(null)} />

      <Modal open={endOpen} onClose={() => setEndOpen(false)}>
        <Text style={styles.modalTitle}>End today's trip?</Text>
        <Text style={styles.modalSubtitle}>You are about to end the current trip.</Text>
        <View style={styles.summaryBox}>
          <SummaryRow label="Trip duration" value={formatClock(elapsed)} />
          <SummaryRow label="Dropped off" value={`${droppedCount} of ${riding.length}`} />
          <SummaryRow label="Bus" value={trip.bus?.plateNumber} />
          <SummaryRow label="Route" value={trip.route?.name} />
        </View>
        {onBoard.length > 0 && (
          <View style={[styles.warningBox, styles.dangerBox]}>
            <Text style={styles.dangerText}>
              {onBoard.length} student{onBoard.length === 1 ? ' is' : 's are'} still marked on board:{' '}
              {onBoard.map((p) => p.student?.firstName).filter(Boolean).join(', ')}. Drop them off first, or check the bus.
            </Text>
          </View>
        )}
        {unscanned.length > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              {unscanned.length} student{unscanned.length === 1 ? ' was' : 's were'} never boarded or marked not here. Their
              trip status will stay incomplete.
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

// One student: what happened so far, and the next step as a button.
function StudentRow({ p, isOnline, onSet, onCall, onMessage }) {
  const name = p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Student';
  const when = p._offline || !isOnline ? ' (offline)' : p.alertTime ? ` at ${p.alertTime}` : '';
  const status = p.dropoffStatus;

  if (p.attendance === 'Absent' || p.attendance === 'Cancelled') {
    return (
      <View style={[styles.studentRow, styles.studentRowMuted]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.studentName, styles.mutedName]}>{name}</Text>
          <StudentMeta student={p.student} onCall={onCall} onMessage={onMessage} />
        </View>
        <Text style={styles.absentText}>{p.attendance === 'Cancelled' ? 'Cancelled by parent' : 'Absent'}</Text>
      </View>
    );
  }
  if (status === 'Dropped off') {
    return (
      <View style={styles.studentRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{name}</Text>
          <StudentMeta student={p.student} onCall={onCall} onMessage={onMessage} />
        </View>
        <Text style={styles.scannedText}>Dropped off{when}</Text>
      </View>
    );
  }
  if (status === 'On board') {
    return (
      <View style={styles.studentRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{name}</Text>
          <Text style={styles.onBoardText}>On board{when}</Text>
          <StudentMeta student={p.student} onCall={onCall} onMessage={onMessage} />
        </View>
        <SmallButton label="Drop off" onPress={() => onSet('Dropped off')} />
      </View>
    );
  }
  return (
    <View style={styles.studentRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.studentName}>{name}</Text>
        {status === 'Not on board' ? <Text style={styles.notHereText}>Not here{when}</Text> : <Text style={styles.waitingText}>Waiting</Text>}
        <StudentMeta student={p.student} onCall={onCall} onMessage={onMessage} />
      </View>
      <View style={styles.actions}>
        {status !== 'Not on board' && <SmallButton label="Not here" variant="ghost" onPress={() => onSet('Not on board')} />}
        <SmallButton label="Board" onPress={() => onSet('On board')} />
      </View>
    </View>
  );
}

const SmallButton = ({ label, onPress, variant = 'primary' }) => (
  <Pressable
    onPress={onPress}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.smallBtn, variant === 'ghost' && styles.smallBtnGhost, pressed && { opacity: 0.7 }]}
  >
    <Text style={[styles.smallBtnText, variant === 'ghost' && styles.smallBtnGhostText]}>{label}</Text>
  </Pressable>
);

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
  progressFill: { position: 'absolute', left: 0, top: 0, height: '100%', backgroundColor: colors.navy, borderRadius: 4 },
  progressOnBoard: { position: 'absolute', left: 0, top: 0, height: '100%', backgroundColor: colors.brand600, opacity: 0.35, borderRadius: 4 },
  progressDetail: { marginTop: 6, fontSize: 12, color: colors.slate500 },
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
  onBoardText: { marginTop: 2, fontSize: 12, fontWeight: '700', color: colors.brand600 },
  waitingText: { marginTop: 2, fontSize: 12, color: colors.slate400 },
  notHereText: { marginTop: 2, fontSize: 12, fontWeight: '700', color: colors.red600 },
  absentText: { fontSize: 13, fontWeight: '700', color: colors.slate400 },
  studentRowMuted: { backgroundColor: colors.slate50 },
  mutedName: { color: colors.slate400 },
  actions: { flexDirection: 'row', gap: 8 },
  smallBtn: { backgroundColor: colors.navy, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 9 },
  smallBtnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  smallBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.slate200 },
  smallBtnGhostText: { color: colors.slate600 },
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
  dangerBox: { backgroundColor: '#fef2f2' },
  dangerText: { fontSize: 13, fontWeight: '700', color: '#b91c1c' },
});
