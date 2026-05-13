import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defaultHubCardImageForId, fallbackCopyForHubCardId } from '../constants/hubCardDefaults';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';

const cardWrap = {
  marginBottom: '20px',
  padding: '16px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.95)',
  color: '#0f172a',
  boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
};

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' };
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '15px',
  marginBottom: '10px',
};

/** Cards del hub alineadas con {@link HUB_FIXED_ACTIONS} en UserHome.jsx */
const HUB_DEPORTE_CARDS = [
  { key: 'reservar', label: 'Reservar cancha' },
  { key: 'buscar_partido', label: 'Buscar partido' },
  { key: 'torneos', label: 'Torneos' },
  { key: 'armar_partido', label: 'Armar partido' },
];

function draftKeyDeporte(deporte, cardKey) {
  return `${String(deporte || '').trim().toLowerCase()}|${String(cardKey || '').trim()}`;
}

export default function AdminHubPersonalizarSection({ apiBaseUrl, accessToken }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const fileRef = useRef(null);
  const uploadTargetIdRef = useRef(null);

  const [deporteRows, setDeporteRows] = useState([]);
  const [deporteLoading, setDeporteLoading] = useState(true);
  const [deporteMsg, setDeporteMsg] = useState('');
  const [sportSel, setSportSel] = useState(() => DEPORTES_CANCHA_SEDE_OPTIONS[0]?.key || 'padbol');
  const [deporteDrafts, setDeporteDrafts] = useState({});
  const [savingDeporteKey, setSavingDeporteKey] = useState(null);
  const [uploadingDeporteKey, setUploadingDeporteKey] = useState(null);
  const fileRefDeporte = useRef(null);
  const uploadDeporteTargetRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-config`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'No se pudo cargar el hub');
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      const d = {};
      for (const r of list) {
        const id = String(r.id || '').trim();
        if (!id) continue;
        d[id] = {
          titulo: String(r.titulo ?? ''),
          subtitulo: String(r.subtitulo ?? ''),
        };
      }
      setDrafts(d);
    } catch (e) {
      setMsg(e?.message || String(e));
      setRows([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const loadDeporte = useCallback(async () => {
    setDeporteLoading(true);
    setDeporteMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-deporte-config`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'No se pudo cargar hub por deporte');
      const list = Array.isArray(data) ? data : [];
      setDeporteRows(list);
      const next = {};
      for (const r of list) {
        const dep = String(r.deporte || '').trim().toLowerCase();
        const ck = String(r.card_key || '').trim();
        if (!dep || !ck) continue;
        next[draftKeyDeporte(dep, ck)] = {
          titulo: String(r.titulo ?? ''),
          subtitulo: String(r.subtitulo ?? ''),
        };
      }
      setDeporteDrafts(next);
    } catch (e) {
      setDeporteMsg(e?.message || String(e));
      setDeporteRows([]);
    } finally {
      setDeporteLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadDeporte();
  }, [loadDeporte]);

  const authHeaders = useCallback(() => {
    const h = { 'Content-Type': 'application/json' };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  const guardarCard = async (id) => {
    if (!accessToken) {
      setMsg('Iniciá sesión de nuevo.');
      return;
    }
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-config/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ titulo: d.titulo, subtitulo: d.subtitulo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al guardar');
      setRows((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...data } : r)));
      setMsg('Guardado correctamente.');
      window.setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e?.message || String(e));
    } finally {
      setSavingId(null);
    }
  };

  const guardarDeporteCard = async (cardKey) => {
    if (!accessToken) {
      setDeporteMsg('Iniciá sesión de nuevo.');
      return;
    }
    const dep = String(sportSel || '').trim().toLowerCase();
    const dk = draftKeyDeporte(dep, cardKey);
    const d = deporteDrafts[dk] || { titulo: '', subtitulo: '' };
    setSavingDeporteKey(dk);
    setDeporteMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/hub-deporte-config`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          deporte: dep,
          card_key: cardKey,
          titulo: d.titulo,
          subtitulo: d.subtitulo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al guardar');
      setDeporteRows((prev) => {
        const others = prev.filter(
          (r) =>
            String(r.deporte || '').toLowerCase() !== dep || String(r.card_key || '').trim() !== cardKey
        );
        return [...others, data];
      });
      setDeporteMsg('Guardado correctamente.');
      window.setTimeout(() => setDeporteMsg(''), 2500);
    } catch (e) {
      setDeporteMsg(e?.message || String(e));
    } finally {
      setSavingDeporteKey(null);
    }
  };

  const clickCambiarFoto = (id) => {
    uploadTargetIdRef.current = id;
    fileRef.current?.click();
  };

  const clickCambiarFotoDeporte = (cardKey) => {
    uploadDeporteTargetRef.current = { deporte: String(sportSel || '').trim().toLowerCase(), cardKey };
    fileRefDeporte.current?.click();
  };

  const onFileChange = async (e) => {
    const id = uploadTargetIdRef.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadTargetIdRef.current = null;
    if (!id || !file || !accessToken) return;
    setUploadingId(id);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const res = await fetch(`${apiBaseUrl}/api/hub-config/${encodeURIComponent(id)}/foto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al subir la imagen');
      setRows((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...data } : r)));
      setMsg('Foto actualizada.');
      window.setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg(err?.message || String(err));
    } finally {
      setUploadingId(null);
    }
  };

  const onFileChangeDeporte = async (e) => {
    const target = uploadDeporteTargetRef.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadDeporteTargetRef.current = null;
    if (!target?.deporte || !target?.cardKey || !file || !accessToken) return;
    setUploadingDeporteKey(draftKeyDeporte(target.deporte, target.cardKey));
    setDeporteMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      fd.append('deporte', target.deporte);
      fd.append('card_key', target.cardKey);
      const res = await fetch(`${apiBaseUrl}/api/hub-deporte-config/foto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error al subir la imagen');
      setDeporteRows((prev) => {
        const others = prev.filter(
          (r) =>
            String(r.deporte || '').toLowerCase() !== String(target.deporte).toLowerCase() ||
            String(r.card_key || '').trim() !== String(target.cardKey).trim()
        );
        return [...others, data];
      });
      setDeporteMsg('Foto actualizada.');
      window.setTimeout(() => setDeporteMsg(''), 2500);
    } catch (err) {
      setDeporteMsg(err?.message || String(err));
    } finally {
      setUploadingDeporteKey(null);
    }
  };

  const rowDeporteActual = (cardKey) => {
    const dep = String(sportSel || '').trim().toLowerCase();
    return deporteRows.find(
      (r) => String(r.deporte || '').toLowerCase() === dep && String(r.card_key || '').trim() === cardKey
    );
  };

  if (loading) {
    return (
      <div className="section" style={{ color: 'rgba(255,255,255,0.92)' }}>
        <p style={{ margin: 0 }}>Cargando configuración del hub…</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h2 style={{ marginBottom: '12px', paddingBottom: '8px', color: 'rgba(255,255,255,0.95)' }}>
        Personalizar Hub
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: 1.45, marginBottom: '16px' }}>
        Editá título, subtítulo e imagen por deporte (tabla <code style={{ color: '#fff' }}>hub_deporte_config</code>
        ) y las cards globales legacy (<code style={{ color: '#fff' }}>hub_config</code>). El jugador ve primero la
        config por deporte si existe; si no, el CMS global y las fotos por defecto.
      </p>

      <h3
        style={{
          margin: '0 0 10px',
          fontSize: '16px',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.95)',
        }}
      >
        Fotos y textos por deporte
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginBottom: '12px', lineHeight: 1.45 }}>
        Ejecutá en Supabase el SQL <code style={{ color: '#fef08a' }}>padbol-backend/sql/hub_deporte_config.sql</code>{' '}
        si la tabla aún no existe.
      </p>
      {deporteMsg ? (
        <p style={{ color: '#fef08a', fontSize: '14px', marginBottom: '14px', fontWeight: 600 }}>{deporteMsg}</p>
      ) : null}
      <input
        ref={fileRefDeporte}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(ev) => void onFileChangeDeporte(ev)}
      />

      <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.9)' }} htmlFor="hub-admin-deporte-select">
        Deporte
      </label>
      <select
        id="hub-admin-deporte-select"
        value={sportSel}
        onChange={(e) => setSportSel(e.target.value)}
        style={{
          ...inputStyle,
          maxWidth: '360px',
          marginBottom: '18px',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        {DEPORTES_CANCHA_SEDE_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      {deporteLoading ? (
        <p style={{ color: 'rgba(255,255,255,0.88)' }}>Cargando configuración por deporte…</p>
      ) : (
        HUB_DEPORTE_CARDS.map(({ key: cardKey, label }) => {
          const dk = draftKeyDeporte(sportSel, cardKey);
          const draft = deporteDrafts[dk] || { titulo: '', subtitulo: '' };
          const row = rowDeporteActual(cardKey);
          const previewUrl =
            String(row?.foto_url || '').trim() ||
            defaultHubCardImageForId(cardKey === 'buscar_partido' ? 'partidos' : cardKey);
          const saving = savingDeporteKey === dk;
          const uploading = uploadingDeporteKey === dk;
          return (
            <div key={dk} style={cardWrap}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>{label}</div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-start' }}>
                <div style={{ flex: '0 0 140px' }}>
                  <span style={labelStyle}>Vista previa</span>
                  <div
                    style={{
                      width: '140px',
                      height: '88px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #e2e8f0',
                      background: '#64748b center/cover no-repeat',
                      backgroundImage: `url(${previewUrl})`,
                    }}
                  />
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <button
                    type="button"
                    disabled={uploading || !accessToken}
                    onClick={() => clickCambiarFotoDeporte(cardKey)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: uploading ? '#94a3b8' : '#0ea5e9',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: uploading || !accessToken ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {uploading ? 'Subiendo…' : 'Cambiar foto'}
                  </button>
                </div>
              </div>
              <label style={labelStyle}>Título (opcional; si vacío, usa el texto por defecto del hub)</label>
              <input
                type="text"
                style={inputStyle}
                value={draft.titulo}
                placeholder={label}
                onChange={(e) =>
                  setDeporteDrafts((p) => ({
                    ...p,
                    [dk]: { ...draft, titulo: e.target.value },
                  }))
                }
              />
              <label style={labelStyle}>Subtítulo</label>
              <input
                type="text"
                style={inputStyle}
                value={draft.subtitulo}
                placeholder="Opcional"
                onChange={(e) =>
                  setDeporteDrafts((p) => ({
                    ...p,
                    [dk]: { ...draft, subtitulo: e.target.value },
                  }))
                }
              />
              <button
                type="button"
                disabled={saving || !accessToken}
                onClick={() => void guardarDeporteCard(cardKey)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: saving ? '#94a3b8' : '#16a34a',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: saving || !accessToken ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Guardando…' : 'Guardar texto'}
              </button>
            </div>
          );
        })
      )}

      <h3
        style={{
          margin: '28px 0 10px',
          fontSize: '16px',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.95)',
        }}
      >
        Cards globales (legacy)
      </h3>
      {msg ? <p style={{ color: '#fef08a', fontSize: '14px', marginBottom: '14px', fontWeight: 600 }}>{msg}</p> : null}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(ev) => void onFileChange(ev)} />

      {!rows.length ? (
        <p style={{ color: 'rgba(255,255,255,0.88)' }}>
          No hay filas en <code style={{ color: '#fff' }}>hub_config</code>. Crea registros en Supabase (7 cards con{' '}
          <code>id</code> texto y <code>orden</code>).
        </p>
      ) : null}

      {rows.map((row) => {
        const id = String(row.id || '').trim();
        const draft = drafts[id] || { titulo: '', subtitulo: '' };
        const fb = fallbackCopyForHubCardId(id);
        const previewUrl = String(row.foto_url || '').trim() || defaultHubCardImageForId(id);
        return (
          <div key={id} style={cardWrap}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', marginBottom: '10px' }}>
              ID: {id}
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: '0 0 140px' }}>
                <span style={labelStyle}>Vista previa</span>
                <div
                  style={{
                    width: '140px',
                    height: '88px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    background: '#64748b center/cover no-repeat',
                    backgroundImage: `url(${previewUrl})`,
                  }}
                />
              </div>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <button
                  type="button"
                  disabled={uploadingId === id || !accessToken}
                  onClick={() => clickCambiarFoto(id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: uploadingId === id ? '#94a3b8' : '#0ea5e9',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: uploadingId === id || !accessToken ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploadingId === id ? 'Subiendo…' : 'Cambiar foto'}
                </button>
                {!accessToken ? (
                  <p style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>Sesión requerida para subir archivos.</p>
                ) : null}
              </div>
            </div>

            <label style={labelStyle}>
              Título {(!draft.titulo?.trim() && fb.titulo) ? `(por defecto: ${fb.titulo})` : null}
            </label>
            <input
              type="text"
              style={inputStyle}
              value={draft.titulo}
              placeholder={fb.titulo}
              onChange={(e) => setDrafts((p) => ({ ...p, [id]: { ...draft, titulo: e.target.value } }))}
            />

            <label style={labelStyle}>Subtítulo</label>
            <input
              type="text"
              style={inputStyle}
              value={draft.subtitulo}
              placeholder={fb.subtitulo || 'Opcional'}
              onChange={(e) => setDrafts((p) => ({ ...p, [id]: { ...draft, subtitulo: e.target.value } }))}
            />

            <button
              type="button"
              disabled={savingId === id || !accessToken}
              onClick={() => void guardarCard(id)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: savingId === id ? '#94a3b8' : '#16a34a',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: savingId === id || !accessToken ? 'not-allowed' : 'pointer',
              }}
            >
              {savingId === id ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
