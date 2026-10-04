import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';

const API_BASE = getApiBaseUrl();
const STATE_LABEL = { confirmada: 'Confirmada', en_espera: 'En espera', cancelada: 'Cancelada' };

export default function AdminNextGenerationSection({ accessToken }) {
  const [data, setData] = useState({ summary: {}, inscripciones: [] });
  const [filter, setFilter] = useState('todas');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/next-generation/overview`, {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las inscripciones.');
      setData({ summary: body.summary || {}, inscripciones: body.inscripciones || [] });
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.inscripciones.filter((row) => {
      if (filter !== 'todas' && row.estado !== filter) return false;
      if (!needle) return true;
      return [row.contacto_nombre, row.contacto_email, row.jornada?.nombre_publico, row.sede?.sede_club]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [data.inscripciones, filter, query]);

  return <section aria-label="Inscripciones Next Generation">
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div><h2 style={{ marginBottom: 4 }}>Next Generation</h2><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Inscripciones web y trazabilidad CRM desde la fuente canónica.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
    </div>
    {error ? <p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, margin: '20px 0' }}>
      {[['Total', data.summary.total], ['Confirmadas', data.summary.confirmadas], ['En espera', data.summary.en_espera], ['Canceladas', data.summary.canceladas]].map(([label, value]) =>
        <article key={label} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 }}><span>{label}</span><strong style={{ display: 'block', fontSize: 26 }}>{Number(value) || 0}</strong></article>)}
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <input aria-label="Buscar inscripciones Next Generation" type="search" placeholder="Buscar familia, jornada o sede" value={query} onChange={(event) => setQuery(event.target.value)} style={{ minWidth: 280, flex: 1 }} />
      <select aria-label="Filtrar estado" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="todas">Todos los estados</option><option value="confirmada">Confirmadas</option><option value="en_espera">En espera</option><option value="cancelada">Canceladas</option></select>
    </div>
    {!loading && !visible.length ? <p>No hay inscripciones para este filtro.</p> : null}
    <div style={{ display: 'grid', gap: 12 }}>
      {visible.map((row) => <article key={row.id} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{row.contacto_nombre || 'Responsable sin nombre'}</strong><span>{STATE_LABEL[row.estado] || row.estado}</span></div>
        <p>{row.jornada?.nombre_publico || 'Jornada sin nombre'} · {row.sede?.sede_club || 'Sede sin asignar'}</p>
        <small>{row.participantes?.length || 0} participante(s) · {row.eventos?.length || 0} evento(s) trazables · ID {String(row.id).slice(0, 8)}</small>
      </article>)}
    </div>
  </section>;
}
