/**
 * Coordenadas y país aproximados del usuario vía IP (fallback si el navegador niega GPS).
 * @returns {Promise<{ lat: number, lon: number, source: 'ip', country: string, countryCode: string } | null>}
 */
export async function fetchCoordsFromIp() {
  if (typeof fetch === 'undefined') return null;

  const controllers = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controllers &&
    setTimeout(() => {
      try {
        controllers.abort();
      } catch {
        /* ignore */
      }
    }, 6000);

  try {
    const res = await fetch('https://ipwho.is/', {
      signal: controllers?.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const lat = Number(j?.latitude);
    const lon = Number(j?.longitude);
    if (j?.success !== false && Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        lat,
        lon,
        source: 'ip',
        country: String(j?.country || '').trim(),
        countryCode: String(j?.country_code || '').trim(),
      };
    }
  } catch {
    /* ignore */
  } finally {
    if (timer) clearTimeout(timer);
  }
  return null;
}
