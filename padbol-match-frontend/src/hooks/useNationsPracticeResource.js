import {useCallback, useEffect, useState} from 'react';

/** Serial, abortable polling. Scope changes hide old data before a new request. */
export default function useNationsPracticeResource({scope, load, enabled = true, interval = 2000}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({scope: null, data: null, status: 'loading'});
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  const publish = useCallback(data => {
    setResult({scope, data, status: 'ready', refreshing: true, receivedAt: Date.now()});
    refresh();
  }, [scope, refresh]);
  useEffect(() => {
    if (!enabled) return undefined;
    let disposed = false, timer, controller, timeout, staleTimer, sequence = 0;
    const visible = () => !document.hidden;
    async function run() {
      if (disposed || !visible()) return;
      const request = ++sequence;
      const currentController = new AbortController();
      controller = currentController;
      const deadline = setTimeout(() => currentController.abort(), 10000);
      timeout = deadline;
      try {
        const data = await load(currentController.signal);
        if (!disposed && request === sequence) {
          const receivedAt = Date.now();
          setResult({scope, data, status: 'ready', refreshing: false, receivedAt});
          clearTimeout(staleTimer);
          if (interval) staleTimer = setTimeout(() => {
            if (!disposed && visible()) setResult(old => old.scope === scope && old.receivedAt === receivedAt ? {...old, status: 'offline', refreshing: false} : old);
          }, Math.max(6000, interval * 3));
        }
      } catch (error) {
        if (!disposed && request === sequence) setResult(old => ({scope, data: old.scope === scope ? old.data : null, status: error.status === 410 ? 'expired' : [401,403].includes(error.status) ? 'forbidden' : 'offline', refreshing: false}));
      } finally {
        clearTimeout(deadline);
        if (!disposed && request === sequence && visible() && interval) timer = setTimeout(run, interval);
      }
    }
    function onVisibility() {
      ++sequence; clearTimeout(timer); clearTimeout(timeout); clearTimeout(staleTimer); controller?.abort();
      setResult(old => old.scope === scope ? {...old, status: visible() ? 'refreshing' : 'offline', refreshing: visible()} : old);
      if (visible()) run();
    }
    setResult(old => old.scope === scope && old.data ? {...old, status: 'refreshing', refreshing: true} : {scope, data: null, status: 'loading'});
    run(); document.addEventListener('visibilitychange', onVisibility);
    return () => { disposed = true; clearTimeout(timer); clearTimeout(timeout); clearTimeout(staleTimer); controller?.abort(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [scope, load, enabled, interval, attempt]);
  return {...(result.scope === scope ? result : {data: null, status: 'loading'}), refresh, publish};
}
