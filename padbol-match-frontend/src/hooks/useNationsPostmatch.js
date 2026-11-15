import {useCallback, useEffect, useMemo, useState} from 'react';
const {fetchNationsPostmatch} = require('../utils/nationsPostmatchPure.js');

export default function useNationsPostmatch({id, accessToken, baseUrl, active = true}) {
  const scope = useMemo(() => ({id, accessToken, baseUrl}), [id, accessToken, baseUrl]);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({scope: null, state: 'loading', resumen: null});
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!active) return undefined;
    let disposed = false, timer, controller, timeout, attempts = 0;
    if (!accessToken) {
      setResult({scope, state: 'unauthorized', resumen: null});
      return undefined;
    }
    setResult(old => old.scope === scope && old.state === 'ready' ? {...old, refreshing: true, refreshError: false} : {scope, state: 'loading', resumen: null});
    async function load() {
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const next = await fetchNationsPostmatch({id, accessToken, baseUrl, signal: controller.signal});
        if (disposed) return;
        const pending = ['queued', 'generating'].includes(next.state);
        const pollingPaused = pending && ++attempts >= 12;
        setResult({scope, ...next, pollingPaused});
        if (pending && !pollingPaused) timer = setTimeout(load, 5000);
      } catch {
        if (!disposed) setResult(old => old.scope === scope && old.state === 'ready' ? {...old, refreshing: false, refreshError: true} : {scope, state: 'failed', resumen: null});
      } finally { clearTimeout(timeout); }
    }
    load();
    return () => { disposed = true; clearTimeout(timer); clearTimeout(timeout); controller?.abort(); };
  }, [scope, revision, active, id, accessToken, baseUrl]);
  return {...(result.scope === scope ? result : {state: accessToken ? 'loading' : 'unauthorized', resumen: null}), refresh};
}
