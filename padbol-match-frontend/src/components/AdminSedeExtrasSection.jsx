import React, { useCallback, useEffect, useState } from 'react';

/**
 * Mi Sede — extras del tercer tiempo (admin club: CRUD sin aprobación; super puede aprobar en fila).
 */
export default function AdminSedeExtrasSection({ apiBaseUrl, accessToken, sedeId, monedaSede = 'ARS', isSuperAdmin }) {
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ nombre: '', descripcion: '', precio: '', imagen_url: '' });
  const [edits, setEdits] = useState({});

  const load = useCallback(async () => {
    if (!sedeId || !accessToken) {
      setExtras([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras-admin`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudieron cargar los extras');
      const list = Array.isArray(j.extras) ? j.extras : [];
      setExtras(list);
      const nextEdits = {};
      for (const row of list) {
        nextEdits[row.id] = {
          precio: row.precio != null ? String(Math.round(Number(row.precio))) : '',
          activo: !!row.activo,
        };
      }
      setEdits(nextEdits);
    } catch (e) {
      setMsg(e.message || 'Error');
      setExtras([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, accessToken, sedeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = async () => {
    const nombre = String(draft.nombre || '').trim();
    if (!nombre) {
      setMsg('Completá el nombre del extra.');
      return;
    }
    setCreating(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nombre,
          descripcion: String(draft.descripcion || '').trim() || null,
          precio: draft.precio,
          precio_moneda: monedaSede,
          imagen_url: String(draft.imagen_url || '').trim() || null,
          activo: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo crear');
      setDraft({ nombre: '', descripcion: '', precio: '', imagen_url: '' });
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setCreating(false);
    }
  };

  const guardarFila = async (rowId) => {
    const ed = edits[rowId];
    if (!ed) return;
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            precio: ed.precio,
            activo: ed.activo,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo guardar');
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const aprobar = async (rowId) => {
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ aprobado_super: true }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo aprobar');
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const rechazar = async (rowId) => {
    if (!window.confirm('¿Marcar este extra como rechazado? Quedará desactivado.')) return;
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ activo: false }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo actualizar');
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  if (!sedeId || !accessToken) return null;

  const card = {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    background: 'var(--bg-card)',
    maxWidth: 390,
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5 }}>
        Sumá productos o servicios opcionales (por ejemplo pizza o bebidas). Los jugadores los pueden elegir al pagar
        una reserva «Armar partido». Los nuevos extras quedan pendientes hasta que un super admin los apruebe.
      </p>
      {msg ? (
        <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 10 }}>{msg}</p>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando…</p>
      ) : (
        <>
          {extras.map((row) => {
            const ed = edits[row.id] || { precio: '', activo: true };
            const pendiente = !row.aprobado_super;
            return (
              <div key={row.id} style={card}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{row.nombre}</div>
                {row.descripcion ? (
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>{row.descripcion}</p>
                ) : null}
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  {pendiente ? (
                    <span style={{ color: '#ca8a04', fontWeight: 700 }}>Pendiente de aprobación</span>
                  ) : (
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Aprobado</span>
                  )}
                  {!row.activo ? (
                    <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>Desactivado</span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Precio ({row.precio_moneda || monedaSede})
                    <input
                      type="text"
                      inputMode="decimal"
                      className="admin-mi-sede-theme-input"
                      style={{ marginLeft: 8, width: 120 }}
                      value={ed.precio}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { ...ed, precio: e.target.value } }))}
                    />
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={ed.activo}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { ...ed, activo: e.target.checked } }))}
                    />
                    Activo
                  </label>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => guardarFila(row.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#E11B22',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: savingId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    Guardar cambios
                  </button>
                  {isSuperAdmin && pendiente ? (
                    <>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => aprobar(row.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #16a34a',
                          background: 'transparent',
                          color: '#16a34a',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: savingId === row.id ? 'wait' : 'pointer',
                        }}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => rechazar(row.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-page)',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: savingId === row.id ? 'wait' : 'pointer',
                        }}
                      >
                        Rechazar
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          <div style={{ ...card, marginTop: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Nuevo extra</div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nombre</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 360, marginBottom: 10 }}
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              maxLength={200}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Descripción (opcional)</label>
            <textarea
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 360, minHeight: 64, marginBottom: 10 }}
              value={draft.descripcion}
              onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Precio ({monedaSede})</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 200, marginBottom: 10 }}
              value={draft.precio}
              onChange={(e) => setDraft((d) => ({ ...d, precio: e.target.value }))}
              inputMode="decimal"
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>URL de imagen (opcional)</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 360, marginBottom: 12 }}
              value={draft.imagen_url}
              onChange={(e) => setDraft((d) => ({ ...d, imagen_url: e.target.value }))}
            />
            <button
              type="button"
              disabled={creating}
              onClick={crear}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: creating ? '#9ca3af' : '#0f172a',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: creating ? 'wait' : 'pointer',
              }}
            >
              {creating ? 'Creando…' : 'Crear extra'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
