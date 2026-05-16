import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { supabase } from '../supabaseClient';
import { aprobarProfesorAdmin, crearProfesorAdmin, fetchAdminProfesores } from '../utils/clasesAdminApi';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCENT = 'var(--accent)';

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

function extFromFile(file) {
  const n = String(file?.name || '');
  const m = n.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase().slice(0, 5) : 'jpg';
}

export default function AdminProfesoresClubSection({ accessToken, sedeId, isSuperAdmin = false }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    foto_url: '',
    bio: '',
    deportes: [],
    certificado_fipa_numero: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const rows = await fetchAdminProfesores({ sedeId, accessToken });
      setLista(rows);
    } catch (e) {
      setMsg(e?.message || 'Error');
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, [sedeId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleDeporte = (key) => {
    setForm((f) => {
      const set = new Set(f.deportes);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...f, deportes: [...set] };
    });
  };

  const ensenaPadbol = form.deportes.includes('padbol');

  const subirFoto = async (file) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      setMsg('Elegí un archivo de imagen.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMsg('La imagen supera los 2MB.');
      return;
    }
    setFotoUploading(true);
    setMsg('');
    const ext = extFromFile(file);
    const path = `profesores/${sedeId}/${Date.now()}.${ext}`;
    try {
      const { error: upErr } = await supabase.storage.from('sedes').upload(path, file, {
        upsert: false,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from('sedes').getPublicUrl(path);
      const url = String(publicUrl || '').trim();
      if (!url) throw new Error('No se obtuvo URL');
      setForm((f) => ({ ...f, foto_url: url }));
    } catch (e) {
      setMsg(e?.message || 'No se pudo subir la foto');
    } finally {
      setFotoUploading(false);
    }
  };

  const aprobar = async (profId) => {
    setApprovingId(profId);
    setMsg('');
    try {
      await aprobarProfesorAdmin({ profesorId: profId, accessToken });
      await load();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setApprovingId(null);
    }
  };

  const guardar = async () => {
    const nombre = String(form.nombre || '').trim();
    if (!nombre) {
      setMsg('Completá el nombre.');
      return;
    }
    if (!form.deportes.length) {
      setMsg('Elegí al menos un deporte.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const certNum = String(form.certificado_fipa_numero || '').trim();
      await crearProfesorAdmin({
        sedeId,
        accessToken,
        body: {
          nombre,
          apellido: String(form.apellido || '').trim() || null,
          foto_url: String(form.foto_url || '').trim() || null,
          bio: String(form.bio || '').trim() || null,
          deportes: form.deportes,
          certificado_fipa: ensenaPadbol && certNum.length > 0,
        },
      });
      setForm({ nombre: '', apellido: '', foto_url: '', bio: '', deportes: [], certificado_fipa_numero: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
        <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '10px 14px',
            background: ACCENT,
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cerrar formulario' : '+ Agregar profesor'}
        </button>
      </div>
      {msg ? <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 10 }}>{msg}</p> : null}
      {showForm ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            background: 'var(--bg-page)',
          }}
        >
          <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Nombre
          </label>
          <input
            className="admin-mi-sede-theme-input"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            style={{ width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Apellido
          </label>
          <input
            className="admin-mi-sede-theme-input"
            value={form.apellido}
            onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
            style={{ width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Foto
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            {form.foto_url ? (
              <img src={form.foto_url} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover' }} />
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void subirFoto(e.target.files?.[0])} />
            <button
              type="button"
              className="admin-mi-sede-theme-input"
              disabled={fotoUploading}
              onClick={() => fileRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              {fotoUploading ? 'Subiendo…' : form.foto_url ? 'Cambiar foto' : 'Subir foto'}
            </button>
          </div>
          <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Bio
          </label>
          <textarea
            className="admin-mi-sede-theme-input"
            rows={3}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            style={{ width: '100%', marginBottom: 10, boxSizing: 'border-box', resize: 'vertical' }}
          />
          <p className="admin-mi-sede-field-label" style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>
            Deportes que enseña
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
              <label
                key={d.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: form.deportes.includes(d.key) ? 'rgba(229,57,53,0.08)' : 'var(--bg-card)',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={form.deportes.includes(d.key)} onChange={() => toggleDeporte(d.key)} />
                {d.label}
              </label>
            ))}
          </div>
          {ensenaPadbol ? (
            <>
              <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Nº certificado FIPA (opcional)
              </label>
              <input
                className="admin-mi-sede-theme-input"
                value={form.certificado_fipa_numero}
                onChange={(e) => setForm((f) => ({ ...f, certificado_fipa_numero: e.target.value }))}
                style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
              />
            </>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void guardar()}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '10px 16px',
              background: ACCENT,
              color: '#fff',
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar profesor'}
          </button>
          {!isSuperAdmin ? (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Quedará con badge «Pendiente aprobación» hasta que super admin apruebe.
            </p>
          ) : (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Como super admin podés aprobarlo desde la lista cuando quieras.
            </p>
          )}
        </div>
      ) : null}
      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No hay profesores cargados.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {lista.map((p) => (
            <li
              key={p.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: 'var(--bg-input)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p.foto_url ? (
                  <img src={p.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ opacity: 0.4 }}>👤</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{nombreProfesor(p)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Deportes: {deportesLabel(p.deportes)}</div>
                {p.certificado_fipa ? (
                  <div style={{ fontSize: 12, marginTop: 4, fontWeight: 700, color: ACCENT }}>Cert. FIPA</div>
                ) : null}
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {p.aprobado ? (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: '#dcfce7', color: '#166534' }}>Aprobado</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: '#fef9c3', color: '#854d0e' }}>Pendiente aprobación</span>
                  )}
                  {isSuperAdmin && !p.aprobado ? (
                    <button
                      type="button"
                      disabled={approvingId === p.id}
                      onClick={() => void aprobar(p.id)}
                      style={{
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 12px',
                        background: ACCENT,
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: approvingId === p.id ? 'wait' : 'pointer',
                      }}
                    >
                      {approvingId === p.id ? '…' : 'Aprobar'}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
