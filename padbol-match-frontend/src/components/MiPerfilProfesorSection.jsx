import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { supabase } from '../supabaseClient';
import { compressImageFile } from '../utils/compressImage';
import { fetchMiPerfilProfesor, patchMiPerfilProfesor } from '../utils/clasesApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import './MiPerfilProfesorSection.css';

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BIO_MAX = 500;
const FOTO_BUCKET = 'profesores';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k;
}

function deportesLabel(deportes) {
  const list = Array.isArray(deportes) ? deportes : [];
  if (!list.length) return '—';
  return list.map(labelDeporte).join(', ');
}

function generoLabel(t, genero) {
  const g = String(genero || '').trim().toLowerCase();
  if (g === 'masculino') return t('instructor.generoMasculino');
  if (g === 'femenino') return t('instructor.generoFemenino');
  if (g === 'no_decir') return t('instructor.generoNoDice');
  return genero || '—';
}

function formatFechaNac(raw) {
  const s = String(raw || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, mo, d] = s.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Perfil editable del instructor aprobado (GET/PATCH /api/profesor/mi-perfil).
 */
export default function MiPerfilProfesorSection({ accessToken, userId }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [prof, setProf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [bio, setBio] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [genero, setGenero] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoUploading, setFotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  const syncDraftFromProf = useCallback((row) => {
    setWhatsapp(String(row?.whatsapp || '').trim());
    setBio(String(row?.bio || '').trim());
    const fecha = String(row?.fecha_nacimiento || '').trim().slice(0, 10);
    setFechaNacimiento(/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : '');
    setGenero(String(row?.genero || '').trim().toLowerCase());
    const foto = String(row?.foto_url || '').trim();
    setFotoUrl(foto);
    setFotoPreview(foto);
  }, []);

  const load = useCallback(async () => {
    if (!accessToken) {
      setProf(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const row = await fetchMiPerfilProfesor({ accessToken });
      setProf(row);
      syncDraftFromProf(row);
    } catch (e) {
      setProf(null);
      if (e?.message && !String(e.message).includes('404')) setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, syncDraftFromProf]);

  useEffect(() => {
    void load();
  }, [load]);

  const subirFoto = async (file) => {
    if (!file || !userId || !String(file.type || '').startsWith('image/')) {
      setMsg(t('instructor.errorFoto'));
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setMsg(t('instructor.errorFoto'));
      return;
    }
    setFotoUploading(true);
    setMsg('');
    const path = `${userId}/foto.jpg`;
    try {
      const compressed = await compressImageFile(file, { maxDimension: 800, quality: 0.85 });
      if (compressed.size > MAX_IMAGE_BYTES) throw new Error('too large');
      const { error: upErr } = await supabase.storage.from(FOTO_BUCKET).upload(path, compressed, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(FOTO_BUCKET).getPublicUrl(path);
      const url = String(publicUrl || '').trim();
      if (!url) throw new Error('no url');
      setFotoUrl(url);
      setFotoPreview(url);
    } catch {
      setMsg(t('instructor.errorFoto'));
    } finally {
      setFotoUploading(false);
    }
  };

  const guardar = async () => {
    if (String(bio || '').length > BIO_MAX) {
      setMsg(t('instructor.errorBioMax'));
      return;
    }
    setSaving(true);
    setMsg('');
    setOk('');
    try {
      const updated = await patchMiPerfilProfesor({
        accessToken,
        body: {
          foto_url: fotoUrl || null,
          whatsapp: String(whatsapp || '').trim() || null,
          bio: String(bio || '').trim() || null,
          fecha_nacimiento: fechaNacimiento || null,
          genero: genero || null,
        },
      });
      setProf(updated);
      syncDraftFromProf(updated);
      setEditMode(false);
      setOk(t('profesor.miPerfil.guardado'));
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prof) return null;

  const nombre =
    [String(prof.nombre || '').trim(), String(prof.apellido || '').trim()].filter(Boolean).join(' ') ||
    prof.nombre ||
    '—';

  return (
    <div className="mi-perfil-profesor">
      <div className="mi-perfil-profesor__head">
        <h3 className="mi-perfil-profesor__title">{t('profesor.miPerfil.titulo')}</h3>
        {!editMode ? (
          <button type="button" className="mi-perfil-profesor__edit-btn" onClick={() => setEditMode(true)}>
            {t('instructor.editarPerfil')}
          </button>
        ) : null}
      </div>
      <p className="mi-perfil-profesor__sub">
        {t('profesor.miPerfil.subtitulo', { nombre })}
        {prof.sede_nombre ? ` · ${prof.sede_nombre}` : ''}
      </p>

      {msg ? <p className="mi-perfil-profesor__msg mi-perfil-profesor__msg--error">{msg}</p> : null}
      {ok ? <p className="mi-perfil-profesor__msg mi-perfil-profesor__msg--ok">{ok}</p> : null}

      {editMode ? (
        <>
          <div className="mi-perfil-profesor__foto-wrap">
            <div className="mi-perfil-profesor__foto-preview">
              {fotoPreview ? <img src={fotoPreview} alt="" /> : <span>📷</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) {
                setFotoPreview(URL.createObjectURL(file));
                void subirFoto(file);
              }
            }} />
            <button
              type="button"
              className="mi-perfil-profesor__foto-btn"
              disabled={fotoUploading}
              onClick={() => fileRef.current?.click()}
            >
              {fotoUploading ? '…' : t('instructor.campoFoto')}
            </button>
          </div>

          <label className="mi-perfil-profesor__label">{t('instructor.campoWhatsapp')}</label>
          <input
            type="tel"
            className="mi-perfil-profesor__input"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+54 9 221 000-0000"
          />

          <label className="mi-perfil-profesor__label">{t('instructor.campoBio')}</label>
          <textarea
            className="mi-perfil-profesor__textarea"
            maxLength={BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <div className="mi-perfil-profesor__char-count">
            {bio.length}/{BIO_MAX}
          </div>

          <label className="mi-perfil-profesor__label">{t('instructor.campoFechaNac')}</label>
          <input
            type="date"
            className="mi-perfil-profesor__input"
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
          />

          <label className="mi-perfil-profesor__label">{t('instructor.campoGenero')}</label>
          <select className="mi-perfil-profesor__input" value={genero} onChange={(e) => setGenero(e.target.value)}>
            <option value="">{t('perfil.selectGender')}</option>
            <option value="masculino">{t('instructor.generoMasculino')}</option>
            <option value="femenino">{t('instructor.generoFemenino')}</option>
            <option value="no_decir">{t('instructor.generoNoDice')}</option>
          </select>

          <div className="mi-perfil-profesor__actions">
            <button type="button" className="mi-perfil-profesor__save" disabled={saving || fotoUploading} onClick={() => void guardar()}>
              {saving ? t('admin.metricas.saving') : t('instructor.guardarCambios')}
            </button>
            <button
              type="button"
              className="mi-perfil-profesor__cancel"
              disabled={saving || fotoUploading}
              onClick={() => {
                syncDraftFromProf(prof);
                setEditMode(false);
                setMsg('');
              }}
            >
              {t('instructor.cancelar')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mi-perfil-profesor__readonly">
            {prof.foto_url ? (
              <img src={prof.foto_url} alt="" className="mi-perfil-profesor__avatar-read" />
            ) : null}
            <div className="mi-perfil-profesor__readonly-rows">
              <div>
                <span className="mi-perfil-profesor__ro-label">{t('admin.profesores.colSede')}</span>
                <span>{prof.sede_nombre || '—'}</span>
              </div>
              <div>
                <span className="mi-perfil-profesor__ro-label">{t('admin.profesores.colDeportes')}</span>
                <span>{deportesLabel(prof.deportes)}</span>
              </div>
              <div>
                <span className="mi-perfil-profesor__ro-label">{t('admin.profesores.colCertificado')}</span>
                <span>{prof.certificado_fipa ? t('admin.profesores.certificadoSi') : t('admin.profesores.no')}</span>
              </div>
              <div>
                <span className="mi-perfil-profesor__ro-label">{t('instructor.campoWhatsapp')}</span>
                <span>{String(prof.whatsapp || '').trim() || '—'}</span>
              </div>
              <div>
                <span className="mi-perfil-profesor__ro-label">{t('instructor.campoBio')}</span>
                <span>{String(prof.bio || '').trim() || '—'}</span>
              </div>
              <div>
                <span className="mi-perfil-profesor__ro-label">{t('instructor.campoFechaNac')}</span>
                <span>{formatFechaNac(prof.fecha_nacimiento)}</span>
              </div>
              <div>
                <span className="mi-perfil-profesor__ro-label">{t('instructor.campoGenero')}</span>
                <span>{generoLabel(t, prof.genero)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
