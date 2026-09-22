import { useEffect, useState } from 'react';

/**
 * An estimate of the current server time that ticks so live counters advance. `serverNow` is the
 * server clock at the last fetch; we anchor to it and add the wall-clock elapsed since. Resets
 * whenever a fresh snapshot arrives (a new `serverNow`).
 */
export function useServerNow(serverNow: number, intervalMs = 500): number {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const anchor = Date.now();
    setNow(serverNow);
    const id = setInterval(() => setNow(serverNow + (Date.now() - anchor)), intervalMs);
    return () => clearInterval(id);
  }, [serverNow, intervalMs]);

  return now;
}
