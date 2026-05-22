import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { fetchAdminProfesoresTodos } from '../utils/clasesAdminApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k;
}

function deportesLabel(deportes) {
  const list = Array.isArray(deportes) ? deportes : [];
  if (!list.length) return '—';
  return list.map(labelDeporte).join(', ');
}

function nombreProfesor(p) {
  return (
    [String(p?.nombre || '').trim(), String(p?.apellido || '').trim()].filter(Boolean).join(' ').trim() ||
    String(p?.nombre || '').trim() ||
    '—'
  );
}

function normalizeBusqueda(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const TH_STYLE = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  color: '#fff',
  whiteSpace: 'nowrap',
};

const TD_STYLE = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  verticalAlign: 'middle',
};

export default function AdminProfesoresTodosSuper({ accessToken }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filtroSede, setFiltroSede] = useState('');
  const [filtroDeporte, setFiltroDeporte] = useState('');
  const [busquedaNombre, setBusquedaNombre] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const list = await fetchAdminProfesoresTodos({ accessToken });
      setItems(list);
    } catch (e) {
      setMsg(e?.message || 'Error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const sedesOpciones = useMemo(() => {
    const map = new Map();
    for (const row of items) {
      const id = Number(row.sede_id);
      if (!Number.isFinite(id)) continue;
      const nombre = String(row.sede_nombre || '').trim() || `Sede #${id}`;
      if (!map.has(id)) map.set(id, nombre);
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [items]);

  const filtrados = useMemo(() => {
    const q = normalizeBusqueda(busquedaNombre);
    const sid = filtroSede ? Number(filtroSede) : null;
    const dep = String(filtroDeporte || '').trim().toLowerCase();
    return items.filter((row) => {
      if (sid != null && Number.isFinite(sid) && Number(row.sede_id) !== sid) return false;
      if (dep) {
        const deps = Array.isArray(row.deportes) ? row.deportes.map((d) => String(d).trim().toLowerCase()) : [];
        if (!deps.includes(dep)) return false;
      }
      if (q) {
        const nombre = normalizeBusqueda(nombreProfesor(row));
        if (!nombre.includes(q)) return false;
      }
      return true;
    });
  }, [items, filtroSede, filtroDeporte, busquedaNombre]);

  if (!accessToken) return null;

  return (
    <div
      style={{
        marginBottom: 20,
        padding: 14,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        maxWidth: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
        Todos los profesores
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        Profesores aprobados en todas las sedes. Filtrá por sede, deporte o nombre.
      </p>

      <div className="sedes-admin-filters-toolbar" style={{ marginBottom: 12 }}>
        <label className="sedes-admin-filter-field">
          <span className="sedes-admin-filter-label">Sede</span>
          <select
            className="sedes-admin-filter-select"
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
            aria-label="Filtrar por sede"
          >
            <option value="">Todas las sedes</option>
            {sedesOpciones.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="sedes-admin-filter-field">
          <span className="sedes-admin-filter-label">Deporte</span>
          <select
            className="sedes-admin-filter-select"
            value={filtroDeporte}
            onChange={(e) => setFiltroDeporte(e.target.value)}
            aria-label="Filtrar por deporte"
          >
            <option value="">{t('admin.sponsors.allSports')}</option>
            {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sedes-admin-filter-field sedes-admin-filter-field--search">
          <span className="sedes-admin-filter-label">{t('admin.metricas.searchLabel')}</span>
          <input
            type="search"
            className="sedes-admin-filter-select"
            value={busquedaNombre}
            onChange={(e) => setBusquedaNombre(e.target.value)}
            placeholder="Buscar por nombre…"
            autoComplete="off"
            aria-label="Buscar profesor por nombre"
          />
        </label>
      </div>

      {msg ? <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 8 }}>{msg}</p> : null}
      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
      ) : filtrados.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          {items.length === 0 ? 'No hay profesores aprobados.' : 'Ningún profesor coincide con los filtros.'}
        </p>
      ) : (
        <div className="sedes-admin-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="reservas-table sedes-admin-sedes-table" style={{ minWidth: 720 }}>
            <thead>
              <tr style={{ background: 'var(--accent)' }}>
                <th style={TH_STYLE}>Foto</th>
                <th style={TH_STYLE}>Nombre</th>
                <th style={TH_STYLE}>Sede</th>
                <th style={TH_STYLE}>Deportes</th>
                <th style={TH_STYLE}>Certificado FIPA</th>
                <th style={TH_STYLE}>WhatsApp</th>
                <th style={TH_STYLE}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((row) => {
                const wa = String(row.whatsapp || '').trim();
                const activo = row.activo !== false;
                return (
                  <tr key={row.id}>
                    <td style={TD_STYLE}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: 'var(--bg-input)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {row.foto_url ? (
                          <img
                            src={row.foto_url}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ opacity: 0.35, fontSize: 18 }} aria-hidden>
                            👤
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...TD_STYLE, fontWeight: 700 }}>{nombreProfesor(row)}</td>
                    <td style={TD_STYLE}>{row.sede_nombre || `ID ${row.sede_id}`}</td>
                    <td style={TD_STYLE}>{deportesLabel(row.deportes)}</td>
                    <td style={TD_STYLE}>{row.certificado_fipa ? 'Sí' : '—'}</td>
                    <td style={TD_STYLE}>
                      {wa ? (
                        <a href={`https://wa.me/${wa.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                          {wa}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={TD_STYLE}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: activo ? '#dcfce7' : '#f1f5f9',
                          color: activo ? '#166534' : '#64748b',
                        }}
                      >
                        {activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {filtrados.length} de {items.length} profesor{items.length === 1 ? '' : 'es'}
          </p>
        </div>
      )}
    </div>
  );
}
