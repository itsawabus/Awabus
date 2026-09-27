import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import Badge from '../../../src/components/ui/Badge.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import Modal from '../../../src/components/ui/Modal.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { useAuthStore } from '../../../src/store/authStore.js';
import { useConnectionStore } from '../../../src/store/connectionStore.js';
import { getTodaysTrip, markAttendance, startTrip } from '../../../src/api/driverApp.js';
import { formatDate } from '../../../src/lib/utils.js';
import { colors, radii } from '../../../src/lib/theme.js';

export default function Home() {
  const queryClient = useQueryClient();
  const driver = useAuthStore((s) => s.driver);
  const isOnline = useConnectionStore((s) => s.isOnline);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  useEffect(() => {
    if (trip?.status === 'In Progress' || trip?.status === 'Delayed') {
      router.replace('/trip/active');
    }
  }, [trip]);

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
  });

  if (isLoading) return <PageLoader label="Loading today's trip..." />;

  if (isError) {
    return (
      <View style={{ flex: 1 }}>
        <Header logo />
        <ScrollView contentContainerStyle={styles.centerPad} refreshControl={refreshControl}>
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
  const absent = progress.filter((p) => p.attendance === 'Absent').length;

  return (
    <View style={{ flex: 1 }}>
      <Header logo />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
        <Card>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.driverName}>{driver?.name}</Text>
              <Text style={styles.driverRole}>Primary Driver</Text>
            </View>
            <Badge tone={isOnline ? 'success' : 'neutral'}>{isOnline ? 'Online' : 'Offline'}</Badge>
          </View>
          <View style={styles.divider} />
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Bus: </Text>
            <Text style={styles.infoValue}>{trip.bus?.plateNumber}</Text>
          </Text>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Route: </Text>
            <Text style={styles.infoValue}>{trip.route?.name}</Text>
          </Text>
          <Text style={styles.dateText}>{formatDate(trip.date)}</Text>
        </Card>

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
          <Text style={styles.tapHint}>tap to change</Text>
        </View>
        <View style={styles.studentList}>
          {progress.map((p) => (
            <Pressable
              key={p.student?._id}
              onPress={() =>
                toggleMutation.mutate({
                  studentId: p.student?._id,
                  attendance: p.attendance === 'Present' ? 'Absent' : 'Present',
                })
              }
              style={styles.studentRow}
            >
              <Text style={styles.studentName}>{p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Student'}</Text>
              <Badge tone={p.attendance === 'Present' ? 'success' : 'danger'}>
                {p.attendance === 'Present' ? 'Attending' : 'Not attending'}
              </Badge>
            </Pressable>
          ))}
          {progress.length === 0 && <Text style={styles.emptyListText}>No students assigned to this route yet.</Text>}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Button onPress={() => setConfirmOpen(true)} disabled={total === 0}>
          Start trip
        </Button>
      </SafeAreaView>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <Text style={styles.modalTitle}>Start today's trip?</Text>
        <Text style={styles.modalSubtitle}>You are about to start the morning trip.</Text>
        <View style={styles.summaryBox}>
          <SummaryRow label="Attending Students" value={attending} />
          <SummaryRow label="Bus" value={trip.bus?.plateNumber} />
          <SummaryRow label="Route" value={trip.route?.name} />
        </View>
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

const styles = StyleSheet.create({
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
  statCardSuccess: { backgroundColor: colors.emerald50, borderColor: '#a7f3d0' },
  statCardDanger: { backgroundColor: colors.red50, borderColor: '#fecaca' },
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
});
