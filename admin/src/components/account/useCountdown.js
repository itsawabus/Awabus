import { useEffect, useState } from 'react';

/** Seconds-remaining counter for "Resend code in Ns". */
export default function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return { seconds, start: setSeconds };
}
