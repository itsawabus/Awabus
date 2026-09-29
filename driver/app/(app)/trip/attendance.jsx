import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react-native';
import Header from '../../../src/components/layout/Header.jsx';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { getTodaysTrip } from '../../../src/api/driverApp.js';
import { runWords, statusLabel } from '../../../src/lib/runs.js';
import { matchesSearch, callInfo, CALL_IN_PROGRESS } from '../../../src/lib/nearest.js';
import { colors, radii } from '../../../src/lib/theme.js';

// A fixed A–Z list of everyone on the trip and where they are up to. Unlike
// the trip screen, it never re-sorts by distance, so a child is always easy to find.
const nameOf = (p) => `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.trim();

function rowStatus(p, session) {
  if (p.attendance === 'Cancelled') return { text: 'Cancelled by parent', tone: 'muted' };
  if (p.attendance === 'Absent') return { text: 'Absent', tone: 'muted' };
  const text = statusLabel(session, p.dropoffStatus || 'Pending');
  if (p.dropoffStatus === 'Dropped off') return { text, tone: 'good' };
  if (p.dropoffStatus === 'On board') return { text, tone: 'info' };
  if (p.dropoffStatus === 'Not on board') return { text, tone: 'bad' };
  return { text, tone: 'plain' };
}

export default function AttendanceList() {
  const [search, setSearch] = useState('');
  const { data: trip, isLoading } = useQuery({
    queryKey: ['todays-trip'],
    queryFn: getTodaysTrip,
    refetchInterval: (query) =>
      query.state.data?.studentProgress?.some((p) => CALL_IN_PROGRESS.includes(p.callStatus)) ? 5000 : 20000,
  });

  const rows = useMemo(
    () => [...(trip?.studentProgress || [])].sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    [trip?.studentProgress]
  );

  if (isLoading || !trip) return <PageLoader label="Loading attendance..." />;

  const w = runWords(trip.session);
  const riding = rows.filter((p) => p.attendance !== 'Absent' && p.attendance !== 'Cancelled');
  const count = (status) => riding.filter((p) => (p.dropoffStatus || 'Pending') === status).length;
  const waitingCount = riding.filter((p) => !p.dropoffStatus || p.dropoffStatus === 'Pending' || p.dropoffStatus === 'Boarding now').length;
  const shown = rows.filter((p) => matchesSearch(p, search));

  return (
    <View style={{ flex: 1, backgroundColor: colors.slate50 }}>
      <Header back title="Attendance list" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          {trip.session ? `${w.name} · ` : ''}
          {rows.length} student{rows.length === 1 ? '' : 's'}, A–Z
        </Text>
        <View style={styles.counts}>
          <Count label={w.waiting} value={waitingCount} />
          <Count label={w.board} value={count('On board')} />
          <Count label={w.drop} value={count('Dropped off')} />
          <Count label={w.notHere} value={count('Not on board')} />
          <Count label="Absent" value={rows.length - riding.length} />
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={colors.slate400} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, class or parent..."
            placeholderTextColor={colors.slate400}
            style={styles.searchField}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
              <X size={16} color={colors.slate400} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.list}>
          {shown.map((p, i) => {
            const st = rowStatus(p, trip.session);
            const call = callInfo(p);
            return (
              <View key={p.student?._id || i} style={[styles.row, i === shown.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{nameOf(p) || 'Student'}</Text>
                  {p.student?.classGrade ? <Text style={styles.meta}>{p.student.classGrade}</Text> : null}
                  {call ? <Text style={[styles.call, TONE[call.tone]]}>{call.text}</Text> : null}
                </View>
                <Text style={[styles.status, TONE[st.tone]]}>
                  {st.text}
                  {p._offline ? ' (offline)' : ''}
                </Text>
              </View>
            );
          })}
          {shown.length === 0 ? <Text style={styles.empty}>No student matches that search.</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const Count = ({ label, value }) => (
  <View style={styles.count}>
    <Text style={styles.countValue}>{value}</Text>
    <Text style={styles.countLabel}>{label}</Text>
  </View>
);

const TONE = {
  good: { color: colors.emerald700 },
  info: { color: colors.brand600 },
  bad: { color: colors.red600 },
  muted: { color: colors.slate400 },
  plain: { color: colors.slate500 },
};

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  subtitle: { fontSize: 13, color: colors.slate500 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.lg, paddingHorizontal: 10, paddingVertical: 8, minWidth: 90 },
  countValue: { fontSize: 18, fontWeight: '800', color: colors.slate900 },
  countLabel: { fontSize: 11, color: colors.slate500 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
  },
  searchField: { flex: 1, fontSize: 14, color: colors.slate800, paddingVertical: 0 },
  list: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  name: { fontSize: 14, fontWeight: '700', color: colors.slate800 },
  meta: { fontSize: 12, color: colors.slate400, marginTop: 1 },
  call: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  status: { fontSize: 13, fontWeight: '800', textAlign: 'right', maxWidth: '45%' },
  empty: { textAlign: 'center', color: colors.slate400, paddingVertical: 20, fontSize: 13 },
});
