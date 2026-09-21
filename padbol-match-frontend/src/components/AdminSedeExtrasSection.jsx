import React, { useCallback, useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { supabase } from '../supabaseClient';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

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
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState({ nombre: '', descripcion: '', precio: '', imagen_url: '', stock: '' });
  const [edits, setEdits] = useState({});
  const [editRow, setEditRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadingImagen, setUploadingImagen] = useState(null); // 'draft' | 'edit' | null

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
      if (!res.ok) throw new Error(j.error || t('admin.sedes.extrasLoadError'));
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
  }, [apiBaseUrl, accessToken, sedeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const stockPayload = (raw) => {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  /** Sube imagen al bucket "sponsors" y entrega la URL pública via assign(url). */
  const subirImagenExtra = async (file, target, assign) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setMsg(t('admin.formularios.chooseImageFormats'));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMsg(t('admin.formularios.logoMax4mb'));
      return;
    }
    setUploadingImagen(target);
    setMsg('');
    const safe = String(file.name || 'extra').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `extras/${sedeId}/${Date.now()}_${safe}`;
    try {
      const { data: uploadData, error: upErr } = await supabase.storage.from('sponsors').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) {
        setMsg(`⚠️ ${upErr.message}`);
        return;
      }
      const filePath = uploadData?.path != null && String(uploadData.path).trim() !== '' ? String(uploadData.path).trim() : path;
      const { data } = supabase.storage.from('sponsors').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl != null ? String(data.publicUrl).trim() : '';
      if (!publicUrl) {
        setMsg(`⚠️ ${t('admin.sedes.extrasPublicUrlError')}`);
        return;
      }
      assign(publicUrl);
    } finally {
      setUploadingImagen(null);
    }
  };

  const imagenUploadControl = ({ target, value, onChangeUrl }) => {
    const busy = uploadingImagen === target;
    const url = String(value || '').trim();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {url ? (
          <img
            src={url}
            alt=""
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              border: '1px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🏷️
          </div>
        )}
        <label
          style={{
            display: 'inline-block',
            padding: '8px 14px',
            borderRadius: 8,
            background: busy ? '#9ca3af' : 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? `⏳ ${t('admin.sedes.extrasUploading')}` : url ? t('admin.sedes.extrasChangeImage') : `📤 ${t('admin.sedes.extrasUploadImage')}`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void subirImagenExtra(f, target, onChangeUrl);
            }}
          />
        </label>
        {url ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeUrl('')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-page)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {t('admin.sedes.extrasRemoveImage')}
          </button>
        ) : null}
      </div>
    );
  };

  const resetNewForm = () => {
    setDraft({ nombre: '', descripcion: '', precio: '', imagen_url: '', stock: '' });
    setShowNewForm(false);
  };

  const crear = async () => {
    const nombre = String(draft.nombre || '').trim();
    if (!nombre) {
      setMsg(t('admin.formularios.completeExtraName'));
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
      if (!res.ok) throw new Error(j.error || t('admin.sedes.extrasCreateError'));
      resetNewForm();
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
      if (!res.ok) throw new Error(j.error || t('admin.metricas.saveFailed'));
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
      if (!res.ok) throw new Error(j.error || t('admin.sedes.extrasApproveError'));
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
            imagen_url: String(editRow.imagen_url || '').trim() || null,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || t('admin.metricas.saveFailed'));
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
      if (!res.ok) throw new Error(j.error || t('admin.sedes.extrasDeleteError'));
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
      if (!res.ok) throw new Error(j.error || t('admin.sedes.extrasUpdateError'));
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
        {t('admin.sedes.extrasIntro')}
      </p>
      {msg ? (
        <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 10 }}>{msg}</p>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{t('admin.common.loadingEllipsis')}</p>
      ) : (
        <>
          {extras.length === 0 && !showNewForm ? (
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {t('admin.sedes.extrasEmpty')}
            </p>
          ) : null}
          {extras.map((row) => {
            const ed = edits[row.id] || { precio: '', activo: true };
            const pendiente = !row.aprobado_super;
            return (
              <div key={row.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                  {String(row.imagen_url || '').trim() ? (
                    <img
                      src={String(row.imagen_url).trim()}
                      alt=""
                      style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}
                    />
                  ) : null}
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{row.nombre}</div>
                </div>
                {row.descripcion ? (
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>{row.descripcion}</p>
                ) : null}
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  {pendiente ? (
                    <span style={{ color: '#ca8a04', fontWeight: 700 }}>{t('admin.sedes.pendingApproval')}</span>
                  ) : (
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>{t('admin.sponsors.approvedStatus')}</span>
                  )}
                  {!row.activo ? (
                    <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('admin.sponsors.deactivated')}</span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    {t('admin.sedes.extrasPrice', { currency: row.precio_moneda || monedaSede })}
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
                    {t('admin.sedes.subscriptionActive')}
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    {t('admin.sedes.extrasStockLabel')}
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
                    {t('admin.sedes.saveChanges')}
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
                        imagen_url: row.imagen_url || '',
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
                    {t('general.edit')}
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
                    {t('general.delete')}
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
                        {t('admin.sedes.approve')}
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
                        {t('admin.sedes.extrasReject')}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!showNewForm ? (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-page)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('admin.sedes.extrasAdd')}
            </button>
          ) : (
          <div style={{ ...card, marginTop: extras.length ? 8 : 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>{t('admin.sedes.extrasNew')}</div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.formularios.name')}</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 360, marginBottom: 10 }}
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              maxLength={200}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.descriptionOptional')}</label>
            <textarea
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 360, minHeight: 64, marginBottom: 10 }}
              value={draft.descripcion}
              onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.extrasPrice', { currency: monedaSede })}</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 200, marginBottom: 10 }}
              value={draft.precio}
              onChange={(e) => setDraft((d) => ({ ...d, precio: e.target.value }))}
              inputMode="decimal"
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.stockOptional')}</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', maxWidth: 200, marginBottom: 10 }}
              value={draft.stock}
              onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
              inputMode="numeric"
              min={0}
              placeholder={t('admin.sedes.extrasUnlimited')}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.extrasImageOptional')}</label>
            {imagenUploadControl({
              target: 'draft',
              value: draft.imagen_url,
              onChangeUrl: (url) => setDraft((d) => ({ ...d, imagen_url: url })),
            })}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                {creating ? t('admin.sedes.extrasCreating') : t('admin.sedes.extrasCreate')}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={resetNewForm}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: creating ? 'wait' : 'pointer',
                }}
              >
                {t('general.cancel')}
              </button>
            </div>
          </div>
          )}
        </>
      )}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('admin.confirmaciones.deleteProduct')}
        message={t('admin.confirmaciones.cannotUndo')}
        confirmLabel={t('admin.sedes.delete')}
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
            <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 16 }}>{t('admin.sedes.extrasEditTitle')}</h3>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.formularios.name')}</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', marginBottom: 10 }}
              value={editRow.nombre}
              onChange={(e) => setEditRow((r) => ({ ...r, nombre: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.description')}</label>
            <textarea
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', minHeight: 56, marginBottom: 10 }}
              value={editRow.descripcion}
              onChange={(e) => setEditRow((r) => ({ ...r, descripcion: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.extrasPrice', { currency: monedaSede })}</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', marginBottom: 10 }}
              value={editRow.precio}
              onChange={(e) => setEditRow((r) => ({ ...r, precio: e.target.value }))}
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.stockEmptyUnlimited')}</label>
            <input
              className="admin-mi-sede-theme-input"
              style={{ width: '100%', marginBottom: 14 }}
              value={editRow.stock}
              onChange={(e) => setEditRow((r) => ({ ...r, stock: e.target.value }))}
              inputMode="numeric"
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.extrasImageOptional')}</label>
            {imagenUploadControl({
              target: 'edit',
              value: editRow.imagen_url,
              onChangeUrl: (url) => setEditRow((r) => ({ ...r, imagen_url: url })),
            })}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditRow(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                {t('general.cancel')}
              </button>
              <button type="button" disabled={savingId === editRow.id} onClick={() => void guardarEdicionModal()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#E11B22', color: '#fff', fontWeight: 700 }}>
                {t('general.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
