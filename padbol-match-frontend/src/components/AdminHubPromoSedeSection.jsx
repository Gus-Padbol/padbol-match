import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import './AdminHubPromoSedeSection.css';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Edición de la promo «Del club» en Jugar (tab Mi Sede, admin_club / super_admin).
 * @param {{ sedeId: number, onDirtyChange?: (dirty: boolean) => void }} props
 */
export default function AdminHubPromoSedeSection({ sedeId, onDirtyChange }) {
  const { t } = useTranslation();
  const emptyForm = useCallback(
    () => ({
      activo: false,
      imagen_url: '',
      titulo: '',
      subtitulo: '',
      texto_boton: t('admin.hub.seeMore'),
      url_destino: '',
    }),
    [t],
  );
  const textFields = useMemo(
    () => [
      { k: 'titulo', label: t('admin.hub.title'), ph: t('admin.hub.titlePlaceholder') },
      { k: 'subtitulo', label: t('admin.hub.subtitle'), ph: t('admin.hub.optional') },
      { k: 'url_destino', label: t('admin.hub.clickUrl'), ph: t('admin.hub.urlPlaceholder') },
    ],
    [t],
  );
  const sid = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;
  const [rowId, setRowId] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [imagenUploading, setImagenUploading] = useState(false);
  const imagenFileRef = useRef(null);
  const savedSnapshotRef = useRef('');
  const BUTTON_TEXT_OPTIONS = [
    t('admin.hub.seeMore'),
    t('admin.hub.bookNow', 'Reservar ahora'),
    t('admin.hub.buyNow', 'Comprar'),
  ];

  const load = useCallback(async () => {
    if (sid == null) {
      setRowId(null);
      const next = emptyForm();
      savedSnapshotRef.current = JSON.stringify(next);
      setForm(next);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    const { data, error } = await supabase.from('hub_promo_sede').select('*').eq('sede_id', sid).maybeSingle();
    setLoading(false);
    if (error) {
      setMsg(`⚠️ ${t('admin.hub.hubLoadFailed')}`);
      setRowId(null);
      const next = emptyForm();
      savedSnapshotRef.current = JSON.stringify(next);
      setForm(next);
      return;
    }
    if (!data) {
      setRowId(null);
      const next = { ...emptyForm(), texto_boton: t('admin.hub.seeMore') };
      savedSnapshotRef.current = JSON.stringify(next);
      setForm(next);
      return;
    }
    setRowId(data.id || null);
    const next = {
      activo: Boolean(data.activo),
      imagen_url: String(data.imagen_url || '').trim(),
      titulo: String(data.titulo || '').trim(),
      subtitulo: String(data.subtitulo || '').trim(),
      texto_boton: String(data.texto_boton || '').trim() || t('admin.hub.seeMore'),
      url_destino: String(data.url_destino || '').trim(),
    };
    savedSnapshotRef.current = JSON.stringify(next);
    setForm(next);
  }, [sid, emptyForm, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!onDirtyChange) return undefined;
    onDirtyChange(!loading && JSON.stringify(form) !== savedSnapshotRef.current);
    return undefined;
  }, [form, loading, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const patch = useCallback((partial) => {
    setForm((p) => ({ ...p, ...partial }));
  }, []);

  const canSave = useMemo(() => {
    if (sid == null) return false;
    if (!String(form.titulo || '').trim()) return false;
    if (!String(form.url_destino || '').trim()) return false;
    return true;
  }, [sid, form.titulo, form.url_destino]);

  const extFromFile = (file) => {
    const t = String(file?.type || '');
    if (t.includes('png')) return 'png';
    if (t.includes('webp')) return 'webp';
    if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
    const n = String(file?.name || '');
    const m = n.match(/\.([a-zA-Z0-9]+)$/);
    return m ? m[1].toLowerCase().slice(0, 5) : 'jpg';
  };

  const onImagenFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || sid == null) return;
    if (!String(file.type || '').startsWith('image/')) {
      setMsg(t('admin.hub.chooseImageWarn'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMsg(t('admin.hub.imageOver2mb'));
      return;
    }
    setImagenUploading(true);
    setMsg('');
    const ext = extFromFile(file);
    const path = `hub-promo/${sid}/${Date.now()}.${ext}`;
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
      if (!url) throw new Error(t('admin.hub.noPublicUrl'));
      patch({ imagen_url: url });
      setMsg(t('admin.hub.imageUploaded', { defaultValue: '✅ Imagen subida' }));
      window.setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg(`⚠️ ${t('admin.hub.imageUploadFailed')}`);
    } finally {
      setImagenUploading(false);
    }
  };

  const guardar = async () => {
    if (!canSave || sid == null) {
      setMsg(`⚠️ ${t('admin.formularios.completePromoTitleUrl')}`);
      return;
    }
    setSaving(true);
    setMsg('');
    const payload = {
      sede_id: sid,
      activo: Boolean(form.activo),
      imagen_url: String(form.imagen_url || '').trim() || null,
      titulo: String(form.titulo || '').trim(),
      subtitulo: String(form.subtitulo || '').trim() || null,
      texto_boton: String(form.texto_boton || '').trim() || t('admin.hub.seeMore'),
      url_destino: String(form.url_destino || '').trim(),
      updated_at: new Date().toISOString(),
    };
    try {
      if (rowId) {
        const { error: uErr } = await supabase.from('hub_promo_sede').update(payload).eq('id', rowId);
        if (uErr) throw uErr;
      } else {
        const { data: ins, error: iErr } = await supabase.from('hub_promo_sede').insert(payload).select('id').single();
        if (iErr) throw iErr;
        if (ins?.id) setRowId(ins.id);
      }
      savedSnapshotRef.current = JSON.stringify(form);
      onDirtyChange?.(false);
      setMsg(t('admin.hub.promoSaved', { defaultValue: '✅ Promo guardada' }));
      window.setTimeout(() => setMsg(''), 3500);
    } catch {
      setMsg(`⚠️ ${t('general.error')}`);
    } finally {
      setSaving(false);
    }
  };

  if (sid == null) return null;

  return (
    <div className="admin-hub-promo-sede">
      <h3 className="admin-hub-promo-sede__title">{t('admin.hub.promoJugarTitle')}</h3>
      <div className="admin-hub-promo-sede__panel">
        <p className="admin-hub-promo-sede__intro">{t('admin.hub.promoJugarIntro')}</p>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{t('general.loading')}</p>
        ) : (
          <>
            <label className="admin-hub-promo-sede__check-row">
              <input type="checkbox" checked={form.activo} onChange={(e) => patch({ activo: e.target.checked })} />
              <span>{t('admin.hub.promoActive')}</span>
            </label>

            <div className="admin-hub-promo-sede__field">
              <label className="admin-hub-promo-sede__label" htmlFor="hub-promo-imagen-url">
                {t('admin.hub.imageUrlCardBackground')}
              </label>
              <input
                id="hub-promo-imagen-url"
                className="admin-hub-promo-sede__input"
                value={form.imagen_url}
                onChange={(e) => patch({ imagen_url: e.target.value })}
                placeholder="https://…"
                autoComplete="off"
              />
              <input
                ref={imagenFileRef}
                type="file"
                className="admin-hub-promo-sede__file"
                accept="image/*"
                capture="environment"
                aria-label={t('admin.hub.uploadFromDevice')}
                onChange={(ev) => void onImagenFileChange(ev)}
              />
              <button
                type="button"
                className="admin-hub-promo-sede__upload-btn"
                disabled={imagenUploading}
                onClick={() => imagenFileRef.current?.click()}
              >
                {imagenUploading ? t('admin.hub.uploading') : t('admin.hub.uploadFromDevice')}
              </button>
              {String(form.imagen_url || '').trim() ? (
                <button
                  type="button"
                  className="admin-hub-promo-sede__remove-btn"
                  onClick={() => patch({ imagen_url: '' })}
                >
                  {t('admin.hub.removeImage', 'Quitar imagen')}
                </button>
              ) : null}
              <p className="admin-hub-promo-sede__intro" style={{ marginTop: '8px', marginBottom: 0 }}>
                {t('admin.hub.imageStorageHint')}
              </p>
              {String(form.imagen_url || '').trim() ? (
                <div className="admin-hub-promo-sede__preview">
                  <img
                    src={form.imagen_url}
                    alt={t('admin.hub.promoPreviewAria')}
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="admin-hub-promo-sede__field">
              <label className="admin-hub-promo-sede__label" htmlFor="hub-promo-texto-boton">
                {t('admin.hub.buttonText')}
              </label>
              <select
                id="hub-promo-texto-boton"
                className="admin-hub-promo-sede__input"
                value={form.texto_boton}
                onChange={(e) => patch({ texto_boton: e.target.value })}
              >
                {BUTTON_TEXT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            {textFields.map(({ k, label, ph }) => (
              <div key={k} className="admin-hub-promo-sede__field">
                <label className="admin-hub-promo-sede__label" htmlFor={`hub-promo-${k}`}>
                  {label}
                </label>
                <input
                  id={`hub-promo-${k}`}
                  className="admin-hub-promo-sede__input"
                  value={form[k]}
                  onChange={(e) => patch({ [k]: e.target.value })}
                  placeholder={ph}
                  autoComplete="off"
                />
              </div>
            ))}

            <button
              type="button"
              className="admin-hub-promo-sede__primary"
              disabled={saving || !canSave}
              onClick={() => void guardar()}
            >
              {saving ? t('admin.metricas.saving') : t('admin.hub.savePromo')}
            </button>
            {msg ? (
              <p
                className={`admin-hub-promo-sede__msg ${
                  msg.startsWith('✅') ? 'admin-hub-promo-sede__msg--ok' : 'admin-hub-promo-sede__msg--err'
                }`}
              >
                {msg}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
