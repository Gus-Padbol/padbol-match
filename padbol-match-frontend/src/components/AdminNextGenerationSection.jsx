import './AdminNextGenerationSection.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';

const API_BASE = getApiBaseUrl();
const STATE_LABEL = { confirmada: 'Confirmada', en_espera: 'En espera', cancelada: 'Cancelada' };

export default function AdminNextGenerationSection({ accessToken, role, sedeId }) {
  const [data, setData] = useState({ summary: {}, inscripciones: [], sedes: [], jornadas: [] });
  const [filter, setFilter] = useState('todas');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [createError, setCreateError] = useState('');
  const emptyForm = { sede_id: role === 'admin_club' ? String(sedeId || '') : '', nombre_publico: '', categoria: 'U14', comienza_at: '', termina_at: '', cupo: '', estado: 'borrador' };
  const [form, setForm] = useState(emptyForm);
  const canCreate = !!accessToken && (role === 'super_admin' || (role === 'admin_club' && Number(sedeId) > 0));
  const venues = (data.sedes || []).filter((venue) => role !== 'admin_club' || String(venue.id) === String(sedeId));
  const update = (event) => { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setCreateError(''); };
  const createSession = async (event) => {
    event.preventDefault();
    if (!canCreate || saving) return;
    const venue = role === 'admin_club' ? Number(sedeId) : Number(form.sede_id);
    const starts = new Date(form.comienza_at);
    const ends = form.termina_at ? new Date(form.termina_at) : null;
    if (!venues.some((item) => Number(item.id) === venue) || !form.nombre_publico.trim() || !Number.isInteger(Number(form.cupo)) || Number(form.cupo) < 1 || Number.isNaN(starts.getTime()) || (ends && (Number.isNaN(ends.getTime()) || ends <= starts))) {
      setCreateError('Revisa la sede, el nombre, el cupo y las fechas. El final debe ser posterior al inicio.'); return;
    }
    setSaving(true); setCreateError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/next-generation/sessions`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sede_id: venue, nombre_publico: form.nombre_publico.trim(), categoria: form.categoria, comienza_at: starts.toISOString(), termina_at: ends ? ends.toISOString() : null, cupo: Number(form.cupo), estado: form.estado }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.session?.id) throw new Error('No se pudo confirmar el guardado de la jornada. Revisa el listado antes de volver a intentar.');
      setNotice(`Jornada creada: ${body.session.nombre_publico || form.nombre_publico}.`);
      setCreating(false); setForm(emptyForm); await load();
    } catch (saveError) { setCreateError(saveError.message); }
    finally { setSaving(false); }
  };

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/next-generation/overview`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las inscripciones.');
      setData({ summary: body.summary || {}, inscripciones: body.inscripciones || [], sedes: body.sedes || [], jornadas: body.jornadas || body.sessions || [] });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
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

  return (
    <section className="admin-ng-section" aria-label="Inscripciones Next Generation">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Next Generation</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Inscripciones web, jornada y sede en una única vista.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
      {canCreate ? <button type="button" onClick={() => { setCreating(true); setNotice(''); }} disabled={saving}>Crear jornada</button> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {creating && canCreate ? <form className="admin-ng-session-form" onSubmit={createSession} aria-label="Crear jornada Next Generation">
        <h3>Nueva jornada</h3>
        <p>Las fechas se ingresan en la zona horaria de este dispositivo. Ciudad y país se toman de la sede.</p>
        <fieldset disabled={saving}>
          <label>Sede<select required name="sede_id" value={role === 'admin_club' ? String(sedeId) : form.sede_id} onChange={update} disabled={role === 'admin_club'}><option value="">Seleccionar sede…</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.nombre || venue.sede_club || 'Sede sin nombre'}</option>)}</select></label>
          <label>Nombre de la jornada<input required maxLength={160} name="nombre_publico" value={form.nombre_publico} onChange={update} /></label>
          <label>Categoría<select name="categoria" value={form.categoria} onChange={update}><option>U14</option><option>U16</option><option>U18</option></select></label>
          <label>Inicio<input required type="datetime-local" name="comienza_at" value={form.comienza_at} onChange={update} /></label>
          <label>Final (opcional)<input type="datetime-local" name="termina_at" value={form.termina_at} onChange={update} /></label>
          <label>Cupo<input required type="number" min="1" step="1" name="cupo" value={form.cupo} onChange={update} /></label>
          <label>Estado<select name="estado" value={form.estado} onChange={update}><option value="borrador">Borrador</option><option value="programada">Programada</option></select></label>
        </fieldset>
        {!venues.length ? <p>No hay sedes disponibles para crear una jornada.</p> : null}
        {createError ? <p role="alert">{createError}</p> : null}
        <div className="admin-ng-session-actions">
        <button className="admin-ng-button--primary" type="submit" disabled={saving || !venues.length}>{saving ? 'Guardando…' : 'Guardar jornada'}</button>
        <button type="button" disabled={saving} onClick={() => { setCreating(false); setCreateError(''); }}>Cancelar</button>
        </div>
      </form> : null}
      {error ? <p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, margin: '20px 0' }}>
        {[['Total', data.summary.total], ['Confirmadas', data.summary.confirmadas], ['En espera', data.summary.en_espera], ['Canceladas', data.summary.canceladas]].map(([label, value]) => (
          <article key={label} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
            <span>{label}</span><strong style={{ display: 'block', fontSize: 26 }}>{Number(value) || 0}</strong>
          </article>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input aria-label="Buscar inscripciones Next Generation" type="search" placeholder="Buscar familia, jornada o sede" value={query} onChange={(event) => setQuery(event.target.value)} style={{ minWidth: 220, flex: 1 }} />
        <select aria-label="Filtrar estado" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="todas">Todos los estados</option><option value="confirmada">Confirmadas</option><option value="en_espera">En espera</option><option value="cancelada">Canceladas</option>
        </select>
      </div>
      {!loading && !visible.length ? <p>No hay inscripciones para este filtro.</p> : null}
      <div style={{ display: 'grid', gap: 12 }}>
        {visible.map((row) => (
          <article key={row.id} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{row.contacto_nombre || 'Responsable sin nombre'}</strong><span>{STATE_LABEL[row.estado] || row.estado}</span></div>
            <p>{row.jornada?.nombre_publico || 'Jornada sin nombre'} · {row.sede?.sede_club || 'Sede sin asignar'}</p>
            <small>{row.participantes?.length || 0} participante(s) · {row.eventos?.length || 0} evento(s) trazables</small>
          </article>
        ))}
      </div>
    </section>
  );
}
