import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { fetchAdminListaEsperaGeneral } from '../utils/listaEsperaAdminApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import './AdminSedeListaEsperaTorneosSection.css';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k || '—';
}

function formatFechaAnotacion(iso, locale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSedeListaEsperaTorneosSection({ apiBaseUrl, accessToken, sedeId }) {
  const { t, i18n } = useTranslation();
  const sid = useMemo(() => parseInt(String(sedeId), 10), [sedeId]);
  const dateLocale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';

  const [items, setItems] = useState([]);
  const [conteos, setConteos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroDeporte, setFiltroDeporte] = useState('');

  const loadRows = useCallback(async () => {
    if (!Number.isFinite(sid) || !accessToken) {
      setItems([]);
      setConteos({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminListaEsperaGeneral({ sedeId: sid, accessToken, apiBaseUrl });
      setItems(Array.isArray(data.items) ? data.items : []);
      setConteos(data.conteos_por_deporte && typeof data.conteos_por_deporte === 'object' ? data.conteos_por_deporte : {});
    } catch (e) {
      setError(e.message || t('admin.sedes.listaEsperaLoadError'));
      setItems([]);
      setConteos({});
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, sid, t]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const conteosLine = useMemo(() => {
    return DEPORTES_CANCHA_SEDE_OPTIONS.filter((d) => Number(conteos[d.key] || 0) > 0).map((d) =>
      t('admin.sedes.listaEsperaCountDeporte', {
        count: Number(conteos[d.key] || 0),
        deporte: d.label,
      }),
    );
  }, [conteos, t]);

  const itemsFiltrados = useMemo(() => {
    const dep = String(filtroDeporte || '').trim().toLowerCase();
    if (!dep) return items;
    return items.filter((row) => String(row.deporte || '').trim().toLowerCase() === dep);
  }, [items, filtroDeporte]);

  return (
    <div className="admin-sede-lista-espera">
      <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5 }}>
        {t('admin.sedes.listaEsperaIntro')}
      </p>

      {conteosLine.length > 0 ? (
        <p className="admin-sede-lista-espera__conteos" role="status">
          {conteosLine.join(' · ')}
        </p>
      ) : null}

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

      {loading ? (
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
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.map((row) => (
                <tr key={row.id}>
                  <td>{row.nombre || '—'}</td>
                  <td>{row.apodo || '—'}</td>
                  <td>{row.deporte ? labelDeporte(row.deporte) : '—'}</td>
                  <td>{formatFechaAnotacion(row.created_at, dateLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
