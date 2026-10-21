import { formatAdminDate } from '../utils/adminDateFormat';
import { useEffect, useMemo, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { fetchAdminListaEsperaGeneral } from '../utils/listaEsperaAdminApi';
import { useSafeTranslation as useTranslation } from '../i18n/adminTranslation';
import { padbolLangToIntlLocale } from '../utils/padbolLang';
import './AdminSedeListaEsperaTorneosSection.css';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k || '—';
}

function formatFechaAnotacion(iso, locale) {
  return formatAdminDate(iso, { locale, withTime: true });
}

export default function AdminSedeListaEsperaTorneosSection({ apiBaseUrl, accessToken, sedeId }) {
  const { t, i18n } = useTranslation();
  const sid = useMemo(() => parseInt(String(sedeId), 10), [sedeId]);
  const dateLocale = padbolLangToIntlLocale(i18n.language);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resultKey, setResultKey] = useState(null);
  const [filtroDeporte, setFiltroDeporte] = useState('');
  const requestKey = `${sid}:${accessToken || ''}:${apiBaseUrl || ''}`;

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setItems([]);
    setError('');
    setFiltroDeporte('');
    if (!Number.isFinite(sid) || !accessToken) {
      setLoading(false);
      setError(t('admin.sedes.listaEsperaLoadError'));
      setResultKey(requestKey);
      return () => { current = false; controller.abort(); };
    }
    setLoading(true);
    (async () => {
      try {
        const data = await fetchAdminListaEsperaGeneral({ sedeId: sid, accessToken, apiBaseUrl, signal: controller.signal });
        if (current) { setItems(data.items); setResultKey(requestKey); }
      } catch (e) {
        if (current) { setError(e.message || t('admin.sedes.listaEsperaLoadError')); setResultKey(requestKey); }
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; controller.abort(); };
  }, [accessToken, apiBaseUrl, sid, requestKey, t]);

  const itemsFiltrados = useMemo(() => {
    const dep = String(filtroDeporte || '').trim().toLowerCase();
    const currentItems = resultKey === requestKey ? items : [];
    if (!dep) return currentItems;
    return currentItems.filter((row) => String(row.deporte || '').trim().toLowerCase() === dep);
  }, [items, filtroDeporte, resultKey, requestKey]);

  return (
    <div className="admin-sede-lista-espera">
      <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5 }}>
        {t('admin.sedes.listaEsperaIntro')}
      </p>

      <div className="admin-sede-lista-espera__filters">
        <label className="admin-sede-lista-espera__filter-label" htmlFor="admin-lista-espera-deporte">
          {t('admin.sedes.listaEsperaFilterDeporte')}
        </label>
        <select
          id="admin-lista-espera-deporte"
          className="admin-mi-sede-theme-input admin-sede-lista-espera__filter-select"
          value={filtroDeporte}
          onChange={(e) => setFiltroDeporte(e.target.value)}
        >
          <option value="">{t('admin.sponsors.allSports')}</option>
          {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {loading || resultKey !== requestKey ? (
        <p className="admin-mi-sede-theme-muted">{t('admin.common.loadingEllipsis')}</p>
      ) : error ? (
        <p className="admin-sede-lista-espera__error" role="alert">
          {error}
        </p>
      ) : itemsFiltrados.length === 0 ? (
        <p className="admin-mi-sede-theme-muted">{t('admin.sedes.listaEsperaEmpty')}</p>
      ) : (
        <div className="admin-sede-lista-espera__table-wrap">
          <table className="reservas-table admin-sede-lista-espera__table">
            <thead>
              <tr>
                <th>{t('admin.formularios.name')}</th>
                <th>{t('admin.sedes.listaEsperaColApodo')}</th>
                <th>{t('admin.metricas.sportLabel')}</th>
                <th>{t('admin.sedes.listaEsperaColFecha')}</th>
                <th>{t('admin.sedes.waitlistSource', { defaultValue: 'Origen del interés' })}</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.map((row) => (
                <tr key={`${row.waitlistSource}-${row.id}`}>
                  <td>{row.nombre || '—'}</td>
                  <td>{row.apodo || '—'}</td>
                  <td>{row.deporte ? labelDeporte(row.deporte) : '—'}</td>
                  <td>{formatFechaAnotacion(row.created_at, dateLocale)}</td>
                  <td>{row.waitlistSource === 'venue' ? t('admin.sedes.waitlistVenue', { defaultValue: 'Ficha de sede' }) : t('admin.sedes.waitlistSport', { defaultValue: 'Lista por deporte' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
