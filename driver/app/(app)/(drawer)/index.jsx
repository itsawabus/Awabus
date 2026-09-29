import { useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import Badge from '../../../src/components/ui/Badge.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import Modal from '../../../src/components/ui/Modal.jsx';
import ConfirmDialog from '../../../src/components/ui/ConfirmDialog.jsx';
import StudentMeta, { guardianName } from '../../../src/components/StudentMeta.jsx';
import MessageParentSheet from '../../../src/components/MessageParentSheet.jsx';
import LastCrashNotice from '../../../src/components/LastCrashNotice.jsx';
import BackgroundLocationBanner from '../../../src/components/BackgroundLocationBanner.jsx';
import { ConnectionBadges, BusOfflineBanner } from '../../../src/components/ConnectionStatus.jsx';
import { formatPhone } from '../../../src/lib/phone.js';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { useAuthStore } from '../../../src/store/authStore.js';
import { getTodaysTrip, markAttendance, startTrip } from '../../../src/api/driverApp.js';
import { formatDate } from '../../../src/lib/utils.js';
import { colors, radii, themed } from '../../../src/lib/theme.js';
import { runWords } from '../../../src/lib/runs.js';
import { busLabel } from '../../../src/lib/bus.js';
import { useTripPhotos } from '../../../src/hooks/useTripPhotos.js';
import Avatar from '../../../src/components/ui/Avatar.jsx';

export default function Home() {
  const queryClient = useQueryClient();
  const driver = useAuthStore((s) => s.driver);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // pending "are you sure?" request
  const [messageTo, setMessageTo] = useState(null); // { tripId, student } for the message sheet

  const {
    data: trip,
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ['todays-trip'], queryFn: getTodaysTrip });

  const refreshControl = (
    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.trip600} colors={[colors.trip600]} />
  );

  // A running trip opens its screen, but only while the driver is looking at
  // this one. (This screen stays loaded behind others; checking only when it
  // is in view stops background refreshes from pulling the driver away.)
  const live = trip?.status === 'In Progress' || trip?.status === 'Delayed';
  const photos = useTripPhotos(trip?._id);
  useFocusEffect(
    useCallback(() => {
      if (live) router.replace('/trip/active');
    }, [live])
  );

  const toggleMutation = useMutation({
    mutationFn: ({ studentId, attendance }) => markAttendance(trip._id, studentId, { attendance }),
    onMutate: async ({ studentId, attendance }) => {
      await queryClient.cancelQueries({ queryKey: ['todays-trip'] });
      const previous = queryClient.getQueryData(['todays-trip']);
      queryClient.setQueryData(['todays-trip'], (old) =>
        old
          ? { ...old, studentProgress: old.studentProgress.map((p) => (p.student?._id === studentId ? { ...p, attendance } : p)) }
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['todays-trip'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todays-trip'] }),
  });

  const startMutation = useMutation({
    mutationFn: () => startTrip(trip._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todays-trip'] });
      router.push('/trip/active');
    },
    // E.g. it just turned noon: the server has the afternoon drop-off ready
    // instead of the morning pick-up. Reload so the right run shows.
    onError: () => queryClient.invalidateQueries({ queryKey: ['todays-trip'] }),
  });

  // Changing attendance is confirmed first, so a stray tap changes nothing.
  const askToggle = (p) => {
    const name = p.student ? `${p.student.firstName} ${p.student.lastName}` : 'this student';
    // Cancelled by the parent (phone line) or the school office: only the office can undo it.
    if (p.attendance === 'Cancelled') {
      setConfirm({
        title: `${name}'s ride was cancelled`,
        message: 'The parent or the school office cancelled this ride. If they are riding after all, ask the school office to undo the cancellation.',
        confirmLabel: 'OK',
      });
      return;
    }
    const next = p.attendance === 'Present' ? 'Absent' : 'Present';
    setConfirm({
      title: next === 'Absent' ? `Mark ${name} as not attending?` : `Mark ${name} as attending?`,
      message:
        next === 'Absent'
          ? 'They will not be expected on the bus for this trip.'
          : 'They will be expected on the bus for this trip.',
      confirmLabel: next === 'Absent' ? 'Yes, not attending' : 'Yes, attending',
      danger: next === 'Absent',
      onConfirm: () => toggleMutation.mutate({ studentId: p.student?._id, attendance: next }),
    });
  };

  const callParent = (g) =>
    setConfirm({
      title: `Call ${guardianName(g) || 'the parent'}?`,
      message: `This opens your phone app to call ${formatPhone(g.phone)}.`,
      confirmLabel: 'Call',
      onConfirm: () => Linking.openURL(`tel:${g.phone}`).catch(() => {}),
    });

  if (isLoading) return <PageLoader label="Loading today's trip..." />;

  if (isError) {
    return (
      <View style={{ flex: 1 }}>
        <Header logo />
        <ScrollView contentContainerStyle={styles.centerPad} refreshControl={refreshControl}>
        <LastCrashNotice style={{ alignSelf: 'stretch', marginBottom: 12 }} />
          <Card style={styles.centerCard}>
            <AlertTriangle size={28} color={colors.red500} />
            <Text style={styles.emptyTitle}>Couldn't load your trip</Text>
            <Text style={styles.emptyText}>{error.message}</Text>
            <Button variant="outline" onPress={() => refetch()}>
              Retry
            </Button>
          </Card>
        </ScrollView>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1 }}>
        <Header logo />
        <ScrollView contentContainerStyle={styles.centerPad} refreshControl={refreshControl}>
        <LastCrashNotice style={{ alignSelf: 'stretch', marginBottom: 12 }} />
          <Card style={styles.centerCard}>
            <AlertTriangle size={28} color={colors.amber500} />
            <Text style={styles.emptyTitle}>No trip assigned yet</Text>
            <Text style={styles.emptyText}>
              You don't have a bus or route assigned. Contact your school admin to get set up.
            </Text>
          </Card>
        </ScrollView>
      </View>
    );
  }

  const progress = trip.studentProgress || [];
  const total = progress.length;
  const attending = progress.filter((p) => p.attendance === 'Present').length;
  const absent = progress.filter((p) => p.attendance === 'Absent' || p.attendance === 'Cancelled').length;

  return (
    <View style={{ flex: 1 }}>
      <Header logo />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
        <LastCrashNotice style={{ alignSelf: 'stretch', marginBottom: 12 }} />
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.driverName}>{driver?.name}</Text>
              <Text style={styles.driverRole}>Primary Driver</Text>
            </View>
            <ConnectionBadges style={styles.connection} />
          </View>
          <View style={styles.divider} />
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Bus: </Text>
            <Text style={styles.infoValue}>{busLabel(trip.bus)}</Text>
          </Text>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Route: </Text>
            <Text style={styles.infoValue}>{trip.route?.name}</Text>
          </Text>
          {trip.session ? (
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Run: </Text>
              <Text style={styles.infoValue}>{runWords(trip.session).name}</Text>
            </Text>
          ) : null}
          <Text style={styles.dateText}>
            {formatDate(trip.date)}
            {trip.completedToday ? ` · ${trip.completedToday} trip${trip.completedToday === 1 ? '' : 's'} done today` : ''}
          </Text>
        </Card>

        <BusOfflineBanner />
        <BackgroundLocationBanner />

        <Text style={styles.sectionLabel}>Attendance Summary</Text>
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </Card>
          <Card style={[styles.statCard, styles.statCardSuccess]}>
            <Text style={[styles.statValue, styles.statValueSuccess]}>{attending}</Text>
            <Text style={[styles.statLabel, styles.statValueSuccess]}>Attending</Text>
          </Card>
          <Card style={[styles.statCard, styles.statCardDanger]}>
            <Text style={[styles.statValue, styles.statValueDanger]}>{absent}</Text>
            <Text style={[styles.statLabel, styles.statValueDanger]}>Absent</Text>
          </Card>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionLabel}>Student List</Text>
        </View>
        <View style={styles.studentList}>
          {progress.map((p) => (
            <View key={p.student?._id} style={styles.studentRow}>
              <Avatar name={p.student ? `${p.student.firstName} ${p.student.lastName}` : ''} src={photos[p.student?._id]} size="sm" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Student'}</Text>
                <StudentMeta student={p.student} onCall={callParent} onMessage={(student) => setMessageTo({ tripId: trip._id, student })} />
              </View>
              <Pressable
                onPress={() => askToggle(p)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${p.attendance === 'Present' ? 'Attending' : p.attendance === 'Cancelled' ? 'Cancelled by parent' : 'Not attending'}. Tap to change`}
              >
                <Badge tone={p.attendance === 'Present' ? 'success' : p.attendance === 'Cancelled' ? 'warning' : 'danger'}>
                  {p.attendance === 'Present' ? 'Attending' : p.attendance === 'Cancelled' ? 'Cancelled by parent' : 'Not attending'}
                </Badge>
              </Pressable>
            </View>
          ))}
          {progress.length === 0 && <Text style={styles.emptyListText}>No students assigned to this route yet.</Text>}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Button
          onPress={() => {
            startMutation.reset();
            setConfirmOpen(true);
          }}
          disabled={total === 0}
        >
          Start trip
        </Button>
      </SafeAreaView>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <MessageParentSheet target={messageTo} onClose={() => setMessageTo(null)} />

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <Text style={styles.modalTitle}>
          {trip.session ? `Start the ${runWords(trip.session).name.toLowerCase()}?` : trip.completedToday ? 'Start another trip?' : "Start today's trip?"}
        </Text>
        <Text style={styles.modalSubtitle}>
          {trip.completedToday
            ? `This will be trip ${trip.completedToday + 1} today. The school can follow it live.`
            : 'The school can follow the bus live once it starts.'}
        </Text>
        <View style={styles.summaryBox}>
          <SummaryRow label="Attending Students" value={attending} />
          <SummaryRow label="Bus" value={busLabel(trip.bus)} />
          <SummaryRow label="Route" value={trip.route?.name} />
          {trip.session ? <SummaryRow label="Run" value={runWords(trip.session).name} /> : null}
        </View>
        {startMutation.isError ? <Text style={styles.startError}>{startMutation.error.message}</Text> : null}
        <Button loading={startMutation.isPending} onPress={() => startMutation.mutate()} style={{ marginTop: 24 }}>
          Yes, start trip
        </Button>
        <Button variant="ghost" onPress={() => setConfirmOpen(false)} style={{ marginTop: 10 }}>
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

const styles = themed(() => ({
  connection: { flexShrink: 1, maxWidth: '55%' },
  startError: { marginTop: 16, color: colors.red600, fontSize: 13, lineHeight: 18 },
  scroll: { padding: 16, gap: 20, paddingBottom: 32 },
  centerPad: { flexGrow: 1, padding: 16, justifyContent: 'center' },
  centerCard: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontWeight: '800', color: colors.slate800, fontSize: 15 },
  emptyText: { color: colors.slate500, fontSize: 13, textAlign: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  driverName: { fontSize: 18, fontWeight: '800', color: colors.slate900 },
  driverRole: { color: colors.slate500, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.slate100, marginVertical: 12 },
  infoLine: { fontSize: 14, marginBottom: 2 },
  infoLabel: { color: colors.slate500 },
  infoValue: { color: colors.slate800, fontWeight: '700' },
  dateText: { color: colors.slate400, fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: colors.slate400, marginBottom: 8, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statCardSuccess: { backgroundColor: colors.emerald50, borderColor: colors.greenBorder },
  statCardDanger: { backgroundColor: colors.red50, borderColor: colors.redBorder },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.slate900 },
  statValueSuccess: { color: colors.emerald700 },
  statValueDanger: { color: colors.red600 },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500, marginTop: 2 },
  tapHint: { fontSize: 12, fontWeight: '700', color: colors.brand600 },
  studentList: { gap: 8 },
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
  emptyListText: { textAlign: 'center', color: colors.slate400, paddingVertical: 20, fontSize: 13 },
  footer: {
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
}));
