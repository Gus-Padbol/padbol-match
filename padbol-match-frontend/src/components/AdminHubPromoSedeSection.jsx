import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import './AdminHubPromoSedeSection.css';

const emptyForm = () => ({
  activo: false,
  imagen_url: '',
  titulo: '',
  subtitulo: '',
  texto_boton: 'Ver más',
  url_destino: '',
});

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const TEXT_FIELDS = [
  { k: 'titulo', label: 'Título', ph: 'Ej: Pro shop del club' },
  { k: 'subtitulo', label: 'Subtítulo', ph: 'Opcional' },
  { k: 'texto_boton', label: 'Texto del botón', ph: 'Ver más' },
  { k: 'url_destino', label: 'URL al hacer clic', ph: 'https://… o /ruta' },
];

/**
 * Edición de la promo «Del club» en Jugar (tab Mi Sede, admin_club / super_admin).
 * @param {{ sedeId: number }} props
 */
export default function AdminHubPromoSedeSection({ sedeId }) {
  const sid = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;
  const [rowId, setRowId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [imagenUploading, setImagenUploading] = useState(false);
  const imagenFileRef = useRef(null);

  const load = useCallback(async () => {
    if (sid == null) {
      setRowId(null);
      setForm(emptyForm());
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    const { data, error } = await supabase.from('hub_promo_sede').select('*').eq('sede_id', sid).maybeSingle();
    setLoading(false);
    if (error) {
      setMsg(`⚠️ ${error.message}`);
      setRowId(null);
      setForm(emptyForm());
      return;
    }
    if (!data) {
      setRowId(null);
      setForm({ ...emptyForm(), texto_boton: 'Ver más' });
      return;
    }
    setRowId(data.id || null);
    setForm({
      activo: Boolean(data.activo),
      imagen_url: String(data.imagen_url || '').trim(),
      titulo: String(data.titulo || '').trim(),
      subtitulo: String(data.subtitulo || '').trim(),
      texto_boton: String(data.texto_boton || '').trim() || 'Ver más',
      url_destino: String(data.url_destino || '').trim(),
    });
  }, [sid]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setMsg('⚠️ Elegí un archivo de imagen');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMsg('⚠️ La imagen supera los 2MB');
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
      if (!url) throw new Error('No se obtuvo URL pública');
      patch({ imagen_url: url });
      setMsg('✅ Imagen subida');
      window.setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(`⚠️ ${err?.message || String(err)}`);
    } finally {
      setImagenUploading(false);
    }
  };

  const guardar = async () => {
    if (!canSave || sid == null) {
      setMsg('⚠️ Completá al menos título y URL de destino.');
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
      texto_boton: String(form.texto_boton || '').trim() || 'Ver más',
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
      setMsg('✅ Promo guardada');
      window.setTimeout(() => setMsg(''), 3500);
    } catch (err) {
      setMsg(`⚠️ ${err?.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (sid == null) return null;

  return (
    <div className="admin-hub-promo-sede">
      <h3 className="admin-hub-promo-sede__title">Promo en «Jugar» (hub)</h3>
      <div className="admin-hub-promo-sede__panel">
        <p className="admin-hub-promo-sede__intro">
          Card promocional bajo las tres acciones (Reservar / Buscar / Armar) en la pantalla <strong>Jugar</strong>. Solo se
          muestra a jugadores de tu sede si está <strong>activa</strong> y con datos mínimos.
        </p>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cargando…</p>
        ) : (
          <>
            <label className="admin-hub-promo-sede__check-row">
              <input type="checkbox" checked={form.activo} onChange={(e) => patch({ activo: e.target.checked })} />
              <span>Promo activa</span>
            </label>

            <div className="admin-hub-promo-sede__field">
              <label className="admin-hub-promo-sede__label" htmlFor="hub-promo-imagen-url">
                URL de imagen (fondo de la card)
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
                aria-label="Subir imagen desde el dispositivo"
                onChange={(ev) => void onImagenFileChange(ev)}
              />
              <button
                type="button"
                className="admin-hub-promo-sede__upload-btn"
                disabled={imagenUploading}
                onClick={() => imagenFileRef.current?.click()}
              >
                {imagenUploading ? '⏳ Subiendo…' : '📷 Subir desde dispositivo'}
              </button>
              <p className="admin-hub-promo-sede__intro" style={{ marginTop: '8px', marginBottom: 0 }}>
                La imagen se guarda en el almacenamiento del club (bucket sedes). Podés pegar una URL externa o subir un archivo.
              </p>
              {String(form.imagen_url || '').trim() ? (
                <div className="admin-hub-promo-sede__preview">
                  <img
                    src={form.imagen_url}
                    alt="Vista previa de la imagen de la promo"
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
            </div>

            {TEXT_FIELDS.map(({ k, label, ph }) => (
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
              {saving ? 'Guardando…' : 'Guardar promo'}
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
