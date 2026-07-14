import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeTranslation } from '../i18n/tSafe';
import { pathJugadorPerfilPublico } from '../utils/jugadorPerfilPublicoUrl';
import {
  fetchAdminJugadoresList,
  formatJugadorActivity,
  formatJugadorUsername,
  formatJugadorVinculacionLabel,
  searchAdminJugadores,
} from '../utils/adminJugadoresApi';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  boxSizing: 'border-box',
};

/**
 * Hybrid player typeahead for manual booking (MEJ-05).
 * Selecting fills nombre/email/telefono; clearing restores guest mode.
 */
export function AdminJugadorSearchInput({
  apiBaseUrl,
  accessToken,
  sedeId,
  valueNombre,
  selectedPlayer,
  onSelectPlayer,
  onClearPlayer,
  onNombreChange,
  disabled = false,
  inputStyle: inputStyleProp,
}) {
  const { t } = useSafeTranslation();
  const [q, setQ] = useState(valueNombre || '');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (selectedPlayer) {
      setQ(selectedPlayer.display_name || selectedPlayer.nombre || '');
    }
  }, [selectedPlayer]);

  useEffect(() => {
    if (selectedPlayer) return;
    setQ(valueNombre || '');
  }, [valueNombre, selectedPlayer]);

  useEffect(() => {
    const onDoc = (ev) => {
      if (!wrapRef.current?.contains(ev.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const runSearch = useCallback(
    async (term) => {
      const cleaned = String(term || '').trim().replace(/^@+/, '');
      if (cleaned.length < 2 || !accessToken) {
        setItems([]);
        setLoading(false);
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const rows = await searchAdminJugadores({
          apiBaseUrl,
          accessToken,
          q: cleaned,
          sedeId,
          limit: 10,
        });
        setItems(rows);
        setOpen(true);
      } catch (err) {
        setItems([]);
        setError(err.message || t('admin.jugadores.searchError'));
      } finally {
        setLoading(false);
      }
    },
    [accessToken, apiBaseUrl, sedeId, t],
  );

  const handleChange = (e) => {
    const next = e.target.value;
    setQ(next);
    if (selectedPlayer) onClearPlayer?.();
    onNombreChange?.(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(next), 320);
  };

  const pick = (row) => {
    onSelectPlayer?.(row);
    setQ(row.display_name || [row.nombre, row.apellido].filter(Boolean).join(' '));
    setOpen(false);
    setItems([]);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'grid', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={q}
          onChange={handleChange}
          onFocus={() => { if (items.length) setOpen(true); }}
          disabled={disabled}
          placeholder={t('admin.jugadores.searchPlaceholder')}
          autoComplete="off"
          style={{ ...(inputStyleProp || inputStyle), flex: '1 1 220px' }}
          aria-label={t('admin.jugadores.searchPlaceholder')}
        />
        {selectedPlayer ? (
          <button
            type="button"
            onClick={() => {
              onClearPlayer?.();
              setQ('');
              onNombreChange?.('');
              setItems([]);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {t('admin.jugadores.clearSelection')}
          </button>
        ) : null}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {selectedPlayer
          ? t('admin.jugadores.modeRegistered')
          : t('admin.jugadores.modeGuestHint')}
      </div>

      {error ? (
        <div role="alert" style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>{error}</div>
      ) : null}

      {open && !selectedPlayer ? (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 40,
            marginTop: 4,
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
          }}
        >
          {loading ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('admin.common.loadingEllipsis')}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('admin.jugadores.noResults')}
            </div>
          ) : (
            items.map((row) => (
              <button
                key={row.user_id || row.email}
                type="button"
                role="option"
                onClick={() => pick(row)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13 }}>{row.display_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {[formatJugadorUsername(row.username), row.email, row.telefono]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminJugadoresSection({
  apiBaseUrl,
  accessToken,
  sedeId: sedeIdProp,
  sedesMap = {},
  isSuperAdmin = false,
  esAdminClub = false,
}) {
  const { t } = useSafeTranslation();
  const sedesList = Object.values(sedesMap || {}).sort((a, b) =>
    String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' }),
  );

  const [sedeId, setSedeId] = useState(() => {
    if (sedeIdProp != null && sedeIdProp !== '') return String(sedeIdProp);
    if (isSuperAdmin && sedesList[0]?.id != null) return String(sedesList[0].id);
    return '';
  });
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ items: [], total: 0, total_pages: 1 });
  const [ficha, setFicha] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (sedeIdProp != null && sedeIdProp !== '' && esAdminClub) {
      setSedeId(String(sedeIdProp));
    }
  }, [sedeIdProp, esAdminClub]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [q]);

  const load = useCallback(async () => {
    if (!accessToken) {
      setError(t('admin.formularios.loginAgainAgain'));
      return;
    }
    if (!sedeId) {
      setData({ items: [], total: 0, total_pages: 1 });
      setError(isSuperAdmin ? t('admin.jugadores.selectSede') : '');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const json = await fetchAdminJugadoresList({
        apiBaseUrl,
        accessToken,
        sedeId,
        q: qDebounced,
        page,
        limit: 20,
      });
      setData({
        items: Array.isArray(json.items) ? json.items : [],
        total: Number(json.total) || 0,
        total_pages: Number(json.total_pages) || 1,
      });
    } catch (err) {
      setData({ items: [], total: 0, total_pages: 1 });
      if (err.status === 403) setError(t('admin.jugadores.forbidden'));
      else setError(err.message || t('admin.jugadores.loadError'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, isSuperAdmin, page, qDebounced, sedeId, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="section">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>{t('admin.tabs.jugadores')}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 520 }}>
            {t('admin.jugadores.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: '9px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {t('admin.jugadores.refresh')}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {isSuperAdmin ? (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 800 }}>
            {t('admin.jugadores.sedeLabel')}
            <select
              value={sedeId}
              onChange={(e) => { setSedeId(e.target.value); setPage(1); }}
              style={inputStyle}
            >
              <option value="">{t('admin.jugadores.selectSede')}</option>
              {sedesList.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.nombre}</option>
              ))}
            </select>
          </label>
        ) : null}

        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 800 }}>
          {t('admin.jugadores.filterLabel')}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.jugadores.searchPlaceholder')}
            style={inputStyle}
            autoComplete="off"
          />
        </label>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0 }}>
        {t('admin.jugadores.vinculacionNote')}
      </p>

      {error ? (
        <div role="alert" style={{ color: '#b91c1c', fontWeight: 700, marginBottom: 12 }}>{error}</div>
      ) : null}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
      ) : data.items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>{t('admin.jugadores.empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="reservas-table">
            <thead>
              <tr>
                <th>{t('admin.reservas.player')}</th>
                <th>@</th>
                <th>{t('admin.formularios.emailLabel')}</th>
                <th>{t('admin.jugadores.phoneCol')}</th>
                <th>{t('admin.jugadores.vinculacionCol')}</th>
                <th>{t('admin.jugadores.activityCol')}</th>
                <th>{t('admin.metricas.profileCol')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((j) => {
                const perfilPath = pathJugadorPerfilPublico({
                  alias: j.username,
                  user_id: j.user_id,
                });
                return (
                  <tr key={j.user_id || j.email}>
                    <td style={{ fontWeight: 700 }}>
                      <button
                        type="button"
                        onClick={() => setFicha(j)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--accent)',
                          fontWeight: 800,
                          cursor: 'pointer',
                          padding: 0,
                          textAlign: 'left',
                        }}
                      >
                        {j.display_name}
                      </button>
                    </td>
                    <td style={{ fontSize: 13 }}>{formatJugadorUsername(j.username) || '—'}</td>
                    <td style={{ fontSize: 13 }}>{j.email || '—'}</td>
                    <td style={{ fontSize: 13 }}>{j.telefono || '—'}</td>
                    <td style={{ fontSize: 12 }}>{formatJugadorVinculacionLabel(j.vinculacion, t)}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatJugadorActivity(j.last_activity_at) || '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {perfilPath ? (
                        <a href={perfilPath} target="_blank" rel="noopener noreferrer" style={{ color: '#E11B22', fontWeight: 700 }}>
                          {t('admin.jugadores.viewProfile')}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.total_pages > 1 ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            ←
          </button>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {t('admin.jugadores.pageOf', { page, total: data.total_pages, count: data.total })}
          </span>
          <button
            type="button"
            disabled={page >= data.total_pages || loading}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            →
          </button>
        </div>
      ) : null}

      {ficha ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 18000,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(ev) => { if (ev.target === ev.currentTarget) setFicha(null); }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              borderRadius: 14,
              padding: 18,
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>{t('admin.jugadores.fichaTitle')}</h3>
            <dl style={{ display: 'grid', gap: 8, margin: '0 0 14px', fontSize: 14 }}>
              <div><dt style={{ fontWeight: 800 }}>{t('admin.reservas.player')}</dt><dd style={{ margin: 0 }}>{ficha.display_name}</dd></div>
              <div><dt style={{ fontWeight: 800 }}>@</dt><dd style={{ margin: 0 }}>{formatJugadorUsername(ficha.username) || '—'}</dd></div>
              <div><dt style={{ fontWeight: 800 }}>{t('admin.formularios.emailLabel')}</dt><dd style={{ margin: 0 }}>{ficha.email || '—'}</dd></div>
              <div><dt style={{ fontWeight: 800 }}>{t('admin.jugadores.phoneCol')}</dt><dd style={{ margin: 0 }}>{ficha.telefono || '—'}</dd></div>
              <div><dt style={{ fontWeight: 800 }}>{t('admin.jugadores.vinculacionCol')}</dt><dd style={{ margin: 0 }}>{formatJugadorVinculacionLabel(ficha.vinculacion, t)}</dd></div>
            </dl>
            <button
              type="button"
              onClick={() => setFicha(null)}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {t('general.close')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
