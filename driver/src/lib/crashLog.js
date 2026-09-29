import AsyncStorage from '@react-native-async-storage/async-storage';

// Keeps the last error that closed the app, so the next launch can show it
// (a release app otherwise just disappears with no message).
const KEY = 'awabus_last_crash';

export function installCrashLog() {
  const handler = global.ErrorUtils;
  if (!handler?.setGlobalHandler) return;
  const previous = handler.getGlobalHandler?.();
  handler.setGlobalHandler((error, isFatal) => {
    const entry = {
      message: String(error?.message || error).slice(0, 400),
      stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n').slice(0, 800),
      fatal: Boolean(isFatal),
      at: Date.now(),
    };
    AsyncStorage.setItem(KEY, JSON.stringify(entry)).catch(() => {});
    // A fatal error closes the app: give the note a moment to be saved first.
    if (isFatal) setTimeout(() => previous?.(error, isFatal), 400);
    else previous?.(error, isFatal);
  });
}

export async function readLastCrash() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const clearLastCrash = () => AsyncStorage.removeItem(KEY).catch(() => {});

export const saveCrash = (error) =>
  AsyncStorage.setItem(
    KEY,
    JSON.stringify({ message: String(error?.message || error).slice(0, 400), stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n'), fatal: true, at: Date.now() })
  ).catch(() => {});

/**
 * Sends a recorded crash to the AwaBus server once (the System page lists
 * them), so a crash on a driver's phone can be fixed without the phone.
 */
export async function reportLastCrash(send) {
  const crash = await readLastCrash();
  if (!crash || crash.reported) return;
  try {
    await send(crash);
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...crash, reported: true }));
  } catch {
    // try again next launch
  }
}
