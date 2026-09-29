import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs`, so "x min ago" labels keep moving. */
export default function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
