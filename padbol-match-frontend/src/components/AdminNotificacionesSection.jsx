import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import {
  fetchAdminPushHistory,
  fetchAdminPushQuota,
  formatAdminPushSegmentLabel,
  previewAdminPushSegment,
  searchAdminPushPlayers,
  sendAdminPushNotification,
} from '../utils/adminPushNotificationsApi';
import './AdminNotificacionesSection.css';

const TITLE_MAX = 50;
const BODY_MAX = 150;

function translatedPushError(error, t, fallbackKey) {
  if (error?.code === 'ADMIN_PUSH_NOT_CONFIGURED' || error?.status === 503) {
    return t('admin.pushNotif.notConfigured');
  }
  if (error?.status === 404) return t('admin.pushNotif.routeUnavailable');
  if (error?.status === 401) return t('admin.pushNotif.sessionExpired');
  if (error?.status === 403) return t('admin.pushNotif.forbidden');
  if (error?.status === 429) return t('admin.pushNotif.quotaExceeded');
  return t(fallbackKey);
}

function buildSegmentPayload({ segmentKind, pais, sedeId, deporte, selectedPlayer, isSuperAdmin, esAdminNacional, esAdminClub }) {
  if (segmentKind === 'jugador' && selectedPlayer?.userId) {
    return { type: 'jugador', userId: selectedPlayer.userId, email: selectedPlayer.email || undefined };
  }
  if (isSuperAdmin) {
    if (segmentKind === 'todos_usuarios') return { type: 'todos_usuarios' };
    if (segmentKind === 'pais') return { type: 'pais', pais };
    if (segmentKind === 'sede') return { type: 'sede', sedeId: Number(sedeId) };
    if (segmentKind === 'deporte') return { type: 'deporte', deporte };
  }
  if (esAdminNacional) {
    if (segmentKind === 'todos_pais') return { type: 'todos_pais' };
    if (segmentKind === 'sede') return { type: 'sede', sedeId: Number(sedeId) };
  }
  if (esAdminClub && segmentKind === 'sede_mia') return { type: 'sede_mia' };
  return null;
}

export default function AdminNotificacionesSection({
  apiBaseUrl,
  accessToken,
  isSuperAdmin = false,
  esAdminNacional = false,
  esAdminClub = false,
  sedeId = null,
  sedesOptions = [],
  paisesOptions = [],
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segmentKind, setSegmentKind] = useState(() => {
    if (isSuperAdmin) return 'todos_usuarios';
    if (esAdminNacional) return 'todos_pais';
    if (esAdminClub) return 'sede_mia';
    return 'jugador';
  });
  const [pais, setPais] = useState('');
  const [sedeSel, setSedeSel] = useState('');
  const [deporte, setDeporte] = useState('');
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerResults, setPlayerResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [quota, setQuota] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');

  const segmentPayload = useMemo(
    () =>
      buildSegmentPayload({
        segmentKind,
        pais,
        sedeId: sedeSel,
        deporte,
        selectedPlayer,
        isSuperAdmin,
        esAdminNacional,
        esAdminClub,
      }),
    [segmentKind, pais, sedeSel, deporte, selectedPlayer, isSuperAdmin, esAdminNacional, esAdminClub],
  );

  const segmentOptions = useMemo(() => {
    const opts = [];
    if (isSuperAdmin) {
      opts.push({ value: 'todos_usuarios', label: t('admin.pushNotif.segments.allUsers') });
      opts.push({ value: 'pais', label: t('admin.pushNotif.segments.byCountry') });
      opts.push({ value: 'sede', label: t('admin.pushNotif.segments.byVenue') });
      opts.push({ value: 'deporte', label: t('admin.pushNotif.segments.bySport') });
    } else if (esAdminNacional) {
      opts.push({ value: 'todos_pais', label: t('admin.pushNotif.segments.allCountry') });
      opts.push({ value: 'sede', label: t('admin.pushNotif.segments.byVenueCountry') });
    } else if (esAdminClub) {
      opts.push({ value: 'sede_mia', label: t('admin.pushNotif.segments.allVenue') });
    }
    opts.push({ value: 'jugador', label: t('admin.pushNotif.segments.onePlayer') });
    return opts;
  }, [isSuperAdmin, esAdminNacional, esAdminClub, t]);

  const loadMeta = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [q, h] = await Promise.all([
        fetchAdminPushQuota({ apiBaseUrl, accessToken }),
        fetchAdminPushHistory({ apiBaseUrl, accessToken }),
      ]);
      setQuota(q);
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) {
      setError(translatedPushError(e, t, 'admin.pushNotif.loadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, t]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!accessToken || !segmentPayload) {
      setPreviewCount(null);
      return undefined;
    }
    let cancelled = false;
    const tid = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const prev = await previewAdminPushSegment({ apiBaseUrl, accessToken, segment: segmentPayload });
        if (!cancelled) setPreviewCount(prev?.withPushToken ?? prev?.recipients ?? 0);
      } catch {
        if (!cancelled) setPreviewCount(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [accessToken, apiBaseUrl, segmentPayload]);

  useEffect(() => {
    if (segmentKind !== 'jugador' || playerQuery.trim().length < 2 || !accessToken) {
      setPlayerResults([]);
      return undefined;
    }
    let cancelled = false;
    const tid = window.setTimeout(async () => {
      try {
        const rows = await searchAdminPushPlayers({ apiBaseUrl, accessToken, q: playerQuery });
        if (!cancelled) setPlayerResults(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setPlayerResults([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [playerQuery, segmentKind, accessToken, apiBaseUrl]);

  const handleSend = async () => {
    if (!segmentPayload) return;
    setSending(true);
    setFeedback(null);
    setError('');
    try {
      const res = await sendAdminPushNotification({
        apiBaseUrl,
        accessToken,
        title: title.trim(),
        body: body.trim(),
        segment: segmentPayload,
      });
      setFeedback(t('admin.pushNotif.sentOk', { count: res.cantidad_enviadas ?? 0 }));
      setTitle('');
      setBody('');
      setSelectedPlayer(null);
      setPlayerQuery('');
      if (res.quota) setQuota(res.quota);
      const h = await fetchAdminPushHistory({ apiBaseUrl, accessToken });
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) {
      setError(translatedPushError(e, t, 'admin.pushNotif.sendError'));
      if (e.quota) setQuota((prev) => ({ ...(prev || {}), ...e.quota }));
    } finally {
      setSending(false);
    }
  };

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    segmentPayload &&
    (segmentKind !== 'jugador' || selectedPlayer?.userId) &&
    (segmentKind !== 'pais' || pais) &&
    (segmentKind !== 'sede' || sedeSel) &&
    (segmentKind !== 'deporte' || deporte) &&
    !sending;

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('admin.loading')}</p>;
  }

  return (
    <div className="admin-push-notif">
      {quota ? (
        <p className="admin-push-notif__quota" role="status">
          {t('admin.pushNotif.quotaRemaining', { count: quota.remaining ?? 0 })}
          {quota.unlimitedTargeted ? ` · ${t('admin.pushNotif.quotaTargetedHint')}` : null}
        </p>
      ) : null}

      {error ? (
        <p className="admin-push-notif__banner admin-push-notif__banner--err" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="admin-push-notif__banner admin-push-notif__banner--ok" role="status">
          {feedback}
        </p>
      ) : null}

      <div className="admin-push-notif__composer">
        <div className="admin-push-notif__field">
          <label htmlFor="admin-push-title">{t('admin.pushNotif.titleLabel')}</label>
          <input
            id="admin-push-title"
            type="text"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('admin.pushNotif.titlePlaceholder')}
          />
          <div className="admin-push-notif__counter">
            {title.length}/{TITLE_MAX}
          </div>
        </div>

        <div className="admin-push-notif__field">
          <label htmlFor="admin-push-body">{t('admin.pushNotif.bodyLabel')}</label>
          <textarea
            id="admin-push-body"
            maxLength={BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('admin.pushNotif.bodyPlaceholder')}
          />
          <div className="admin-push-notif__counter">
            {body.length}/{BODY_MAX}
          </div>
        </div>

        <div className="admin-push-notif__field">
          <label htmlFor="admin-push-segment">{t('admin.pushNotif.segmentLabel')}</label>
          <select
            id="admin-push-segment"
            value={segmentKind}
            onChange={(e) => {
              setSegmentKind(e.target.value);
              setSelectedPlayer(null);
            }}
          >
            {segmentOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {segmentKind === 'pais' ? (
          <div className="admin-push-notif__field">
            <label htmlFor="admin-push-pais">{t('admin.formularios.countryLabel')}</label>
            <select id="admin-push-pais" value={pais} onChange={(e) => setPais(e.target.value)}>
              <option value="">{t('admin.pushNotif.selectCountry')}</option>
              {paisesOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {segmentKind === 'sede' ? (
          <div className="admin-push-notif__field">
            <label htmlFor="admin-push-sede">{t('admin.pushNotif.venueLabel')}</label>
            <select id="admin-push-sede" value={sedeSel} onChange={(e) => setSedeSel(e.target.value)}>
              <option value="">{t('admin.pushNotif.selectVenue')}</option>
              {sedesOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre || `#${s.id}`}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {segmentKind === 'deporte' ? (
          <div className="admin-push-notif__field">
            <label htmlFor="admin-push-deporte">{t('admin.pushNotif.sportLabel')}</label>
            <select id="admin-push-deporte" value={deporte} onChange={(e) => setDeporte(e.target.value)}>
              <option value="">{t('admin.pushNotif.selectSport')}</option>
              {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {t(`torneos.deporte.${d.key}`, { defaultValue: d.label })}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {segmentKind === 'jugador' ? (
          <div className="admin-push-notif__field admin-push-notif__player-search">
            <label htmlFor="admin-push-player">{t('admin.pushNotif.playerSearchLabel')}</label>
            <input
              id="admin-push-player"
              type="search"
              value={playerQuery}
              onChange={(e) => {
                setPlayerQuery(e.target.value);
                setSelectedPlayer(null);
              }}
              placeholder={t('admin.pushNotif.playerSearchPlaceholder')}
              autoComplete="off"
            />
            {playerResults.length > 0 && !selectedPlayer ? (
              <ul className="admin-push-notif__player-results">
                {playerResults.map((p) => (
                  <li key={p.userId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlayer(p);
                        setPlayerResults([]);
                        setPlayerQuery(p.nombre || p.email);
                      }}
                    >
                      {p.nombre}
                      {p.email ? ` · ${p.email}` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedPlayer ? (
              <p className="admin-push-notif__selected-player">
                {t('admin.pushNotif.playerSelected', { name: selectedPlayer.nombre || selectedPlayer.email })}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="admin-push-notif__preview" role="status">
          {previewLoading
            ? t('admin.pushNotif.previewLoading')
            : t('admin.pushNotif.preview', { count: previewCount ?? '—' })}
        </p>

        <button type="button" className="admin-push-notif__send" disabled={!canSend} onClick={() => void handleSend()}>
          {sending ? t('admin.pushNotif.sending') : t('admin.pushNotif.send')}
        </button>
      </div>

      <div className="admin-push-notif__history">
        <h3>{t('admin.pushNotif.historyTitle')}</h3>
        {history.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>{t('admin.pushNotif.historyEmpty')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-push-notif__table">
              <thead>
                <tr>
                  <th>{t('admin.pushNotif.colDate')}</th>
                  <th>{t('admin.pushNotif.colTitle')}</th>
                  <th>{t('admin.pushNotif.colSegment')}</th>
                  <th>{t('admin.pushNotif.colSent')}</th>
                  <th>{t('admin.pushNotif.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>{row.titulo}</td>
                    <td>{formatAdminPushSegmentLabel(row.segmento, t)}</td>
                    <td>{row.cantidad_enviadas ?? 0}</td>
                    <td>
                      {row.estado === 'sent'
                        ? t('admin.pushNotif.statusSent')
                        : row.estado === 'failed'
                          ? t('admin.pushNotif.statusFailed')
                          : row.estado || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
