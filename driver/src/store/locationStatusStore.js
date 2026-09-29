import { create } from 'zustand';

// Is the phone reading the bus location? Checked in the background
// (src/components/BackgroundWork.jsx) and sent to the school with every
// request (X-Location header, src/api/client.js), so the admin sees the bus
// as online or offline.
//   state: 'unknown' | 'on' | 'off' (location switched off / no reading) | 'denied' (not allowed)
export const useLocationStatusStore = create((set) => ({
  state: 'unknown',
  checkedAt: null,
  setState: (state) => set({ state, checkedAt: Date.now() }),
}));

/** The bus shows online at the school when location is on AND the phone has data. */
export const busOnlineFrom = (locationState, isOnline) => locationState === 'on' && Boolean(isOnline);

/** Why the bus is offline, in words for the driver ('' when online). */
export function busOfflineReason(locationState, isOnline) {
  if (locationState === 'denied') return 'AwaBus is not allowed to use location. Allow location for AwaBus in your phone settings.';
  if (locationState === 'off') return 'Location is off. Turn on location so the school can see the bus.';
  if (!isOnline) return 'Mobile data is off or there is no signal. Turn on data so the school can see the bus.';
  if (locationState === 'unknown') return 'Checking location...';
  return '';
}
