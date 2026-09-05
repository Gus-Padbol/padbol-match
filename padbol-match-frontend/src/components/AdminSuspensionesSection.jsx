import { useCallback, useEffect, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { padbolLangToIntlLocale } from '../utils/padbolLang';
import {
  fetchAdminSuspensiones,
  formatFechaReputacion,
  levantarSuspensionAdmin,
} from '../utils/jugadorReputacionApi';
import './ReputacionJugadorPanel.css';

export default function AdminSuspensionesSection({ apiBaseUrl, accessToken }) {
  const { t, i18n } = useTranslation();
  const locale = padbolLangToIntlLocale(i18n.language);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liftingId, setLiftingId] = useState(null);

  const loadRows = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminSuspensiones({ apiBaseUrl, accessToken });
      setRows(data);
    } catch (e) {
      setError(e.message || t('reputacion.admin.loadError'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, t]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const handleLevantar = async (userId) => {
    setLiftingId(userId);
    try {
      await levantarSuspensionAdmin({ apiBaseUrl, accessToken, userId });
      await loadRows();
    } catch (e) {
      setError(e.message || t('reputacion.admin.liftError'));
    } finally {
      setLiftingId(null);
    }
  };

  return (
    <div className="admin-suspensiones">
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {t('reputacion.admin.intro')}
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('reputacion.admin.loading')}</p>
      ) : error ? (
        <p className="reputacion-panel__banner reputacion-panel__banner--danger" role="alert">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('reputacion.admin.empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-suspensiones__table">
            <thead>
              <tr>
                <th>{t('reputacion.admin.colName')}</th>
                <th>{t('reputacion.admin.colEmail')}</th>
                <th>{t('reputacion.admin.colUntil')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.nombre || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{row.email || '—'}</td>
                  <td style={{ color: 'var(--text-primary)' }}>
                    {formatFechaReputacion(row.suspendido_hasta, locale)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-suspensiones__btn"
                      disabled={liftingId === row.user_id}
                      onClick={() => handleLevantar(row.user_id)}
                    >
                      {liftingId === row.user_id
                        ? t('reputacion.admin.lifting')
                        : t('reputacion.admin.lift')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
