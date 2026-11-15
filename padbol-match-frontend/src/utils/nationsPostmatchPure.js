function summaryPath(id) {
  const value = String(id ?? '');
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('INVALID_NATIONS_MATCH');
  return `/api/nations/partidos/${value}/resumen`;
}
function cleanSummary(raw) {
  if (!raw || typeof raw.summary !== 'string' || !raw.summary.trim() || raw.summary.length > 2400) throw new Error('INVALID_NATIONS_SUMMARY');
  const highlights = Array.isArray(raw.highlights) ? raw.highlights.slice(0, 3).map(item => typeof item === 'string' ? item : item?.text).filter(text => typeof text === 'string' && text.length <= 600) : [];
  const rows = raw.observed?.players ?? [];
  if (!Array.isArray(rows) || rows.length > 8) throw new Error('INVALID_NATIONS_STATS');
  const players = rows.map(p => {
    if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 160 || !['A', 'B'].includes(p.team) || !Number.isFinite(p.points_observed) || p.points_observed < 0 || !Number.isFinite(p.on_court_seconds) || p.on_court_seconds < 0) throw new Error('INVALID_NATIONS_STATS');
    return {name: p.name, team: p.team, points_observed: p.points_observed, on_court_seconds: p.on_court_seconds};
  });
  return {title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : '', summary: raw.summary.trim(), highlights, observed: {players}};
}
async function fetchNationsPostmatch({id, accessToken, baseUrl = '', fetchImpl = fetch, signal} = {}) {
  const path = summaryPath(id);
  if (!accessToken) return {state: 'unauthorized', resumen: null};
  let response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}${path}`, {headers: {Authorization: `Bearer ${accessToken}`}, cache: 'no-store', signal});
  let body = await response.json().catch(() => ({}));
  if (response.status === 404 && body.code === 'NATIONS_POSTMATCH_NOT_QUEUED') {
    response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}${path}`, {method: 'POST', headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'}, body: '{}', cache: 'no-store', signal});
    body = await response.json().catch(() => ({}));
  }
  if (response.status === 401) return {state: 'unauthorized', resumen: null};
  if ([403, 404].includes(response.status)) return {state: 'forbidden', resumen: null};
  if (response.status === 409 && ['insufficient', 'uncertain', 'failed'].includes(body.state)) return {state: body.state, resumen: null};
  if (response.status === 202 && ['queued', 'generating'].includes(body.state)) return {state: body.state, resumen: null};
  if (response.ok && body.state === 'ready') {
    if (body.resumen?.partido_id != null && String(body.resumen.partido_id) !== String(id)) throw new Error('NATIONS_MATCH_CHANGED');
    return {state: 'ready', resumen: cleanSummary(body.resumen)};
  }
  if (response.ok && ['insufficient', 'uncertain', 'failed'].includes(body.state)) return {state: body.state, resumen: null};
  throw new Error('NATIONS_SUMMARY_UNAVAILABLE');
}
function formatCourtTime(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
module.exports = {summaryPath, cleanSummary, fetchNationsPostmatch, formatCourtTime};
