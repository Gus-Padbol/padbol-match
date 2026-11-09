import { useEffect, useRef, useState } from 'react';

// Sequential requests preserve the existing server-side authorization per profile.
// Never retry automatically: a failed response can have an uncertain outcome.
export default function useBulkPendingValidation({ rows, context, recoveryContext = context, ready, isSuperAdmin, update, onSuccess, confirm, actionLabel }) {
  const [selection, setSelection] = useState({ context, ids: [] });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const current = useRef({ context, ready, version: 0 });
  current.current = { context, ready, version: current.current.version + (current.current.context !== context || current.current.ready !== ready ? 1 : 0) };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const visibleIds = rows.map(row => String(row.id));
  const selected = selection.context === context ? selection.ids.filter(id => visibleIds.includes(id)) : [];
  useEffect(() => {
    setSelection({ context, ids: [] });
    setResult(previous => previous?.failed && previous.recoveryContext === recoveryContext ? previous : null);
  }, [context, recoveryContext]);
  const outcome = (result?.failed ? result.recoveryContext === recoveryContext : result?.context === context) ? result : null;
  const blocked = Boolean(outcome?.failed);
  const toggle = id => {
    if (lock.current || !ready || blocked) return;
    const value = String(id);
    if (!visibleIds.includes(value)) return;
    setSelection({ context, ids: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] });
  };
  const toggleAll = () => {
    if (lock.current || !ready || blocked) return;
    setSelection({ context, ids: selected.length === visibleIds.length ? [] : visibleIds });
  };
  const run = async action => {
    if (lock.current || !ready || blocked || !selected.length || !['aprobar', 'rechazar'].includes(action) || (action === 'rechazar' && !isSuperAdmin)) return;
    if (!confirm(actionLabel(action), selected.length)) return;
    lock.current = true;
    setBusy(true);
    setResult(null);
    const ids = [...selected];
    const version = current.current.version;
    let completed = 0;
    const isCurrent = () => mounted.current && current.current.context === context && current.current.ready && current.current.version === version;
    try {
      for (const id of ids) {
        if (!isCurrent()) break;
        try {
          await update(id, action);
        } catch (error) {
          if (isCurrent()) setResult({ context, recoveryContext, completed, total: ids.length, failed: true, error: error?.message || '' });
          return;
        }
        completed += 1;
        if (!isCurrent()) break;
        onSuccess(id);
        setSelection(previous => previous.context === context ? { context, ids: previous.ids.filter(value => value !== id) } : previous);
        setResult({ context, completed, total: ids.length, failed: false });
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { selected, busy, lock, blocked, outcome, toggle, toggleAll, run };
}
