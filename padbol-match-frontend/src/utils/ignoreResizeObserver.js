/**
 * Silencia en desarrollo (y producción) el warning benigno de ResizeObserver en Chrome.
 * No oculta otros errores: solo mensajes que coinciden con los loops conocidos de ResizeObserver.
 */
function isBenignResizeObserverMessage(msg) {
  const s = String(msg ?? '');
  return (
    s.includes('ResizeObserver loop completed') ||
    s.includes('ResizeObserver loop limit exceeded')
  );
}

function install() {
  if (typeof window === 'undefined') return;
  if (window.__padbolIgnoreResizeObserverInstalled) return;
  window.__padbolIgnoreResizeObserverInstalled = true;

  window.addEventListener(
    'error',
    (e) => {
      const msg = e?.message || e?.error?.message || '';
      if (isBenignResizeObserverMessage(msg)) {
        e.stopImmediatePropagation?.();
      }
    },
    true
  );

  const orig = console.error.bind(console);
  console.error = (...args) => {
    const s = String(args[0] ?? '');
    if (isBenignResizeObserverMessage(s)) return;
    orig(...args);
  };
}

install();
