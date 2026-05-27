import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import SportIcon from './common/SportIcon';
import { supabase } from '../supabaseClient';
import {
  buildFullWhatsDigits,
  formatWhatsAppE164,
  splitStoredWhatsapp,
  whatsappDigitsValido,
} from '../utils/authIdentidad';
import { compressImageFile } from '../utils/compressImage';
import {
  fetchMiSolicitudInstructor,
  postSolicitudInstructor,
} from '../utils/clasesApi';
import TelefonoPaisCodigoRow from './TelefonoPaisCodigoRow';
import MiPerfilProfesorSection from './MiPerfilProfesorSection';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import './InstructorFipa.css';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BIO_MAX = 500;
const FOTO_BUCKET = 'profesores';

function InstructorFipaSolicitudModal({
  open,
  onClose,
  onSuccess,
  accessToken,
  userId,
  prefill,
  t,
}) {
  const fileRef = useRef(null);
  const [sedes, setSedes] = useState([]);
  const [sedesLoading, setSedesLoading] = useState(true);
  const [fotoPreview, setFotoPreview] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoUploading, setFotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const waSplit = splitStoredWhatsapp(
    prefill?.whatsappFull || buildFullWhatsDigits(prefill?.whatsappCodigo, prefill?.whatsappLocal),
  );

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    fecha_nacimiento: '',
    genero: '',
    sede_id: '',
    deportes: [],
    certificado_fipa: false,
    bio: '',
  });
  const [waCodigo, setWaCodigo] = useState('+54');
  const [waLocal, setWaLocal] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');
    setFotoPreview('');
    setFotoUrl('');
    setForm({
      nombre: String(prefill?.nombre || '').trim(),
      apellido: String(prefill?.apellido || '').trim(),
      fecha_nacimiento: String(prefill?.fecha_nacimiento || '').trim().slice(0, 10),
      genero: String(prefill?.genero || '').trim().toLowerCase() === 'otro' ? 'no_decir' : String(prefill?.genero || '').trim().toLowerCase(),
      sede_id: '',
      deportes: [],
      certificado_fipa: false,
      bio: '',
    });
    setWaCodigo(waSplit.codigo || '+54');
    setWaLocal(waSplit.local || '');
  }, [open, prefill?.nombre, prefill?.apellido, prefill?.fecha_nacimiento, prefill?.genero, prefill?.whatsappCodigo, prefill?.whatsappLocal, prefill?.whatsappFull, waSplit.codigo, waSplit.local]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSedesLoading(true);
    fetch(`${API_BASE}/api/sedes`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (Array.isArray(data) ? data : [])
          .filter((s) => s && s.activo !== false)
          .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
        setSedes(list);
      })
      .catch(() => {
        if (!cancelled) setSedes([]);
      })
      .finally(() => {
        if (!cancelled) setSedesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
    if (!file || !userId || !String(file.type || '').startsWith('image/')) {
      setError(t('instructor.errorFoto'));
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setError(t('instructor.errorFoto'));
      return;
    }
    setFotoUploading(true);
    setError('');
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
      setError(t('instructor.errorFoto'));
      setFotoUrl('');
      setFotoPreview('');
    } finally {
      setFotoUploading(false);
    }
  };

  const onPickFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setFotoPreview(localUrl);
      void subirFoto(file);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const nombre = String(form.nombre || '').trim();
    if (!nombre) {
      setError(t('admin.formularios.completeName'));
      return;
    }
    if (!form.fecha_nacimiento) {
      setError(t('instructor.errorFechaNac'));
      return;
    }
    if (!form.genero) {
      setError(t('instructor.errorGenero'));
      return;
    }
    if (!form.sede_id) {
      setError(t('instructor.errorSede'));
      return;
    }
    if (!form.deportes.length) {
      setError(t('admin.formularios.chooseAtLeastOneSport'));
      return;
    }
    if (ensenaPadbol && !form.certificado_fipa) {
      setError(t('admin.formularios.fipaRequiredPadbol'));
      return;
    }
    const whatsapp = formatWhatsAppE164(waCodigo, waLocal);
    if (!whatsappDigitsValido(whatsapp)) {
      setError(t('instructor.errorWhatsapp'));
      return;
    }
    const bio = String(form.bio || '').trim();
    if (!bio) {
      setError(t('instructor.errorBio'));
      return;
    }
    if (bio.length > BIO_MAX) {
      setError(t('instructor.errorBioMax'));
      return;
    }
    if (!fotoUrl) {
      setError(t('instructor.errorFotoRequerida'));
      return;
    }

    setSubmitting(true);
    try {
      const row = await postSolicitudInstructor({
        accessToken,
        body: {
          sede_id: Number(form.sede_id),
          nombre,
          apellido: String(form.apellido || '').trim() || null,
          fecha_nacimiento: form.fecha_nacimiento,
          genero: form.genero,
          whatsapp,
          foto_url: fotoUrl,
          deportes: form.deportes,
          certificado_fipa: form.certificado_fipa,
          bio,
        },
      });
      setSuccess(t('instructor.solicitudExitosa'));
      onSuccess?.(row);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="instructor-fipa-overlay" role="presentation" onClick={onClose}>
      <div
        className="instructor-fipa-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructor-fipa-form-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="instructor-fipa-panel__header">
          <h2 id="instructor-fipa-form-title" className="instructor-fipa-panel__title">
            {t('instructor.formTitulo')}
          </h2>
          <button type="button" className="instructor-fipa-panel__close" aria-label={t('general.close', 'Cerrar')} onClick={onClose}>
            ×
          </button>
        </div>

        {error ? <p className="instructor-fipa-error">{error}</p> : null}
        {success ? <p className="instructor-fipa-success">{success}</p> : null}

        <form onSubmit={(ev) => void enviar(ev)}>
          <div className="instructor-fipa-field">
            <span className="instructor-fipa-label">{t('instructor.campoFoto')}</span>
            <div className="instructor-fipa-foto-wrap">
              <div className="instructor-fipa-foto-preview">
                {fotoPreview ? <img src={fotoPreview} alt="" /> : <span style={{ fontSize: 28 }}>📷</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFoto} />
              <button
                type="button"
                className="instructor-fipa-foto-btn"
                disabled={fotoUploading}
                onClick={() => fileRef.current?.click()}
              >
                {fotoUploading ? '…' : t('instructor.campoFoto')}
              </button>
            </div>
          </div>

          <div className="instructor-fipa-field">
            <label className="instructor-fipa-label" htmlFor="inst-nombre">
              {t('instructor.campoNombre')}
            </label>
            <input
              id="inst-nombre"
              className="instructor-fipa-input"
              value={form.nombre}
              onChange={(ev) => setForm((f) => ({ ...f, nombre: ev.target.value }))}
              required
            />
          </div>

          <div className="instructor-fipa-field">
            <label className="instructor-fipa-label" htmlFor="inst-apellido">
              {t('instructor.campoApellido')}
            </label>
            <input
              id="inst-apellido"
              className="instructor-fipa-input"
              value={form.apellido}
              onChange={(ev) => setForm((f) => ({ ...f, apellido: ev.target.value }))}
            />
          </div>

          <div className="instructor-fipa-field">
            <label className="instructor-fipa-label" htmlFor="inst-fecha">
              {t('instructor.campoFechaNac')}
            </label>
            <input
              id="inst-fecha"
              type="date"
              className="instructor-fipa-input"
              value={form.fecha_nacimiento}
              onChange={(ev) => setForm((f) => ({ ...f, fecha_nacimiento: ev.target.value }))}
              required
            />
          </div>

          <div className="instructor-fipa-field">
            <label className="instructor-fipa-label" htmlFor="inst-genero">
              {t('instructor.campoGenero')}
            </label>
            <select
              id="inst-genero"
              className="instructor-fipa-select"
              value={form.genero}
              onChange={(ev) => setForm((f) => ({ ...f, genero: ev.target.value }))}
              required
            >
              <option value="">{t('perfil.selectGender')}</option>
              <option value="masculino">{t('instructor.generoMasculino')}</option>
              <option value="femenino">{t('instructor.generoFemenino')}</option>
              <option value="no_decir">{t('instructor.generoNoDice')}</option>
            </select>
          </div>

          <div className="instructor-fipa-field">
            <TelefonoPaisCodigoRow
              sectionHeading={<span className="instructor-fipa-label">{t('instructor.campoWhatsapp')}</span>}
              codigoValue={waCodigo}
              onCodigoChange={setWaCodigo}
              localValue={waLocal}
              onLocalChange={(v) => setWaLocal(v.replace(/\D/g, ''))}
              selectStyle={{ width: '100%', minHeight: 44, marginBottom: 8 }}
              inputStyle={{ width: '100%', minHeight: 44 }}
            />
          </div>

          <div className="instructor-fipa-field">
            <label className="instructor-fipa-label" htmlFor="inst-sede">
              {t('instructor.campoSede')}
            </label>
            <select
              id="inst-sede"
              className="instructor-fipa-select"
              value={form.sede_id}
              onChange={(ev) => setForm((f) => ({ ...f, sede_id: ev.target.value }))}
              required
              disabled={sedesLoading}
            >
              <option value="">{sedesLoading ? t('general.loading') : t('instructor.eligeSede')}</option>
              {sedes.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre || `Sede ${s.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="instructor-fipa-field">
            <span className="instructor-fipa-label">{t('instructor.campoDeportes')}</span>
            <div className="instructor-fipa-deportes">
              {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className={`instructor-fipa-deporte-chip${form.deportes.includes(d.key) ? ' instructor-fipa-deporte-chip--on' : ''}`}
                  onClick={() => toggleDeporte(d.key)}
                >
                  <SportIcon deporte={d.key} size={16} />
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="instructor-fipa-field">
            <label className="instructor-fipa-check">
              <input
                type="checkbox"
                checked={form.certificado_fipa}
                onChange={(ev) => setForm((f) => ({ ...f, certificado_fipa: ev.target.checked }))}
              />
              <span>{t('instructor.campoCertificado')}</span>
            </label>
          </div>

          <div className="instructor-fipa-field">
            <label className="instructor-fipa-label" htmlFor="inst-bio">
              {t('instructor.campoBio')}
            </label>
            <textarea
              id="inst-bio"
              className="instructor-fipa-textarea"
              maxLength={BIO_MAX}
              value={form.bio}
              onChange={(ev) => setForm((f) => ({ ...f, bio: ev.target.value }))}
              required
            />
            <div className="instructor-fipa-char-count">
              {form.bio.length}/{BIO_MAX}
            </div>
          </div>

          <button type="submit" className="instructor-fipa-submit" disabled={submitting || fotoUploading}>
            {submitting ? t('admin.metricas.saving') : t('instructor.enviarSolicitud')}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * CTA / estado Instructor FIPA en Mi Perfil + formulario de solicitud.
 */
export default function InstructorFipaSection({ accessToken, userId, prefill = {} }) {
  const { t } = useTranslation();
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setSolicitud(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchMiSolicitudInstructor({ accessToken });
      setSolicitud(row);
    } catch {
      setSolicitud(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!accessToken || loading) return null;

  const isApproved = Boolean(solicitud?.aprobado) && solicitud?.activo !== false;
  const isPending = solicitud && !solicitud.aprobado && solicitud.activo !== false;

  return (
    <>
      <div className="instructor-fipa-card">
        <h3 className="instructor-fipa-card__title">Instructor FIPA</h3>
        {isApproved ? (
          <p className="instructor-fipa-card__status instructor-fipa-card__status--active">
            ✓ {t('instructor.instructorActivo')}
          </p>
        ) : isPending ? (
          <p className="instructor-fipa-card__status instructor-fipa-card__status--pending">
            {t('instructor.solicitudEnviada')}
          </p>
        ) : (
          <button type="button" className="instructor-fipa-card__cta" onClick={() => setFormOpen(true)}>
            {t('instructor.quieroSerInstructor')}
          </button>
        )}
      </div>

      {isApproved ? <MiPerfilProfesorSection accessToken={accessToken} userId={userId} /> : null}

      <InstructorFipaSolicitudModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={(row) => {
          setSolicitud(row);
          setFormOpen(false);
        }}
        accessToken={accessToken}
        userId={userId}
        prefill={prefill}
        t={t}
      />
    </>
  );
}
