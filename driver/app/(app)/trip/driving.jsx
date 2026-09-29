import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useStayAwake } from '../../../src/hooks/useStayAwake.js';
import { AlertTriangle, CheckCircle2, CornerUpRight, Globe, MapPin, X } from 'lucide-react-native';
import { getTodaysTrip } from '../../../src/api/driverApp.js';
import { useConnectionStore } from '../../../src/store/connectionStore.js';
import { useLocationStatusStore } from '../../../src/store/locationStatusStore.js';
import { useLiveGpsStore } from '../../../src/store/liveGpsStore.js';
import { useOfflineQueueStore } from '../../../src/store/offlineQueueStore.js';
import { useUiStore } from '../../../src/store/uiStore.js';
import { drivingHealth } from '../../../src/lib/drivingHealth.js';
import { orderTrip, formatDistance } from '../../../src/lib/nearest.js';
import { hasHome, openDirections } from '../../../src/lib/directions.js';
import { runWords } from '../../../src/lib/runs.js';
import { formatClock } from '../../../src/lib/utils.js';
import { currentScheme, themed } from '../../../src/lib/theme.js';

// Screen colours: very light green = all good, yellow = something needs a
// look. Deeper shades in the dark theme so the screen does not dazzle at night.
const LOOKS = {
  light: {
    good: { bg: '#dcfce7', ink: '#14532d', soft: '#166534', card: 'rgba(255,255,255,0.65)' },
    warn: { bg: '#fef08a', ink: '#713f12', soft: '#854d0e', card: 'rgba(255,255,255,0.6)' },
  },
  dark: {
    good: { bg: '#0f3d24', ink: '#dcfce7', soft: '#86efac', card: 'rgba(0,0,0,0.25)' },
    warn: { bg: '#4d3b06', ink: '#fef9c3', soft: '#fde047', card: 'rgba(0,0,0,0.25)' },
  },
};

/**
 * Driving mode: very few details, large, and the whole screen says whether
 * everything is working (internet and location): light green when it is,
 * yellow with the problem when it is not.
 */
export default function DrivingMode() {
  useStayAwake('awabus-driving');
  const insets = useSafeAreaInsets();
  useUiStore((s) => s.themeVersion);
  const vibration = useUiStore((s) => s.vibration);
  const isOnline = useConnectionStore((s) => s.isOnline);
  const locationState = useLocationStatusStore((s) => s.state);
  const position = useLiveGpsStore((s) => s.position);
  const gpsError = useLiveGpsStore((s) => s.error);
  const queue = useOfflineQueueStore((s) => s.queue);
  const { data: trip } = useQuery({ queryKey: ['todays-trip'], queryFn: getTodaysTrip, refetchInterval: 20000 });

  const [since] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Back to the trip screen when the trip is no longer running.
  const notLive = Boolean(trip) && trip.status !== 'In Progress' && trip.status !== 'Delayed';
  useFocusEffect(
    useCallback(() => {
      if (notLive) router.replace('/');
    }, [notLive])
  );

  const waiting = queue.filter((q) => q.tripId === trip?._id).length;
  const health = drivingHealth({ isOnline, locationState, gpsError, position, waiting, now, since });

  // A buzz when something goes wrong, so the driver need not keep looking.
  const wasOk = useRef(true);
  useEffect(() => {
    if (wasOk.current && !health.ok && vibration) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    wasOk.current = health.ok;
  }, [health.ok, vibration]);

  const words = runWords(trip?.session);
  const progress = trip?.studentProgress || [];
  const riding = progress.filter((p) => p.attendance !== 'Absent' && p.attendance !== 'Cancelled');
  const onBus = riding.filter((p) => p.dropoffStatus === 'On board').length;
  const done = riding.filter((p) => p.dropoffStatus === 'Dropped off').length;
  const goodFix = position && !(Number.isFinite(position.accuracy) && position.accuracy > 100);
  const bus = (goodFix ? position : null) || trip?.liveLocation || null;
  const lastOrder = useRef([]);
  const next = useMemo(() => {
    const r = orderTrip({ progress, session: trip?.session, bus, previous: lastOrder.current });
    lastOrder.current = r.order;
    return r.next[0] || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, trip?.session, bus?.lat, bus?.lng]);

  // Nobody to go to next: say why, for the run.
  const stillWaiting = riding.filter((p) => !p.dropoffStatus || p.dropoffStatus === 'Pending' || p.dropoffStatus === 'Boarding now').length;
  const noNextText =
    trip?.session === 'evening'
      ? stillWaiting && !onBus
        ? 'Nobody on the bus yet'
        : 'Everyone dropped home'
      : stillWaiting
        ? 'No homes saved for the rest'
        : onBus
          ? 'All picked up: head to school'
          : 'No more pick-ups';

  const elapsed = trip?.startedAt ? Math.max(0, Math.floor((now - new Date(trip.startedAt).getTime()) / 1000)) : 0;
  const look = LOOKS[currentScheme() === 'dark' ? 'dark' : 'light'][health.ok ? 'good' : 'warn'];
  const Check = ({ ok, Icon, label }) => (
    <View style={styles.check}>
      <Icon size={18} color={look.soft} />
      <Text style={[styles.checkText, { color: look.ink }]}>
        {label} {ok ? '✓' : '✗'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: look.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]} testID="driving-mode">
      <View style={styles.top}>
        <Text style={[styles.timer, { color: look.ink }]}>{formatClock(elapsed)}</Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.exit, { backgroundColor: look.card }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Leave driving mode"
        >
          <X size={20} color={look.ink} />
          <Text style={[styles.exitText, { color: look.ink }]}>Exit</Text>
        </Pressable>
      </View>

      <View style={styles.status}>
        {health.ok ? <CheckCircle2 size={72} color={look.soft} /> : <AlertTriangle size={72} color={look.soft} />}
        <Text style={[styles.statusTitle, { color: look.ink }]} accessibilityLiveRegion="polite">
          {health.ok ? 'All good' : health.problems.map((p) => p.title).join(' · ')}
        </Text>
        {health.ok ? (
          <Text style={[styles.statusDetail, { color: look.soft }]}>The school can see the bus.</Text>
        ) : (
          health.problems.map((p) => (
            <Text key={p.key} style={[styles.statusDetail, { color: look.soft }]}>
              {p.detail}
            </Text>
          ))
        )}
        <View style={styles.checks}>
          <Check ok={health.checks.internet} Icon={Globe} label="Internet" />
          <Check ok={health.checks.location} Icon={MapPin} label="Location" />
        </View>
      </View>

      <View style={[styles.nextCard, { backgroundColor: look.card }]}>
        {next ? (
          <>
            <Text style={[styles.nextLabel, { color: look.soft }]}>Next</Text>
            <Text style={[styles.nextName, { color: look.ink }]} numberOfLines={1}>
              {next.p.student?.firstName} {next.p.student?.lastName}
            </Text>
            <Text style={[styles.nextDist, { color: look.ink }]}>
              {next.metres != null ? formatDistance(next.metres) : next.noHome ? 'No home location saved' : ''}
            </Text>
            {hasHome(next.p.student) ? (
              <Pressable onPress={() => openDirections(next.p.student)} style={styles.dirButton} accessibilityRole="button" accessibilityLabel="Directions">
                <CornerUpRight size={18} color="#ffffff" />
                <Text style={styles.dirText}>Directions</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={[styles.nextName, { color: look.ink }]}>{noNextText}</Text>
        )}
        <Text style={[styles.counts, { color: look.soft }]}>
          {onBus} {words.onBus} · {done} {words.dropCount || 'done'}
        </Text>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  page: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timer: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  exit: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  exitText: { fontSize: 16, fontWeight: '800' },
  status: { alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  statusTitle: { fontSize: 34, fontWeight: '900', textAlign: 'center' },
  statusDetail: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  checks: { flexDirection: 'row', gap: 20, marginTop: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: 16, fontWeight: '800' },
  nextCard: { borderRadius: 20, padding: 18, alignItems: 'center', gap: 4 },
  nextLabel: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  nextName: { fontSize: 30, fontWeight: '900', textAlign: 'center' },
  nextDist: { fontSize: 22, fontWeight: '800' },
  dirButton: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0d9488', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  dirText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  counts: { marginTop: 8, fontSize: 15, fontWeight: '700' },
}));
