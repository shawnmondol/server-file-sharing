import { useCallback, useEffect, useRef, useState } from 'react';
import { isReachable } from '../lib/api';

export type Connection = 'online' | 'offline' | 'checking';

/** Fast poll while offline so recovery feels immediate; slow when healthy. */
const HEALTHY_INTERVAL_MS = 30_000;
const DEGRADED_INTERVAL_MS = 5_000;

/**
 * Tracks whether the Pi is actually reachable, which is a different question
 * from `navigator.onLine`: the phone can have perfect Wi-Fi while the tailnet
 * route to the server is gone. The health endpoint answers the real one.
 */
export function useConnection() {
  const [status, setStatus] = useState<Connection>('checking');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('offline');
      return false;
    }
    const reachable = await isReachable();
    setStatus(reachable ? 'online' : 'offline');
    return reachable;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const schedule = (delay: number) => {
      timer.current = setTimeout(async () => {
        if (cancelled) return;
        const reachable = await check();
        if (!cancelled) schedule(reachable ? HEALTHY_INTERVAL_MS : DEGRADED_INTERVAL_MS);
      }, delay);
    };

    void check().then((reachable) => {
      if (!cancelled) schedule(reachable ? HEALTHY_INTERVAL_MS : DEGRADED_INTERVAL_MS);
    });

    // The browser's own events are still worth listening to — they turn a
    // Wi-Fi change into an instant re-check rather than a poll-interval wait.
    const onOnline = () => void check();
    const onOffline = () => setStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [check]);

  return { status, recheck: check };
}
