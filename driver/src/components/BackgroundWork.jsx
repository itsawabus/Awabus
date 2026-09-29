import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { getTodaysTrip, getNotifications, pushLocation } from '../api/driverApp.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { useLocationStatus } from '../hooks/useLocationStatus.js';
import { useLiveGpsStore } from '../store/liveGpsStore.js';
import { useOfflineQueueStore } from '../store/offlineQueueStore.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useUiStore } from '../store/uiStore.js';
import { startTripTracking, stopTripTracking, startErrorMessage, PUSH_EVERY_MS } from '../lib/backgroundLocation.js';

// A new position goes to the school at most every PUSH_EVERY_MS (8 s)...
// ...and at least this often while the trip runs, even when the bus is parked,
// so Live Tracking keeps showing the bus as live instead of "not reporting".
const HEARTBEAT_MS = 30000;
// The heartbeat only vouches for a position the phone confirmed recently. If
// the phone has had no GPS fix for this long, nothing is re-sent and the school
// sees the bus as "not reporting", which is the truth.
const FIX_TRUSTED_MS = 2 * 60 * 1000;

const isLive = (trip) => trip && (trip.status === 'In Progress' || trip.status === 'Delayed');

/**
 * Work that must go on whatever screen the driver is on: sending the bus
 * position while a trip runs, and checking for new notifications. It never
 * changes the screen. Mounted once, for a signed-in driver.
 */
export default function BackgroundWork() {
  const driverId = useAuthStore((s) => s.driver?.id);
  const { data: trip } = useQuery({ queryKey: ['todays-trip'], queryFn: getTodaysTrip, refetchInterval: 30000 });
  const live = isLive(trip);
  const tripId = live ? trip._id : null;

  const { position, error } = useGeolocation(live);

  // Bus online / offline: check location, and tell the school at once when it
  // changes (the next request carries the new X-Location reading).
  const queryClient = useQueryClient();
  useLocationStatus(() => queryClient.invalidateQueries({ queryKey: ['todays-trip'] }));
  // When the last position went out, shared with the screen-off tracker so
  // the two never send the same moment twice.
  const sinceLastSend = () => Date.now() - (useLiveGpsStore.getState().lastSentAt || 0);

  const send = (payload) => {
    if (!tripId) return;
    useLiveGpsStore.getState().markSent();
    pushLocation(tripId, payload)
      .then(() => {
        useConnectionStore.getState().markSynced();
        useLiveGpsStore.getState().markSent();
      })
      .catch(() => useOfflineQueueStore.getState().enqueue({ kind: 'location', tripId, driverId, payload }));
  };

  useEffect(() => {
    useLiveGpsStore.getState().setError(error || null);
  }, [error]);

  // A fresh reading from the phone.
  useEffect(() => {
    if (!position) return;
    useLiveGpsStore.getState().setPosition(position);
    if (sinceLastSend() >= PUSH_EVERY_MS) send(position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, tripId]);

  // Heartbeat: re-send where the bus is when nothing new came in for a while.
  useEffect(() => {
    if (!tripId) {
      useLiveGpsStore.getState().reset();
      return undefined;
    }
    const timer = setInterval(() => {
      const last = useLiveGpsStore.getState().position;
      const fixIsRecent = last && Date.now() - new Date(last.recordedAt || 0).getTime() < FIX_TRUSTED_MS;
      if (last && fixIsRecent && sinceLastSend() >= HEARTBEAT_MS) send({ ...last, recordedAt: new Date().toISOString() });
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Screen off or another app open: keep sending from the background while
  // the trip runs (needs "Allow all the time" location), and stop at the end.
  const background = useLiveGpsStore((s) => s.background);
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    if (tripId) {
      // A few seconds after the app is on screen (never during start-up), and
      // only while it is in front: Android refuses to start it otherwise.
      const manual = background === 'retry';
      const start = () => {
        if (cancelled) return;
        if (AppState.currentState !== 'active') {
          timer = setTimeout(start, 2000);
          return;
        }
        startTripTracking(tripId, driverId, { manual }).then((state) => {
          if (!cancelled) useLiveGpsStore.getState().setBackground(state, state === 'failed' ? startErrorMessage() : '');
        });
      };
      timer = setTimeout(start, manual ? 0 : 4000);
    } else {
      stopTripTracking();
      useLiveGpsStore.getState().setBackground('off');
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // 'retry' (set after the driver allows "all the time") starts it again.
  }, [tripId, driverId, background === 'retry']);
  // Signed out (this component goes away): stop tracking.
  useEffect(() => () => {
    stopTripTracking();
  }, []);

  // New notifications: a short vibration if the driver wants it.
  const { data: notifications } = useQuery({ queryKey: ['driver-notifications'], queryFn: getNotifications, refetchInterval: 5 * 60 * 1000 });
  const newestRef = useRef(null);
  useEffect(() => {
    const newest = notifications?.[0]?.at ? new Date(notifications[0].at).getTime() : 0;
    const { notificationSounds, notificationsSeenAt } = useUiStore.getState();
    if (newestRef.current !== null && newest > newestRef.current && newest > (notificationsSeenAt || 0) && notificationSounds) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    newestRef.current = newest;
  }, [notifications]);

  return null;
}
