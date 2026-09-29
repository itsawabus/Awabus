import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { AlertTriangle, CheckCircle2, Circle, ListChecks, MessageSquare, Navigation, QrCode, Search, X } from 'lucide-react-native';
import TripHeader from '../../../src/components/layout/TripHeader.jsx';
import Card from '../../../src/components/ui/Card.jsx';
import Button from '../../../src/components/ui/Button.jsx';
import Modal from '../../../src/components/ui/Modal.jsx';
import ConfirmDialog from '../../../src/components/ui/ConfirmDialog.jsx';
import StudentMeta, { guardianName } from '../../../src/components/StudentMeta.jsx';
import MessageParentSheet from '../../../src/components/MessageParentSheet.jsx';
import GroupMessageSheet from '../../../src/components/GroupMessageSheet.jsx';
import { formatPhone } from '../../../src/lib/phone.js';
import { useLiveGpsStore } from '../../../src/store/liveGpsStore.js';
import { PageLoader } from '../../../src/components/ui/Spinner.jsx';
import { useConnectionStore } from '../../../src/store/connectionStore.js';
import { useOfflineQueueStore } from '../../../src/store/offlineQueueStore.js';
import { useUiStore } from '../../../src/store/uiStore.js';
import { useAuthStore } from '../../../src/store/authStore.js';
import { getTodaysTrip, markAttendance, endTrip, getAssistPass } from '../../../src/api/driverApp.js';
import { AssistantLine } from '../../../src/components/AssistantStatus.jsx';
import { formatClock, formatDate, formatLat, formatLng, timeAgo } from '../../../src/lib/utils.js';
import { colors, radii } from '../../../src/lib/theme.js';
import { runWords } from '../../../src/lib/runs.js';
import { orderTrip, sectionsFor, matchesSearch, callInfo, formatDistance, CALL_IN_PROGRESS } from '../../../src/lib/nearest.js';
import BackgroundLocationBanner from '../../../src/components/BackgroundLocationBanner.jsx';
import { BusOfflineBanner, useConnectionStatus } from '../../../src/components/ConnectionStatus.jsx';
import { busLabel } from '../../../src/lib/bus.js';

export default function ActiveTrip() {
  // The screen stays on while the trip screen is open, so the list can be read at a glance.
  useKeepAwake('awabus-trip');
  const queryClient = useQueryClient();
  const isOnline = useConnectionStore((s) => s.isOnline);
  const { busOnline } = useConnectionStatus();
  const lastSyncAt = useConnectionStore((s) => s.lastSyncAt);
  const markSynced = useConnectionStore((s) => s.markSynced);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);
  const vibrationEnabled = useUiStore((s) => s.vibration);
  const driverId = useAuthStore((s) => s.driver?.id);
  const driverName = useAuthStore((s) => s.driver?.name);
  const queue = useOfflineQueueStore((s) => s.queue);

  const [elapsed, setElapsed] = useState(0);
  const [search, setSearch] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // pending "are you sure?" request
  const [messageTo, setMessageTo] = useState(null); // { tripId, student } for the message sheet
  // Several students picked by holding a card: their status or a message in one go.
  const [selected, setSelected] = useState([]); // student ids
  const [groupMessage, setGroupMessage] = useState(null); // { tripId, session, students }
  const selecting = selected.length > 0;
  const toggleSelected = (id) => {
    if (!id) return;
    if (vibrationEnabled) Haptics.selectionAsync().catch(() => {});
    setSelected((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]));
  };
  // Android back button leaves selection first.
  useEffect(() => {
    if (!selecting) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected([]);
      return true;
    });
    return () => sub.remove();
  }, [selecting]);
  // Position sent by the background tracker (src/components/BackgroundWork.jsx).
  const position = useLiveGpsStore((s) => s.position);
  const gpsError = useLiveGpsStore((s) => s.error);

  const { data: trip, isLoading } = useQuery({
    queryKey: ['todays-trip'],
    queryFn: getTodaysTrip,
    // Faster while a parent's phone is ringing, so the call result shows quickly.
    refetchInterval: (query) =>
      query.state.data?.studentProgress?.some((p) => CALL_IN_PROGRESS.includes(p.callStatus)) ? 5000 : 20000,
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
  // Worded for the run: morning pick-up or afternoon drop-off.
  const words = runWords(trip?.session);
  const STEP = {
    'On board': { verb: words.boardVerb, label: `Yes, ${words.board.toLowerCase()}` },
    'Dropped off': { verb: words.dropVerb, label: `Yes, ${words.drop.toLowerCase()}` },
    'Not on board': { verb: words.notHere.toLowerCase(), label: `Yes, ${words.notHere.toLowerCase()}`, danger: true },
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

  // Nearest first, from the phone's position (or the last one the school has).
  // The order stays put while a dialog is open, so it never moves under a tap.
  const busPos = position || trip?.liveLocation || null;
  const frozen = Boolean(confirm || messageTo || selecting || groupMessage);
  const lastOrder = useRef({ order: [], bus: null });
  const ordered = useMemo(() => {
    const bus = frozen ? lastOrder.current.bus : busPos;
    const result = orderTrip({ progress, session: trip?.session, bus, previous: lastOrder.current.order });
    lastOrder.current = { order: result.order, bus };
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, trip?.session, busPos?.lat, busPos?.lng, frozen]);
  const searching = search.trim().length > 0;
  const sections = sectionsFor(trip?.session)
    .map((sec) => ({ ...sec, rows: ordered[sec.key].filter((r) => matchesSearch(r.p, search)) }))
    .filter((sec) => sec.rows.length);
  const nextUp = ordered.next[0];

  // The bus assistant (teacher): connected or not, checked every 15 seconds.
  const assist = useQuery({
    queryKey: ['assist-pass', trip?._id],
    queryFn: () => getAssistPass(trip._id),
    enabled: Boolean(trip?._id),
    refetchInterval: 15000,
  });
  const helpers = assist.data?.assistants || [];

  // Selected students' rows, and which of them each step applies to.
  const selectedRows = progress.filter((p) => selected.includes(p.student?._id));
  const riderRow = (p) => p.attendance !== 'Absent' && p.attendance !== 'Cancelled';
  const waitingRow = (p) => !p.dropoffStatus || p.dropoffStatus === 'Pending' || p.dropoffStatus === 'Boarding now';
  const BULK = {
    'On board': (p) => riderRow(p) && (waitingRow(p) || p.dropoffStatus === 'Not on board'),
    'Dropped off': (p) => riderRow(p) && p.dropoffStatus === 'On board',
    'Not on board': (p) => riderRow(p) && waitingRow(p),
  };
  const askBulk = (dropoffStatus) => {
    const step = STEP[dropoffStatus];
    const rows = selectedRows.filter(BULK[dropoffStatus]);
    const skipped = selectedRows.length - rows.length;
    if (!rows.length) {
      setConfirm({
        title: `None of them can be marked ${step.verb}`,
        message: `Only students who are ${dropoffStatus === 'Dropped off' ? words.onBus : 'still waiting'} can be marked ${step.verb}.`,
        confirmLabel: 'OK',
        onConfirm: () => {},
      });
      return;
    }
    setConfirm({
      title: `Mark ${rows.length} student${rows.length === 1 ? '' : 's'} as ${step.verb}?`,
      message: `${rows.map((p) => p.student?.firstName).filter(Boolean).join(', ')}${skipped ? `\n${skipped} other${skipped === 1 ? '' : 's'} selected can't be marked ${step.verb} and will be left as they are.` : ''}`,
      confirmLabel: step.label,
      danger: step.danger,
      onConfirm: async () => {
        setSelected([]);
        if (vibrationEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        // One after another: the server saves each student's step on the same
        // trip, so sending them all at once would make them clash.
        for (const p of rows) {
          useOfflineQueueStore.getState().dropScansFor(trip._id, p.student._id);
          try {
            // eslint-disable-next-line no-await-in-loop
            await statusMutation.mutateAsync({ studentId: p.student._id, dropoffStatus });
          } catch {
            // queued for later by the mutation's onError (offline)
          }
        }
      },
    });
  };

  if (isLoading || !trip) return <PageLoader label="Loading trip..." />;

  return (
    <View style={{ flex: 1 }}>
      <TripHeader
        status="Trip active"
        isOnline={isOnline}
        subtitle={`${trip.session ? `${runWords(trip.session).name} · ` : ''}${busLabel(trip.bus)}, ${trip.route?.name || ''}`}
        elapsedSeconds={elapsed}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Bus: </Text>
            <Text style={styles.infoValue}>{busLabel(trip.bus)}</Text>
          </Text>
          <Text style={styles.infoLine}>
            <Text style={styles.infoLabel}>Driver: </Text>
            <Text style={styles.infoValue}>
              {(trip.driver?.firstName ? `${trip.driver.firstName} ${trip.driver.lastName || ''}`.trim() : driverName) || '—'}
            </Text>
          </Text>
          <Text style={styles.dateText}>{formatDate(trip.date)}</Text>
          <Pressable onPress={() => router.push('/trip/assistant')} style={styles.assistBtn} accessibilityRole="button">
            <QrCode size={16} color={colors.brand600} />
            <Text style={styles.assistBtnText}>Bus assistant QR code</Text>
          </Pressable>
          {helpers.length ? (
            helpers.map((h) => <AssistantLine key={h.name} assistant={h} style={{ marginTop: 6 }} />)
          ) : (
            <Text style={styles.noAssistant}>No bus assistant connected</Text>
          )}
        </Card>

        <Card>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={[styles.dot, { backgroundColor: isOnline ? colors.emerald600 : colors.slate400 }]} />
              <Text style={[styles.statusText, { color: isOnline ? colors.emerald700 : colors.slate500 }]}>
                {isOnline ? 'Driver online' : 'Driver offline'}
              </Text>
              <View style={[styles.dot, { marginLeft: 10, backgroundColor: busOnline ? colors.emerald600 : colors.amber500 }]} />
              <Text style={[styles.statusText, { color: busOnline ? colors.emerald700 : colors.amber700 }]}>
                {busOnline ? 'Bus online' : 'Bus offline'}
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

        <BackgroundLocationBanner />

        {/* Location off (data is fine): the school can't see the bus. */}
        {!gpsError && isOnline ? <BusOfflineBanner /> : null}

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
              {droppedCount} of {riding.length} {words.dropCount}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressOnBoard, { width: `${riding.length ? ((droppedCount + onBoard.length) / riding.length) * 100 : 0}%` }]} />
            <View style={[styles.progressFill, { width: `${riding.length ? (droppedCount / riding.length) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.progressDetail}>
            {onBoard.length} {words.onBus} · {unscanned.length} waiting{notHere.length ? ` · ${notHere.length} ${words.notHere.toLowerCase()}` : ''}
            {progress.length - riding.length ? ` · ${progress.length - riding.length} absent` : ''}
          </Text>
        </View>

        {nextUp && !searching ? (
          <View style={styles.nextCard}>
            <Navigation size={18} color={colors.white} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>{trip.session === 'evening' ? 'Next drop-off' : trip.session === 'morning' ? 'Next pick-up' : 'Next'}</Text>
              <Text style={styles.nextName}>
                {nextUp.p.student?.firstName} {nextUp.p.student?.lastName}
                {nextUp.metres != null ? ` · ${formatDistance(nextUp.metres)}` : nextUp.noHome ? ' · no home location saved' : ''}
              </Text>
            </View>
          </View>
        ) : null}

        <View>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Students on this trip</Text>
            <Pressable onPress={() => router.push('/trip/attendance')} hitSlop={8} style={styles.listLink} accessibilityRole="button">
              <ListChecks size={16} color={colors.brand600} />
              <Text style={styles.listLinkText}>Attendance list (A–Z)</Text>
            </Pressable>
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
            {searching ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                <X size={16} color={colors.slate400} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.orderNote}>{selecting ? 'Tap students to add or remove them.' : 'Hold a student to select several at once.'}</Text>
          {!busPos && ordered.next.length > 1 ? (
            <Text style={styles.orderNote}>Waiting for the bus position to put the nearest child first.</Text>
          ) : null}
          <View style={{ gap: 14 }}>
            {sections.map((sec) => (
              <View key={sec.key} style={{ gap: 8 }}>
                <Text style={styles.groupTitle}>
                  {sec.title} · {sec.rows.length}
                </Text>
                {sec.rows.map((r) => (
                  <SelectableRow
                    key={r.p.student?._id}
                    selecting={selecting}
                    isSelected={selected.includes(r.p.student?._id)}
                    onToggle={() => toggleSelected(r.p.student?._id)}
                  >
                  <StudentRow
                    p={r.p}
                    distance={sec.key === 'next' ? (r.metres != null ? `${formatDistance(r.metres)} away` : r.noHome ? 'No home location saved' : '') : ''}
                    session={trip.session}
                    isOnline={isOnline}
                    onSet={(status) => askStatus(r.p, status)}
                    onCall={callParent}
                    onMessage={(student) => setMessageTo({ tripId: trip._id, student })}
                  />
                  </SelectableRow>
                ))}
              </View>
            ))}
            {sections.length === 0 && <Text style={styles.emptyListText}>{searching ? 'No student matches that search.' : 'No students on this trip.'}</Text>}
          </View>
        </View>
      </ScrollView>

{selecting ? (
        <SafeAreaView edges={['bottom']} style={styles.selectBar}>
          <View style={styles.selectTop}>
            <Text style={styles.selectCount}>{selected.length} selected</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable
                hitSlop={8}
                onPress={() => setSelected(sections.flatMap((sec) => sec.rows.map((r) => r.p.student?._id)).filter(Boolean))}
              >
                <Text style={styles.selectLink}>Select all</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setSelected([])}>
                <Text style={styles.selectLink}>Cancel</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.selectActions}>
            <SmallButton label={words.board} onPress={() => askBulk('On board')} />
            <SmallButton label={words.drop} onPress={() => askBulk('Dropped off')} />
            <SmallButton label={words.notHere} variant="ghost" onPress={() => askBulk('Not on board')} />
            <Pressable
              onPress={() => setGroupMessage({ tripId: trip._id, session: trip.session, students: selectedRows.map((p) => p.student).filter(Boolean) })}
              style={({ pressed }) => [styles.smallBtn, styles.smallBtnGhost, styles.smsBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Send SMS to their parents"
            >
              <MessageSquare size={14} color={colors.slate600} />
              <Text style={[styles.smallBtnText, styles.smallBtnGhostText]}>SMS</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : (
              <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Button variant="outline" style={{ flex: 1 }} onPress={() => router.push('/trip/delay-broadcast')}>
            Delay SMS
          </Button>
          <Button variant="danger" style={{ flex: 1 }} onPress={() => setEndOpen(true)}>
            End trip
          </Button>
        </SafeAreaView>
      )}

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <MessageParentSheet target={messageTo} onClose={() => setMessageTo(null)} />
      <GroupMessageSheet
        target={groupMessage}
        onClose={(sent) => {
          setGroupMessage(null);
          if (sent) setSelected([]);
        }}
      />

      <Modal open={endOpen} onClose={() => setEndOpen(false)}>
        <Text style={styles.modalTitle}>End today's trip?</Text>
        <Text style={styles.modalSubtitle}>You are about to end the current trip.</Text>
        <View style={styles.summaryBox}>
          <SummaryRow label="Trip duration" value={formatClock(elapsed)} />
          <SummaryRow label={words.drop} value={`${droppedCount} of ${riding.length}`} />
          <SummaryRow label="Bus" value={busLabel(trip.bus)} />
          <SummaryRow label="Route" value={trip.route?.name} />
        </View>
        {onBoard.length > 0 && (
          <View style={[styles.warningBox, styles.dangerBox]}>
            <Text style={styles.dangerText}>
              {onBoard.length} student{onBoard.length === 1 ? ' is' : 's are'} still marked {words.onBus}:{' '}
              {onBoard.map((p) => p.student?.firstName).filter(Boolean).join(', ')}. Mark them {words.drop.toLowerCase()} first, or check the bus.
            </Text>
          </View>
        )}
        {unscanned.length > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              {unscanned.length} student{unscanned.length === 1 ? ' was' : 's were'} never marked {words.board.toLowerCase()} or {words.notHere.toLowerCase()}. Their
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
function StudentRow({ p, distance, session, isOnline, onSet, onCall, onMessage }) {
  const w = runWords(session);
  const name = p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Student';
  const when = p._offline || !isOnline ? ' (offline)' : p.alertTime ? ` at ${p.alertTime}` : '';
  const status = p.dropoffStatus;
  const call = callInfo(p);
  const extra = (
    <>
      {distance ? <Text style={styles.distanceText}>{distance}</Text> : null}
      {call ? <Text style={[styles.callText, CALL_TONE[call.tone]]}>{call.text}</Text> : null}
    </>
  );

  if (p.attendance === 'Absent' || p.attendance === 'Cancelled') {
    return (
      <View style={[styles.studentRow, styles.studentRowMuted]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.studentName, styles.mutedName]}>{name}</Text>
          <StudentMeta student={p.student} onCall={onCall} onMessage={onMessage} />
          {extra}
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
          {extra}
        </View>
        <Text style={styles.scannedText}>{w.drop}{when}</Text>
      </View>
    );
  }
  if (status === 'On board') {
    return (
      <View style={styles.studentRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{name}</Text>
          <Text style={styles.onBoardText}>{w.board}{when}</Text>
          <StudentMeta student={p.student} onCall={onCall} onMessage={onMessage} />
          {extra}
        </View>
        <SmallButton label={w.drop} onPress={() => onSet('Dropped off')} />
      </View>
    );
  }
  return (
    <View style={styles.studentRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.studentName}>{name}</Text>
        {status === 'Not on board' ? <Text style={styles.notHereText}>{w.notHere}{when}</Text> : <Text style={styles.waitingText}>{w.waiting}</Text>}
        <StudentMeta student={p.student} onCall={onCall} onMessage={onMessage} />
          {extra}
      </View>
      <View style={styles.actions}>
        {status !== 'Not on board' && <SmallButton label={w.notHere} variant="ghost" onPress={() => onSet('Not on board')} />}
        <SmallButton label={w.board} onPress={() => onSet('On board')} />
      </View>
    </View>
  );
}

// Hold to start selecting; while selecting, a tap adds or removes the student.
function SelectableRow({ selecting, isSelected, onToggle, children }) {
  return (
    <Pressable onLongPress={onToggle} delayLongPress={350} onPress={selecting ? onToggle : undefined} accessibilityState={{ selected: isSelected }}>
      <View pointerEvents={selecting ? 'none' : 'auto'} style={isSelected ? styles.selectedRow : undefined}>
        {children}
      </View>
      {selecting ? (
        <View style={styles.selectMark} pointerEvents="none">
          {isSelected ? <CheckCircle2 size={22} color={colors.brand600} /> : <Circle size={22} color={colors.slate300} />}
        </View>
      ) : null}
    </Pressable>
  );
}

const CALL_TONE = {
  info: { color: colors.brand600 },
  good: { color: colors.emerald700 },
  bad: { color: colors.red600 },
  plain: { color: colors.slate500 },
};

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
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
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
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.navy, borderRadius: radii.xl, padding: 14 },
  nextLabel: { color: colors.slate300, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  nextName: { color: colors.white, fontSize: 16, fontWeight: '800', marginTop: 2 },
  listLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listLinkText: { color: colors.brand600, fontSize: 13, fontWeight: '700' },
  assistBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  assistBtnText: { color: colors.brand600, fontSize: 13, fontWeight: '700' },
  noAssistant: { marginTop: 6, fontSize: 12, color: colors.slate400 },
  selectedRow: { borderRadius: radii.xl, borderWidth: 2, borderColor: colors.brand600 },
  selectMark: { position: 'absolute', top: 8, right: 8 },
  selectBar: { borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white, paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  selectTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectCount: { fontSize: 15, fontWeight: '800', color: colors.slate900 },
  selectLink: { fontSize: 14, fontWeight: '700', color: colors.brand600 },
  selectActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  smsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    marginBottom: 10,
  },
  searchField: { flex: 1, fontSize: 14, color: colors.slate800, paddingVertical: 0 },
  orderNote: { fontSize: 12, color: colors.slate500, marginBottom: 8 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: colors.slate500 },
  distanceText: { marginTop: 2, fontSize: 12, fontWeight: '700', color: colors.slate600 },
  callText: { marginTop: 2, fontSize: 12, fontWeight: '800' },
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
