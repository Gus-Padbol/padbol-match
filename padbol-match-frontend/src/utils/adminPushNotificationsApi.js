async function adminPushFetch({ apiBaseUrl, accessToken, path, method = 'GET', body }) {
  const headers = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${String(apiBaseUrl).replace(/\/$/, '')}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Error');
    err.status = res.status;
    err.code = data?.code;
    err.quota = data?.quota;
    throw err;
  }
  return data;
}

export function fetchAdminPushQuota({ apiBaseUrl, accessToken }) {
  return adminPushFetch({ apiBaseUrl, accessToken, path: '/api/push/admin-quota' });
}

export function fetchAdminPushHistory({ apiBaseUrl, accessToken }) {
  return adminPushFetch({ apiBaseUrl, accessToken, path: '/api/push/admin-history' });
}

export function previewAdminPushSegment({ apiBaseUrl, accessToken, segment }) {
  return adminPushFetch({
    apiBaseUrl,
    accessToken,
    path: '/api/push/admin-segment-preview',
    method: 'POST',
    body: { segment },
  });
}

export function searchAdminPushPlayers({ apiBaseUrl, accessToken, q }) {
  const qs = encodeURIComponent(String(q || '').trim());
  return adminPushFetch({ apiBaseUrl, accessToken, path: `/api/push/admin-search-players?q=${qs}` });
}

export function sendAdminPushNotification({ apiBaseUrl, accessToken, title, body, segment }) {
  return adminPushFetch({
    apiBaseUrl,
    accessToken,
    path: '/api/push/send-admin',
    method: 'POST',
    body: { title, body, segment },
  });
}

export function formatAdminPushSegmentLabel(segment, t) {
  const seg = segment && typeof segment === 'object' ? segment : {};
  const type = String(seg.type || '').toLowerCase();
  switch (type) {
    case 'todos_usuarios':
      return t('admin.pushNotif.segments.allUsers');
    case 'todos_pais':
      return t('admin.pushNotif.segments.allCountry');
    case 'pais':
      return t('admin.pushNotif.segments.country', { country: seg.pais || '—' });
    case 'sede':
    case 'sede_mia':
      return t('admin.pushNotif.segments.venue', { id: seg.sedeId ?? seg.sede_id ?? '—' });
    case 'deporte':
      return t('admin.pushNotif.segments.sport', { sport: seg.deporte || '—' });
    case 'jugador':
      return seg.email
        ? t('admin.pushNotif.segments.playerEmail', { email: seg.email })
        : t('admin.pushNotif.segments.player');
    default:
      return type || '—';
  }
}
