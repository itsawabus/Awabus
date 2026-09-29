// Keeps sending the bus position while a trip runs, even with the screen off
// or another app open. Android shows a permanent notification ("AwaBus trip
// running") for as long as the trip runs; iPhone shows the blue location
// indicator. Started when a trip starts and stopped when it ends
// (src/components/BackgroundWork.jsx).
//
// This file must be imported when the app starts (app/_layout.jsx): the phone
// can wake the app just to hand it new positions, and the task has to be
// defined by then.
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './buildInfo.js';
import { useAuthStore } from '../store/authStore.js';
import { useLiveGpsStore } from '../store/liveGpsStore.js';
import { useOfflineQueueStore } from '../store/offlineQueueStore.js';
import { useConnectionStore } from '../store/connectionStore.js';

export const TRIP_LOCATION_TASK = 'awabus-trip-location';
const TRIP_KEY = 'awabus_background_trip'; // { tripId, driverId } while a trip is tracked
const TOKEN_KEY = 'awabus_driver_token'; // same key as src/store/authStore.js
// Same pace as the screen tracker: at most one position every 8 seconds.
export const PUSH_EVERY_MS = 8000;

const toPosition = (loc) => ({
  lat: loc.coords.latitude,
  lng: loc.coords.longitude,
  heading: loc.coords.heading || 0,
  recordedAt: new Date(loc.timestamp || Date.now()).toISOString(),
});

async function sendFromBackground(position) {
  const raw = await AsyncStorage.getItem(TRIP_KEY).catch(() => null);
  const trip = raw ? JSON.parse(raw) : null;
  if (!trip?.tripId) return;
  // The screen tracker and this task share one clock, so a position is never sent twice.
  const { lastSentAt, markSent } = useLiveGpsStore.getState();
  if (lastSentAt && Date.now() - lastSentAt < PUSH_EVERY_MS) return;
  markSent();
  const token = useAuthStore.getState().token || (await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null));
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/driver-app/trips/${trip.tripId}/location`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Location': 'on' },
      body: JSON.stringify(position),
    });
    if (res.ok) {
      useConnectionStore.getState().markSynced();
      return;
    }
    // The trip is over (ended here, by the school, or automatically): stop.
    if (res.status === 409 || res.status === 404 || res.status === 401) await stopTripTracking();
  } catch {
    // No connection: keep the latest position for later, but only when the
    // saved queue is loaded (never overwrite it from a cold background start).
    const queue = useOfflineQueueStore.getState();
    if (queue.isHydrated) queue.enqueue({ kind: 'location', tripId: trip.tripId, driverId: trip.driverId, payload: position });
  }
}

if (!TaskManager.isTaskDefined(TRIP_LOCATION_TASK)) {
  TaskManager.defineTask(TRIP_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const newest = data.locations[data.locations.length - 1];
    const position = toPosition(newest);
    useLiveGpsStore.getState().setPosition(position); // the screens show it when open
    await sendFromBackground(position);
  });
}

/**
 * "Allow all the time" location: 'granted', 'denied' (can be asked),
 * 'blocked' (only from the phone settings) or 'unavailable' (web).
 */
export async function backgroundPermission() {
  try {
    const perm = await Location.getBackgroundPermissionsAsync();
    if (perm.status === 'granted') return 'granted';
    return perm.canAskAgain === false ? 'blocked' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** Asks for "Allow all the time" (on newer Android this opens the settings page). */
export async function askBackgroundPermission() {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      if (fg.canAskAgain === false) Linking.openSettings().catch(() => {});
      return backgroundPermission();
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && bg.canAskAgain === false) Linking.openSettings().catch(() => {});
  } catch {
    Linking.openSettings().catch(() => {});
  }
  return backgroundPermission();
}

/**
 * Starts background tracking for this trip. Returns 'running', or why not
 * ('no_permission' | 'failed'); the screen tracker keeps working either way.
 */
export async function startTripTracking(tripId, driverId) {
  lastStartError = '';
  try {
    if (!TaskManager.isTaskDefined(TRIP_LOCATION_TASK)) throw new Error('The tracking task is not set up in this version of the app.');
    await AsyncStorage.setItem(TRIP_KEY, JSON.stringify({ tripId, driverId }));
    if ((await backgroundPermission()) !== 'granted') return 'no_permission';
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK).catch(() => false)) return 'running';
    await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 0,
      deferredUpdatesInterval: 5000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'AwaBus trip running',
        notificationBody: 'Sharing the bus location with the school until the trip ends.',
        notificationColor: '#0a1f2a',
        killServiceOnDestroy: false,
      },
    });
    return 'running';
  } catch (err) {
    lastStartError = err?.message || String(err);
    console.warn('[background location] could not start:', lastStartError);
    return 'failed';
  }
}

// Why the last start failed, in the phone's own words (shown to the driver).
let lastStartError = '';
export const startErrorMessage = () => lastStartError;

/** Stops background tracking (trip ended, signed out). Safe to call any time. */
export async function stopTripTracking() {
  await AsyncStorage.removeItem(TRIP_KEY).catch(() => {});
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    }
  } catch {
    // not running
  }
}
