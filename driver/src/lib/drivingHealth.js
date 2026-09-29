// Driving mode: is everything working? Green when the phone has internet and
// a good, fresh GPS reading; yellow with the problems in plain words.

export const STALE_FIX_MS = 2 * 60 * 1000; // no new reading for two minutes (phones keep reporting when parked)
export const WEAK_FIX_M = 100; // readings rougher than this are not trusted
export const FIRST_FIX_GRACE_MS = 30 * 1000; // time to get the first reading

/**
 * { ok, problems: [{ key, title, detail }], checks: { internet, location } }
 * `since` is when driving mode opened (a missing first reading is only a
 * problem after a short wait).
 */
export function drivingHealth({ isOnline, locationState, gpsError, position, waiting = 0, now = Date.now(), since = now }) {
  const problems = [];
  if (!isOnline) {
    problems.push({
      key: 'internet',
      title: 'No internet',
      detail: `Keep driving. ${waiting ? `${waiting} update${waiting === 1 ? '' : 's'} saved, ` : 'Updates are saved and '}sent when the network is back.`,
    });
  }
  if (locationState === 'denied') {
    problems.push({ key: 'location', title: 'Location not allowed', detail: 'Allow location for AwaBus in the phone settings when you stop.' });
  } else if (locationState === 'off') {
    problems.push({ key: 'location', title: 'Location is off', detail: 'Turn on location when it is safe, so the school can see the bus.' });
  } else if (gpsError) {
    problems.push({ key: 'location', title: 'GPS problem', detail: String(gpsError) });
  } else {
    const at = position?.recordedAt ? new Date(position.recordedAt).getTime() : null;
    if (!position) {
      if (now - since > FIRST_FIX_GRACE_MS) problems.push({ key: 'gps', title: 'No GPS reading yet', detail: 'The phone has not found the bus position. Keep the phone where it can see the sky.' });
    } else if (at && now - at > STALE_FIX_MS) {
      const mins = Math.max(1, Math.round((now - at) / 60000));
      problems.push({ key: 'gps', title: 'GPS stopped updating', detail: `No new position for ${mins} min.` });
    } else if (Number.isFinite(position.accuracy) && position.accuracy > WEAK_FIX_M) {
      problems.push({ key: 'gps', title: 'Weak GPS signal', detail: `The position is only good to about ${Math.round(position.accuracy)} m.` });
    }
  }
  const has = (k) => problems.some((p) => p.key === k);
  return {
    ok: problems.length === 0,
    problems,
    checks: { internet: !has('internet'), location: !has('location') && !has('gps') },
  };
}
