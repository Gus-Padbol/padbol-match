import React, { useCallback, useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { useTranslation } from 'react-i18next';

/**
 * Mi Sede — extras del tercer tiempo (admin club: CRUD sin aprobación; super puede aprobar en fila).
 */
export default function AdminSedeExtrasSection({ apiBaseUrl, accessToken, sedeId, monedaSede = 'ARS', isSuperAdmin }) {
  const { t } = useTranslation();
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ nombre: '', descripcion: '', precio: '', imagen_url: '', stock: '' });
  const [edits, setEdits] = useState({});
  const [editRow, setEditRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
          stock: row.stock != null ? String(row.stock) : '',
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

  const stockPayload = (raw) => {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

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
          stock: stockPayload(draft.stock),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo crear');
      setDraft({ nombre: '', descripcion: '', precio: '', imagen_url: '', stock: '' });
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
            stock: stockPayload(ed.stock),
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

  const guardarEdicionModal = async () => {
    if (!editRow?.id) return;
    setSavingId(editRow.id);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(editRow.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            nombre: String(editRow.nombre || '').trim(),
            descripcion: String(editRow.descripcion || '').trim() || null,
            precio: editRow.precio,
            stock: stockPayload(editRow.stock),
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo guardar');
      setEditRow(null);
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const eliminarExtra = async () => {
    const rowId = deleteTarget?.id;
    if (!rowId) return;
    setSavingId(rowId);
    setMsg('');
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/extras/${encodeURIComponent(rowId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo eliminar');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setMsg(e.message || 'Error');
    } finally {
      setSavingId(null);
    }
  };

  const rechazar = async (rowId) => {
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
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
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
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Stock
                    <input
                      type="number"
                      min={0}
                      className="admin-mi-sede-theme-input"
                      style={{ marginLeft: 8, width: 88 }}
                      placeholder="∞"
                      value={ed.stock ?? ''}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { ...ed, stock: e.target.value } }))}
                    />
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
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() =>
                      setEditRow({
                        id: row.id,
                        nombre: row.nombre,
                        descripcion: row.descripcion || '',
                        precio: ed.precio,
                        stock: ed.stock ?? '',
                      })
                    }
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
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => setDeleteTarget({ id: row.id, nombre: row.nombre })}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--pm-color-error, #f87171)',
                      background: 'transparent',
                      color: 'var(--pm-color-error, #f87171)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: savingId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    Eliminar
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
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Stock disponible (opcional, vacío = ilimitado)</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 200, marginBottom: 10 }}
              value={draft.stock}
              onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
              inputMode="numeric"
              min={0}
              placeholder="Ilimitado"
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
                background: creating ? '#9ca3af' : 'var(--accent)',
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
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="¿Eliminar este producto?"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        dismissLabel={t('general.cancel')}
        confirmDanger
        busy={Boolean(savingId)}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={() => void eliminarExtra()}
      />

      {editRow ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100001,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !savingId && setEditRow(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 16 }}>Editar producto</h3>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nombre</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', marginBottom: 10 }}
              value={editRow.nombre}
              onChange={(e) => setEditRow((r) => ({ ...r, nombre: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Descripción</label>
            <textarea
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', minHeight: 56, marginBottom: 10 }}
              value={editRow.descripcion}
              onChange={(e) => setEditRow((r) => ({ ...r, descripcion: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Precio ({monedaSede})</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', marginBottom: 10 }}
              value={editRow.precio}
              onChange={(e) => setEditRow((r) => ({ ...r, precio: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Stock (vacío = ilimitado)</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', marginBottom: 14 }}
              value={editRow.stock}
              onChange={(e) => setEditRow((r) => ({ ...r, stock: e.target.value }))}
              inputMode="numeric"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditRow(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                Cancelar
              </button>
              <button type="button" disabled={savingId === editRow.id} onClick={() => void guardarEdicionModal()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#E11B22', color: '#fff', fontWeight: 700 }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
