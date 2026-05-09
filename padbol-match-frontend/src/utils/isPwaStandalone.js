/**
 * True when the app runs as an installed PWA (not in the browser tab).
 */
export function isPwaStandalone() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  } catch {
    /* ignore */
  }
  if (typeof window.navigator.standalone === 'boolean' && window.navigator.standalone) return true;
  return false;
}

export function isLikelyIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
