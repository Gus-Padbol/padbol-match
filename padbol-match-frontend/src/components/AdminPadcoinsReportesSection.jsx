import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import {
  downloadPadcoinsReporteCsv,
  fetchPadcoinsReportesCanjes,
  fetchPadcoinsReportesJugadores,
  fetchPadcoinsReportesMovimientos,
  fetchPadcoinsReportesResumen,
  formatPadcoinsNumber,
  formatPadcoinsReporteFecha,
  PADCOINS_LOYALTY_LEVEL_OPTIONS,
  PADCOINS_REPORTES_CANJE_ESTADOS,
  PADCOINS_REPORTES_MOV_TIPOS,
  PADCOINS_REPORTES_PAGE_SIZE,
} from '../utils/padcoinsReportesApi';

const SUBTABS = [
  { id: 'resumen', labelKey: 'reportsTabResumen', fallback: 'Resumen' },
  { id: 'movimientos', labelKey: 'reportsTabMovimientos', fallback: 'Movimientos' },
  { id: 'canjes', labelKey: 'reportsTabCanjes', fallback: 'Canjes' },
  { id: 'jugadores', labelKey: 'reportsTabJugadores', fallback: 'Jugadores' },
];

function emptyFilters(clubSedeId) {
  return {
    sede_id: clubSedeId ? String(clubSedeId) : '',
    fecha_desde: '',
    fecha_hasta: '',
    tipo: '',
    campana_id: '',
    estado: '',
    beneficio_id: '',
    nivel: '',
    search: '',
  };
}

function StatCard({ label, value, hint }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', WebkitTextFillColor: '#f8fafc', lineHeight: 1.2 }}>
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>{hint}</div>
      ) : null}
    </div>
  );
}

function ReportTable({ children }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid var(--border)', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 13 }}>
        {children}
      </table>
    </div>
  );
}

function thStyle(extra = {}) {
  return {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 12,
    color: 'var(--bg-card)',
    background: 'var(--accent)',
    whiteSpace: 'nowrap',
    ...extra,
  };
}

function tdStyle(extra = {}) {
  return {
    padding: '9px 12px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
    verticalAlign: 'top',
    ...extra,
  };
}

/**
 * Reportes PadCoins (Backend /api/admin/padcoins-reportes/*).
 * Solo Super Admin y Admin Club; no altera campañas/beneficios/canjes operativos.
 */
export default function AdminPadcoinsReportesSection({
  apiBaseUrl,
  accessToken,
  isSuperAdmin = false,
  esAdminClub = false,
  clubSedeId = '',
  sedesOptions = [],
  campaigns = [],
  premios = [],
  sedeFlag = () => '',
}) {
  const { t } = useTranslation();
  const tr = useCallback(
    (key, fallback, params) => {
      const raw = t(`admin.padcoins.${key}`, fallback, params || undefined);
      if (!params) return raw;
      return String(raw).replace(/\{\{(\w+)\}\}/g, (_, name) => (
        params[name] != null ? String(params[name]) : ''
      ));
    },
    [t],
  );

  const canUse = isSuperAdmin || esAdminClub;
  const fixedSedeId = esAdminClub ? String(clubSedeId || '') : '';

  const [subTab, setSubTab] = useState('resumen');
  const [filters, setFilters] = useState(() => emptyFilters(fixedSedeId));
  const [applied, setApplied] = useState(() => emptyFilters(fixedSedeId));
  const [page, setPage] = useState(0);

  const [resumen, setResumen] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [canjes, setCanjes] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [total, setTotal] = useState(0);
  const [localSearchNote, setLocalSearchNote] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportOk, setExportOk] = useState('');

  const inp = useMemo(() => ({
    padding: '9px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-input, var(--bg-card))',
    color: 'var(--text-primary)',
  }), []);

  useEffect(() => {
    if (!esAdminClub) return;
    const sid = String(clubSedeId || '');
    setFilters((p) => ({ ...p, sede_id: sid }));
    setApplied((p) => ({ ...p, sede_id: sid }));
  }, [esAdminClub, clubSedeId]);

  const effectiveFilters = useMemo(() => {
    const base = { ...applied };
    if (esAdminClub && fixedSedeId) base.sede_id = fixedSedeId;
    return base;
  }, [applied, esAdminClub, fixedSedeId]);

  const loadData = useCallback(async () => {
    if (!canUse || !accessToken) return;
    if (esAdminClub && !fixedSedeId) {
      setError(tr('reportsClubNoVenue', 'No hay sede asignada para consultar reportes.'));
      return;
    }
    setLoading(true);
    setError('');
    setLocalSearchNote(false);
    try {
      const common = { apiBaseUrl, accessToken, filters: effectiveFilters };
      if (subTab === 'resumen') {
        const data = await fetchPadcoinsReportesResumen(common);
        setResumen(data.resumen || null);
        setTotal(0);
      } else if (subTab === 'movimientos') {
        const data = await fetchPadcoinsReportesMovimientos({ ...common, page });
        setMovimientos(data.movimientos);
        setTotal(data.total);
      } else if (subTab === 'canjes') {
        const data = await fetchPadcoinsReportesCanjes({ ...common, page });
        setCanjes(data.canjes);
        setTotal(data.total);
      } else if (subTab === 'jugadores') {
        const data = await fetchPadcoinsReportesJugadores({ ...common, page });
        setJugadores(data.jugadores);
        setTotal(data.total);
        setLocalSearchNote(Boolean(data.searchFilteredLocal));
      }
    } catch (err) {
      setError(err?.message || String(err));
      setResumen(null);
      setMovimientos([]);
      setCanjes([]);
      setJugadores([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    apiBaseUrl,
    canUse,
    effectiveFilters,
    esAdminClub,
    fixedSedeId,
    page,
    subTab,
    tr,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const applyFilters = () => {
    setPage(0);
    setApplied({ ...filters, sede_id: esAdminClub ? fixedSedeId : filters.sede_id });
  };

  const clearFilters = () => {
    const next = emptyFilters(fixedSedeId);
    setFilters(next);
    setApplied(next);
    setPage(0);
  };

  const onExport = async (kind) => {
    setExportError('');
    setExportOk('');
    setExportBusy(kind);
    try {
      const result = await downloadPadcoinsReporteCsv({
        apiBaseUrl,
        accessToken,
        kind,
        filters: effectiveFilters,
      });
      setExportOk(tr('reportsExportOk', 'Descarga iniciada: {{file}}', { file: result.filename }));
    } catch (err) {
      setExportError(err?.message || String(err));
    } finally {
      setExportBusy('');
    }
  };

  if (!canUse) return null;

  const pageSize = PADCOINS_REPORTES_PAGE_SIZE;
  const pageStart = total === 0 ? 0 : page * pageSize + 1;
  const pageEnd = Math.min((page + 1) * pageSize, total);
  const hasPrev = page > 0;
  const hasNext = (page + 1) * pageSize < total;

  const r = resumen || {};
  const canjesEstado = r.canjes_por_estado || {};

  return (
    <div
      style={{
        marginBottom: 32,
        paddingBottom: 28,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--text-primary)' }}>
          {tr('reportsTitle', 'Reportes PadCoins')}
        </h2>
        <p style={{ margin: 0, maxWidth: 720, fontSize: 14, color: 'var(--text-muted)' }}>
          {esAdminClub
            ? tr('reportsIntroClub', 'Resumen y exportaciones de la actividad PadCoins de tu sede.')
            : tr('reportsIntroSuper', 'Resumen global o por sede, con exportaciones CSV autenticadas.')}
        </p>
      </div>

      <div
        role="tablist"
        aria-label={tr('reportsTitle', 'Reportes PadCoins')}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
      >
        {SUBTABS.map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSubTab(tab.id);
                setPage(0);
                setError('');
                setExportError('');
                setExportOk('');
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'var(--bg-card)',
                color: active ? '#fff' : 'var(--text-primary)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tr(tab.labelKey, tab.fallback)}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 12,
          marginBottom: 16,
          padding: 16,
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--bg-card)',
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            gap: 10,
          }}
        >
          {isSuperAdmin ? (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                {tr('reportsFilterSede', 'Sede')}
              </span>
              <select
                value={filters.sede_id}
                onChange={(e) => setFilters((p) => ({ ...p, sede_id: e.target.value }))}
                style={inp}
              >
                <option value="">{tr('reportsAllSedes', 'Todas las sedes')}</option>
                {sedesOptions.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {sedeFlag(s)} {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'end' }}>
              {tr('reportsClubSedeFixed', 'Sede')}:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {sedesOptions.find((s) => String(s.id) === String(fixedSedeId))?.nombre
                  || (fixedSedeId ? `Sede ${fixedSedeId}` : '—')}
              </strong>
            </div>
          )}

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
              {tr('reportsFrom', 'Desde')}
            </span>
            <input
              type="date"
              value={filters.fecha_desde}
              onChange={(e) => setFilters((p) => ({ ...p, fecha_desde: e.target.value }))}
              style={inp}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
              {tr('reportsTo', 'Hasta')}
            </span>
            <input
              type="date"
              value={filters.fecha_hasta}
              onChange={(e) => setFilters((p) => ({ ...p, fecha_hasta: e.target.value }))}
              style={inp}
            />
          </label>

          {subTab === 'movimientos' ? (
            <>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tr('reportsFilterTipo', 'Tipo')}
                </span>
                <select
                  value={filters.tipo}
                  onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}
                  style={inp}
                >
                  {PADCOINS_REPORTES_MOV_TIPOS.map((o) => (
                    <option key={o.id || 'all'} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tr('reportsFilterCampana', 'Campaña')}
                </span>
                <select
                  value={filters.campana_id}
                  onChange={(e) => setFilters((p) => ({ ...p, campana_id: e.target.value }))}
                  style={inp}
                >
                  <option value="">{tr('reportsAllCampanas', 'Todas')}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.nombre || c.id}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {subTab === 'canjes' ? (
            <>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tr('reportsFilterEstado', 'Estado')}
                </span>
                <select
                  value={filters.estado}
                  onChange={(e) => setFilters((p) => ({ ...p, estado: e.target.value }))}
                  style={inp}
                >
                  {PADCOINS_REPORTES_CANJE_ESTADOS.map((o) => (
                    <option key={o.id || 'all'} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tr('reportsFilterBeneficio', 'Beneficio')}
                </span>
                <select
                  value={filters.beneficio_id}
                  onChange={(e) => setFilters((p) => ({ ...p, beneficio_id: e.target.value }))}
                  style={inp}
                >
                  <option value="">{tr('reportsAllBeneficios', 'Todos')}</option>
                  {premios.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre || p.id}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {subTab === 'jugadores' ? (
            <>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tr('reportsFilterNivel', 'Nivel')}
                </span>
                <select
                  value={filters.nivel}
                  onChange={(e) => setFilters((p) => ({ ...p, nivel: e.target.value }))}
                  style={inp}
                >
                  {PADCOINS_LOYALTY_LEVEL_OPTIONS.map((o) => (
                    <option key={o.id || 'all'} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tr('reportsFilterSearch', 'Jugador')}
                </span>
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                  placeholder={tr('reportsSearchPh', 'Nombre, email o UUID')}
                  style={inp}
                />
              </label>
            </>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={applyFilters}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {tr('reportsApply', 'Aplicar filtros')}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {tr('reportsClear', 'Limpiar')}
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {tr('reportsRefresh', 'Actualizar')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {[
          { kind: 'movimientos', label: tr('reportsExportMovimientos', 'Exportar movimientos') },
          { kind: 'canjes', label: tr('reportsExportCanjes', 'Exportar canjes') },
          { kind: 'jugadores', label: tr('reportsExportJugadores', 'Exportar jugadores') },
        ].map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            disabled={Boolean(exportBusy) || !accessToken || (esAdminClub && !fixedSedeId)}
            onClick={() => void onExport(kind)}
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: exportBusy === kind ? '#94a3b8' : 'var(--bg-page)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: exportBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {exportBusy === kind ? tr('reportsExporting', 'Exportando…') : label}
          </button>
        ))}
      </div>

      {exportError ? (
        <p style={{ color: '#b91c1c', fontWeight: 700, fontSize: 13, margin: '0 0 12px' }} role="alert">
          {exportError}
        </p>
      ) : null}
      {exportOk ? (
        <p style={{ color: '#166534', fontWeight: 600, fontSize: 13, margin: '0 0 12px' }}>{exportOk}</p>
      ) : null}
      {localSearchNote ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 12px' }}>
          {tr(
            'reportsSearchLocalHint',
            'La búsqueda por texto filtra la página actual. Usá UUID para filtrar en el servidor.',
          )}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{tr('reportsLoading', 'Cargando reporte…')}</p>
      ) : null}
      {!loading && error ? (
        <p style={{ color: '#b91c1c', fontWeight: 700, fontSize: 14 }} role="alert">{error}</p>
      ) : null}

      {!loading && !error && subTab === 'resumen' && resumen ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
              gap: 10,
              marginBottom: 18,
            }}
          >
            <StatCard label={tr('reportsEmitted', 'Emitidos')} value={formatPadcoinsNumber(r.padcoins_emitidos)} />
            <StatCard label={tr('reportsAvailable', 'Disponibles')} value={formatPadcoinsNumber(r.padcoins_disponibles)} />
            <StatCard label={tr('reportsRedeemed', 'Canjeados')} value={formatPadcoinsNumber(r.padcoins_canjeados)} />
            <StatCard label={tr('reportsReversed', 'Revertidos')} value={formatPadcoinsNumber(r.padcoins_revertidos)} />
            <StatCard label={tr('reportsPlayersBalance', 'Jugadores con saldo')} value={formatPadcoinsNumber(r.jugadores_con_saldo)} />
            <StatCard label={tr('reportsMovementsCount', 'Movimientos')} value={formatPadcoinsNumber(r.cantidad_movimientos)} />
            <StatCard label={tr('reportsAvgRedeem', 'Valor promedio canje')} value={formatPadcoinsNumber(r.valor_promedio_canje)} />
          </div>

          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('reportsRedeemByStatus', 'Canjes por estado')}</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8,
              marginBottom: 18,
            }}
          >
            {['pendiente', 'aprobado', 'entregado', 'cancelado', 'vencido'].map((est) => (
              <StatCard
                key={est}
                label={est}
                value={formatPadcoinsNumber(canjesEstado[est] || 0)}
              />
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: 14,
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('reportsTopBenefits', 'Beneficios más canjeados')}</h3>
              {(r.beneficios_mas_canjeados || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tr('reportsEmpty', 'Sin datos')}</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-primary)' }}>
                  {(r.beneficios_mas_canjeados || []).map((b) => (
                    <li key={b.premio_id || b.nombre}>
                      {b.nombre || b.premio_id}: <strong>{formatPadcoinsNumber(b.cantidad)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('reportsTopCampaigns', 'Campañas con mayor generación')}</h3>
              {(r.campanas_mayor_generacion || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tr('reportsEmpty', 'Sin datos')}</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-primary)' }}>
                  {(r.campanas_mayor_generacion || []).map((c) => (
                    <li key={c.campana_id}>
                      {c.nombre || c.campana_id}: <strong>{formatPadcoinsNumber(c.padcoins_emitidos)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('reportsLevels', 'Distribución por nivel')}</h3>
              {(r.distribucion_niveles || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tr('reportsEmpty', 'Sin datos')}</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-primary)' }}>
                  {(r.distribucion_niveles || []).map((n) => (
                    <li key={n.slug}>
                      {n.nombre || n.slug}: <strong>{formatPadcoinsNumber(n.cantidad_jugadores)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}

      {!loading && !error && subTab === 'movimientos' ? (
        movimientos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{tr('reportsEmptyMovimientos', 'Sin movimientos para estos filtros.')}</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              {tr('reportsShowing', 'Mostrando {{from}}–{{to}} de {{total}}', {
                from: pageStart,
                to: pageEnd,
                total,
              })}
            </p>
            <ReportTable>
              <thead>
                <tr>
                  <th style={thStyle()}>{tr('reportsColFecha', 'Fecha')}</th>
                  <th style={thStyle()}>{tr('reportsColJugador', 'Jugador')}</th>
                  {!esAdminClub ? <th style={thStyle()}>{tr('reportsColSede', 'Sede')}</th> : null}
                  <th style={thStyle()}>{tr('reportsColTipo', 'Tipo')}</th>
                  <th style={thStyle()}>{tr('reportsColCantidad', 'Cantidad')}</th>
                  <th style={thStyle()}>{tr('reportsColSaldo', 'Saldo post.')}</th>
                  <th style={thStyle()}>{tr('reportsColOrigen', 'Origen')}</th>
                  <th style={thStyle()}>{tr('reportsColCampana', 'Campaña')}</th>
                  <th style={thStyle()}>{tr('reportsColRef', 'Referencia')}</th>
                  <th style={thStyle()}>{tr('reportsColDesc', 'Descripción')}</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatPadcoinsReporteFecha(row.fecha)}</td>
                    <td style={tdStyle()}>
                      <div>{row.jugador_nombre || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.jugador_email || row.user_id}</div>
                    </td>
                    {!esAdminClub ? <td style={tdStyle()}>{row.sede_nombre || row.sede_id || '—'}</td> : null}
                    <td style={tdStyle()}>{row.tipo || '—'}</td>
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.cantidad)}</td>
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.saldo_posterior)}</td>
                    <td style={tdStyle()}>{row.origen || '—'}</td>
                    <td style={tdStyle()}>{row.campana_nombre || row.campana_id || '—'}</td>
                    <td style={tdStyle()}>
                      {[row.referencia_tipo, row.referencia_id].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={tdStyle({ maxWidth: 220 })}>{row.descripcion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </>
        )
      ) : null}

      {!loading && !error && subTab === 'canjes' ? (
        canjes.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{tr('reportsEmptyCanjes', 'Sin canjes para estos filtros.')}</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              {tr('reportsShowing', 'Mostrando {{from}}–{{to}} de {{total}}', {
                from: pageStart,
                to: pageEnd,
                total,
              })}
            </p>
            <ReportTable>
              <thead>
                <tr>
                  <th style={thStyle()}>{tr('reportsColFecha', 'Fecha')}</th>
                  <th style={thStyle()}>{tr('reportsColJugador', 'Jugador')}</th>
                  {!esAdminClub ? <th style={thStyle()}>{tr('reportsColSede', 'Sede')}</th> : null}
                  <th style={thStyle()}>{tr('reportsColBeneficio', 'Beneficio')}</th>
                  <th style={thStyle()}>{tr('reportsColCosto', 'Costo')}</th>
                  <th style={thStyle()}>{tr('reportsColCodigo', 'Código')}</th>
                  <th style={thStyle()}>{tr('reportsColEstado', 'Estado')}</th>
                  <th style={thStyle()}>{tr('reportsColAprobacion', 'Aprobación')}</th>
                  <th style={thStyle()}>{tr('reportsColEntrega', 'Entrega')}</th>
                  <th style={thStyle()}>{tr('reportsColCancelacion', 'Cancelación')}</th>
                  <th style={thStyle()}>{tr('reportsColVencimiento', 'Vencimiento')}</th>
                  <th style={thStyle()}>{tr('reportsColDevolucion', 'Devolución')}</th>
                </tr>
              </thead>
              <tbody>
                {canjes.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatPadcoinsReporteFecha(row.fecha)}</td>
                    <td style={tdStyle()}>
                      <div>{row.jugador_nombre || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.jugador_email || row.user_id}</div>
                    </td>
                    {!esAdminClub ? <td style={tdStyle()}>{row.sede_nombre || row.sede_id || '—'}</td> : null}
                    <td style={tdStyle()}>{row.beneficio_nombre || row.beneficio_id || '—'}</td>
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.costo)}</td>
                    <td style={tdStyle()}>{row.codigo || '—'}</td>
                    <td style={tdStyle()}>{row.estado || '—'}</td>
                    <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatPadcoinsReporteFecha(row.aprobado_at)}</td>
                    <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatPadcoinsReporteFecha(row.entregado_at)}</td>
                    <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatPadcoinsReporteFecha(row.cancelado_at)}</td>
                    <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatPadcoinsReporteFecha(row.vencido_at)}</td>
                    <td style={tdStyle()}>{row.devolucion_realizada ? tr('reportsYes', 'Sí') : tr('reportsNo', 'No')}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </>
        )
      ) : null}

      {!loading && !error && subTab === 'jugadores' ? (
        jugadores.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{tr('reportsEmptyJugadores', 'Sin jugadores para estos filtros.')}</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              {tr('reportsShowing', 'Mostrando {{from}}–{{to}} de {{total}}', {
                from: pageStart,
                to: Math.min(pageStart + jugadores.length - 1, total),
                total,
              })}
            </p>
            <ReportTable>
              <thead>
                <tr>
                  <th style={thStyle()}>{tr('reportsColJugador', 'Jugador')}</th>
                  {!esAdminClub ? <th style={thStyle()}>{tr('reportsColSede', 'Sede')}</th> : null}
                  <th style={thStyle()}>{tr('reportsColSaldoDisp', 'Saldo')}</th>
                  <th style={thStyle()}>{tr('reportsColHistorico', 'Histórico')}</th>
                  <th style={thStyle()}>{tr('reportsColNivel', 'Nivel')}</th>
                  <th style={thStyle()}>Earn</th>
                  <th style={thStyle()}>Spend</th>
                  <th style={thStyle()}>{tr('reportsColCanjes', 'Canjes')}</th>
                  <th style={thStyle()}>{tr('reportsColUltimoMov', 'Último mov.')}</th>
                </tr>
              </thead>
              <tbody>
                {jugadores.map((row) => (
                  <tr key={row.user_id}>
                    <td style={tdStyle()}>
                      <div>{row.jugador_nombre || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.jugador_email || row.user_id}</div>
                    </td>
                    {!esAdminClub ? <td style={tdStyle()}>{row.sede_nombre || row.sede_id || '—'}</td> : null}
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.saldo_disponible)}</td>
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.historico_total)}</td>
                    <td style={tdStyle()}>{row.nivel_nombre || row.nivel_slug || '—'}</td>
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.movimientos_earn)}</td>
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.movimientos_spend)}</td>
                    <td style={tdStyle()}>{formatPadcoinsNumber(row.canjes_totales)}</td>
                    <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatPadcoinsReporteFecha(row.ultimo_movimiento)}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </>
        )
      ) : null}

      {!loading && !error && subTab !== 'resumen' && total > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!hasPrev || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              fontWeight: 700,
              cursor: !hasPrev ? 'not-allowed' : 'pointer',
              opacity: !hasPrev ? 0.5 : 1,
            }}
          >
            {tr('reportsPrev', 'Anterior')}
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {tr('reportsPage', 'Página')} {page + 1}
          </span>
          <button
            type="button"
            disabled={!hasNext || loading}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              fontWeight: 700,
              cursor: !hasNext ? 'not-allowed' : 'pointer',
              opacity: !hasNext ? 0.5 : 1,
            }}
          >
            {tr('reportsNext', 'Siguiente')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
