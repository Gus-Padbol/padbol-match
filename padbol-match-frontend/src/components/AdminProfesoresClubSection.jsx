import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { supabase } from '../supabaseClient';
import { aprobarProfesorAdmin, crearProfesorAdmin, fetchAdminProfesores } from '../utils/clasesAdminApi';
import { compressImageFile } from '../utils/compressImage';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

/** Tamaño máximo del archivo original (fotos de celular se comprimen antes de subir). */
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
/** Tamaño máximo del blob ya comprimido que se sube a storage. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCENT = 'var(--accent)';
const COLOR_SUCCESS = 'var(--pm-color-success, #22c55e)';
const COLOR_ERROR = 'var(--pm-color-error, #dc2626)';

const FORM_BOX_STYLE = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '22px 20px',
  marginBottom: 20,
  background: 'var(--bg-page)',
};

const LABEL_STYLE = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 8,
  color: 'var(--text-primary)',
};

const FIELD_STYLE = {
  width: '100%',
  marginBottom: 16,
  boxSizing: 'border-box',
  minHeight: 44,
  fontSize: 16,
  padding: '10px 14px',
};

const TEXTAREA_STYLE = {
  ...FIELD_STYLE,
  minHeight: 96,
  resize: 'vertical',
  lineHeight: 1.45,
};

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

export default function AdminProfesoresClubSection({ accessToken, sedeId, isSuperAdmin = false }) {
  const { t } = useTranslation();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const [fotoUploadError, setFotoUploadError] = useState(false);
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
      setFotoUploadError(true);
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setFotoUploadError(true);
      return;
    }
    setFotoUploading(true);
    setFotoUploadError(false);
    const path = `profesores/${sedeId}/${Date.now()}.jpg`;
    try {
      const compressed = await compressImageFile(file, { maxDimension: 800, quality: 0.85 });
      if (compressed.size > MAX_IMAGE_BYTES) {
        throw new Error(t('admin.sedes.compressedOver5mb'));
      }
      const { error: upErr } = await supabase.storage.from('sedes').upload(path, compressed, {
        upsert: false,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from('sedes').getPublicUrl(path);
      const url = String(publicUrl || '').trim();
      if (!url) throw new Error(t('admin.sedes.noUrl'));
      setForm((f) => ({ ...f, foto_url: url }));
      setFotoUploadError(false);
    } catch {
      setFotoUploadError(true);
      setForm((f) => ({ ...f, foto_url: '' }));
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
      setMsg(t('admin.formularios.completeName'));
      return;
    }
    if (!form.deportes.length) {
      setMsg(t('admin.formularios.chooseAtLeastOneSport'));
      return;
    }
    const certNum = String(form.certificado_fipa_numero || '').trim();
    if (ensenaPadbol && !certNum) {
      setMsg(t('admin.formularios.fipaRequiredPadbol'));
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await crearProfesorAdmin({
        sedeId,
        accessToken,
        body: {
          nombre,
          apellido: String(form.apellido || '').trim() || null,
          foto_url: String(form.foto_url || '').trim() || null,
          bio: String(form.bio || '').trim() || null,
          deportes: form.deportes,
          certificado_fipa: ensenaPadbol,
        },
      });
      setForm({ nombre: '', apellido: '', foto_url: '', bio: '', deportes: [], certificado_fipa_numero: '' });
      setFotoUploadError(false);
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
        <div style={FORM_BOX_STYLE}>
          <label className="admin-mi-sede-field-label" style={LABEL_STYLE}>
            Nombre
          </label>
          <input
            className="admin-mi-sede-theme-input"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            style={FIELD_STYLE}
          />
          <label className="admin-mi-sede-field-label" style={LABEL_STYLE}>
            Apellido
          </label>
          <input
            className="admin-mi-sede-theme-input"
            value={form.apellido}
            onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
            style={FIELD_STYLE}
          />
          <label className="admin-mi-sede-field-label" style={LABEL_STYLE}>
            Foto
          </label>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void subirFoto(e.target.files?.[0])} />
          <button
            type="button"
            className="admin-mi-sede-theme-input"
            disabled={fotoUploading}
            onClick={() => fileRef.current?.click()}
            style={{
              ...FIELD_STYLE,
              marginBottom: 10,
              cursor: fotoUploading ? 'wait' : 'pointer',
              textAlign: 'left',
            }}
          >
            {form.foto_url && !fotoUploading ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {fotoUploading ? (
            <p style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-secondary)' }}>Subiendo...</p>
          ) : null}
          {fotoUploadError && !fotoUploading ? (
            <p style={{ margin: '0 0 14px', fontSize: 16, color: COLOR_ERROR, fontWeight: 600 }}>
              Error al subir, intentá de nuevo
            </p>
          ) : null}
          {form.foto_url && !fotoUploading && !fotoUploadError ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <img
                src={form.foto_url}
                alt=""
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: '2px solid var(--border)',
                }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: COLOR_SUCCESS }}>Foto cargada ✓</span>
            </div>
          ) : null}
          <label className="admin-mi-sede-field-label" style={LABEL_STYLE}>
            Bio
          </label>
          <textarea
            className="admin-mi-sede-theme-input"
            rows={4}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            style={TEXTAREA_STYLE}
          />
          <p className="admin-mi-sede-field-label" style={{ ...LABEL_STYLE, marginBottom: 10 }}>
            Deportes que enseña
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
              <label
                key={d.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 16,
                  padding: '10px 14px',
                  minHeight: 44,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: form.deportes.includes(d.key) ? 'rgba(229,57,53,0.08)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.deportes.includes(d.key)}
                  onChange={() => toggleDeporte(d.key)}
                  style={{ width: 18, height: 18 }}
                />
                {d.label}
              </label>
            ))}
          </div>
          {ensenaPadbol ? (
            <>
              <label className="admin-mi-sede-field-label" style={LABEL_STYLE}>
                Número de certificado FIPA *
              </label>
              <input
                className="admin-mi-sede-theme-input"
                value={form.certificado_fipa_numero}
                onChange={(e) => setForm((f) => ({ ...f, certificado_fipa_numero: e.target.value }))}
                style={FIELD_STYLE}
                required
                aria-required="true"
              />
            </>
          ) : null}
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void guardar()}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '14px 20px',
              minHeight: 48,
              fontSize: 16,
              background: ACCENT,
              color: '#fff',
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
              marginTop: 4,
            }}
          >
            {saving ? t('admin.metricas.saving') : t('admin.sedes.saveCoach')}
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
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
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
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: '#dcfce7', color: '#166534' }}>{t('admin.sponsors.approvedStatus')}</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: '#fef9c3', color: '#854d0e' }}>{t('admin.sedes.pendingApprovalShort')}</span>
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
                      {approvingId === p.id ? '…' : t('admin.sedes.approve')}
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
