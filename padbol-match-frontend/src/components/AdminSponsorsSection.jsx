import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES } from '../constants/paisesTelefono';

const PADBOL_RED = '#E11B22';
const ERROR_TEXT = '#E11B22';
const ERROR_BG = 'rgba(225,27,34,0.08)';

const errorBannerStyle = {
  margin: '0 0 12px',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(225,27,34,0.28)',
  borderLeft: `4px solid ${PADBOL_RED}`,
  background: ERROR_BG,
  color: ERROR_TEXT,
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1.45,
};

const successBannerStyle = {
  margin: '0 0 12px',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(22,163,74,0.35)',
  borderLeft: '4px solid #16a34a',
  background: 'rgba(22,163,74,0.08)',
  color: '#15803d',
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1.45,
};

function scrollToEl(ref, block = 'center') {
  requestAnimationFrame(() => {
    try {
      ref.current?.scrollIntoView({ behavior: 'smooth', block });
    } catch {
      /* ignore */
    }
  });
}

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'sede', label: 'Por sede' },
  { value: 'torneo', label: 'Por torneo' },
  { value: 'nacional', label: 'Por país' },
];

const PAIS_OPTIONS = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].map((p) => ({
  value: p.nombre,
  label: `${p.bandera} ${p.nombre}`,
}));

function emptyForm() {
  return {
    id: null,
    nombre: '',
    logo_url: '',
    url_destino: '',
    texto_boton: 'Ver oferta',
    scope: 'global',
    sede_id: '',
    torneo_id: '',
    pais: '',
    activo: true,
    fecha_desde: '',
    fecha_hasta: '',
  };
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginBottom: 6 };
const inputStyle = {
  width: '100%',
  maxWidth: 420,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box',
};

export default function AdminSponsorsSection() {
  const { session } = useAuth();
  const [rows, setRows] = useState([]);
  const [sedesOpts, setSedesOpts] = useState([]);
  const [torneosOpts, setTorneosOpts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  /** Errores de validación por campo (clave → mensaje). */
  const [fieldErrors, setFieldErrors] = useState({});

  const formCardRef = useRef(null);
  const nombreRef = useRef(null);
  const sedeRef = useRef(null);
  const torneoRef = useRef(null);
  const paisRef = useRef(null);
  const guardarRowRef = useRef(null);

  const clearField = (key) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const loadRefs = useCallback(async () => {
    const [sr, tr] = await Promise.all([
      supabase.from('sedes').select('id, nombre').order('nombre', { ascending: true }),
      supabase.from('torneos').select('id, nombre, sede_id').order('id', { ascending: false }).limit(400),
    ]);
    if (!sr.error && Array.isArray(sr.data)) setSedesOpts(sr.data);
    if (!tr.error && Array.isArray(tr.data)) setTorneosOpts(tr.data);
  }, []);

  const loadSponsors = useCallback(async () => {
    setLoading(true);
    setMsg('');
    const { data, error } = await supabase.from('sponsors').select('*').order('id', { ascending: false });
    if (error) {
      setMsg(error.message);
      setRows([]);
      scrollToEl(formCardRef);
    } else {
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRefs();
    void loadSponsors();
  }, [loadRefs, loadSponsors]);

  const resetForm = () => {
    setForm(emptyForm());
    setFieldErrors({});
    setMsg('');
  };

  const editRow = (r) => {
    setForm({
      id: r.id,
      nombre: String(r.nombre || ''),
      logo_url: String(r.logo_url || ''),
      url_destino: String(r.url_destino || ''),
      texto_boton: String(r.texto_boton || 'Ver oferta'),
      scope: String(r.scope || 'global').toLowerCase(),
      sede_id: r.sede_id != null ? String(r.sede_id) : '',
      torneo_id: r.torneo_id != null ? String(r.torneo_id) : '',
      pais: String(r.pais || ''),
      activo: r.activo !== false,
      fecha_desde: r.fecha_desde ? String(r.fecha_desde).slice(0, 10) : '',
      fecha_hasta: r.fecha_hasta ? String(r.fecha_hasta).slice(0, 10) : '',
    });
    setMsg('');
    setFieldErrors({});
    setTimeout(() => {
      try {
        formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        /* ignore */
      }
    }, 0);
  };

  const onLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setMsg('Elige una imagen (JPEG, PNG, WebP o GIF).');
      scrollToEl(formCardRef);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMsg('Máximo 4MB para el logo.');
      scrollToEl(formCardRef);
      return;
    }
    setUploading(true);
    setMsg('');
    const safe = String(file.name || 'logo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from('sponsors').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
    });
    if (upErr) {
      setMsg(`Subida: ${upErr.message}`);
      scrollToEl(formCardRef);
      setUploading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('sponsors').getPublicUrl(path);
    setForm((p) => ({ ...p, logo_url: publicUrl }));
    setUploading(false);
    setMsg('Logo subido');
    setTimeout(() => setMsg(''), 2500);
  };

  const guardar = async () => {
    setMsg('');
    setFieldErrors({});

    if (!session?.user?.id) {
      setFieldErrors({ _session: 'Iniciá sesión como super admin para guardar.' });
      scrollToEl(guardarRowRef);
      return;
    }

    const nombre = String(form.nombre || '').trim();
    if (!nombre) {
      setFieldErrors({ nombre: 'Indicá el nombre de la marca.' });
      scrollToEl(nombreRef);
      return;
    }

    const scope = String(form.scope || 'global').toLowerCase();
    const sedeId = scope === 'sede' && form.sede_id ? parseInt(String(form.sede_id), 10) : null;
    const torneoId = scope === 'torneo' && form.torneo_id ? parseInt(String(form.torneo_id), 10) : null;
    const pais = scope === 'nacional' ? String(form.pais || '').trim() : null;

    if (scope === 'sede' && (!sedeId || sedeId <= 0)) {
      setFieldErrors({ sede_id: 'Elegí una sede.' });
      scrollToEl(sedeRef);
      return;
    }
    if (scope === 'torneo' && (!torneoId || torneoId <= 0)) {
      setFieldErrors({ torneo_id: 'Elegí un torneo.' });
      scrollToEl(torneoRef);
      return;
    }
    if (scope === 'nacional' && !pais) {
      setFieldErrors({ pais: 'Elegí un país.' });
      scrollToEl(paisRef);
      return;
    }

    const payload = {
      nombre,
      logo_url: String(form.logo_url || '').trim() || null,
      url_destino: String(form.url_destino || '').trim() || null,
      texto_boton: String(form.texto_boton || '').trim() || 'Ver oferta',
      scope,
      sede_id: scope === 'sede' ? sedeId : null,
      torneo_id: scope === 'torneo' ? torneoId : null,
      pais: scope === 'nacional' ? pais : null,
      activo: Boolean(form.activo),
      fecha_desde: form.fecha_desde ? String(form.fecha_desde).slice(0, 10) : null,
      fecha_hasta: form.fecha_hasta ? String(form.fecha_hasta).slice(0, 10) : null,
    };

    setSaving(true);
    setMsg('');
    try {
      if (form.id != null && form.id !== '') {
        const { error } = await supabase.from('sponsors').update(payload).eq('id', form.id);
        if (error) throw error;
        setFieldErrors({});
        setMsg('Sponsor actualizado');
      } else {
        const insert = { ...payload, creado_por: session.user.id };
        const { error } = await supabase.from('sponsors').insert([insert]);
        if (error) throw error;
        setMsg('Sponsor creado');
        resetForm();
      }
      await loadSponsors();
    } catch (err) {
      setMsg(err?.message || String(err));
      scrollToEl(formCardRef);
    } finally {
      setSaving(false);
    }
  };

  const desactivar = async (id) => {
    if (!window.confirm('¿Desactivar este sponsor? Dejará de mostrarse en la app.')) return;
    const { error } = await supabase.from('sponsors').update({ activo: false }).eq('id', id);
    if (error) {
      setMsg(error.message);
      scrollToEl(formCardRef);
      return;
    }
    setMsg('Desactivado');
    if (form.id === id) resetForm();
    await loadSponsors();
  };

  const eliminar = async (r) => {
    const nombre = String(r?.nombre || '').trim() || 'sin nombre';
    if (
      !window.confirm(`¿Eliminar el sponsor ${nombre}? Esta acción no se puede deshacer.`)
    ) {
      return;
    }
    const { error } = await supabase.from('sponsors').delete().eq('id', r.id);
    if (error) {
      setMsg(error.message);
      scrollToEl(formCardRef);
      return;
    }
    if (String(form.id) === String(r.id)) resetForm();
    setMsg('Sponsor eliminado');
    await loadSponsors();
  };

  const torneoLabel = useCallback((t) => {
    const sid = t.sede_id != null ? ` · sede ${t.sede_id}` : '';
    return `${String(t.nombre || 'Torneo').slice(0, 80)} (id ${t.id})${sid}`;
  }, []);

  const fieldHintStyle = {
    margin: '6px 0 0',
    fontSize: 13,
    fontWeight: 600,
    color: ERROR_TEXT,
    lineHeight: 1.35,
  };

  const bannerIsSuccess =
    Boolean(msg) &&
    /logo subido|sponsor actualizado|sponsor creado|sponsor eliminado|^desactivado$/i.test(String(msg).trim());

  const inputErrBorder = (key) => (fieldErrors[key] ? `2px solid ${PADBOL_RED}` : '1px solid #cbd5e1');

  return (
    <div style={{ marginTop: 28, marginBottom: 32, maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 12px', paddingBottom: 8, color: 'rgba(255,255,255,0.95)' }}>🤝 Sponsors</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45 }}>
        Patrocinios por alcance: torneo tiene prioridad sobre sede, país y global.
      </p>

      {msg ? (
        <div role={bannerIsSuccess ? 'status' : 'alert'} style={bannerIsSuccess ? successBannerStyle : errorBannerStyle}>
          {msg.replace(/^✅\s*/i, '')}
        </div>
      ) : null}

      <div
        ref={formCardRef}
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 18,
          marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#0f172a' }}>
          {form.id != null && form.id !== '' ? 'Editar sponsor' : 'Nuevo sponsor'}
        </h3>

        <div ref={nombreRef} style={{ marginBottom: 12 }}>
          <label style={{ ...labelStyle, color: '#334155' }}>Nombre de la marca *</label>
          <input
            style={{
              ...inputStyle,
              color: '#0f172a',
              marginBottom: 0,
              border: inputErrBorder('nombre'),
            }}
            value={form.nombre}
            onChange={(e) => {
              clearField('nombre');
              clearField('_session');
              setForm((p) => ({ ...p, nombre: e.target.value }));
            }}
            placeholder="Ej: Marca deportiva"
            aria-invalid={Boolean(fieldErrors.nombre)}
            aria-describedby={fieldErrors.nombre ? 'sponsor-err-nombre' : undefined}
          />
          {fieldErrors.nombre ? (
            <p id="sponsor-err-nombre" style={fieldHintStyle}>
              {fieldErrors.nombre}
            </p>
          ) : null}
        </div>

        <label style={{ ...labelStyle, color: '#334155' }}>Logo (bucket sponsors)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input type="file" accept="image/*" disabled={uploading || saving} onChange={(e) => void onLogoFile(e)} />
          {form.logo_url ? (
            <img src={form.logo_url} alt="" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
          ) : null}
        </div>
        <input
          style={{ ...inputStyle, color: '#0f172a', marginBottom: 12 }}
          value={form.logo_url}
          onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
          placeholder="URL pública del logo (o sube archivo arriba)"
        />

        <label style={{ ...labelStyle, color: '#334155' }}>URL destino (opcional)</label>
        <input
          style={{ ...inputStyle, color: '#0f172a', marginBottom: 12 }}
          value={form.url_destino}
          onChange={(e) => setForm((p) => ({ ...p, url_destino: e.target.value }))}
          placeholder="https://…"
        />

        <label style={{ ...labelStyle, color: '#334155' }}>Texto del botón</label>
        <input
          style={{ ...inputStyle, color: '#0f172a', marginBottom: 12 }}
          value={form.texto_boton}
          onChange={(e) => setForm((p) => ({ ...p, texto_boton: e.target.value }))}
          placeholder="Ver oferta"
        />

        <label style={{ ...labelStyle, color: '#334155' }}>Scope</label>
        <select
          style={{ ...inputStyle, marginBottom: 12, cursor: 'pointer' }}
          value={form.scope}
          onChange={(e) => {
            const v = e.target.value;
            setForm((p) => ({ ...p, scope: v }));
            setFieldErrors((fe) => {
              const n = { ...fe };
              delete n.sede_id;
              delete n.torneo_id;
              delete n.pais;
              return n;
            });
          }}
        >
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {form.scope === 'sede' ? (
          <div ref={sedeRef} style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, color: '#334155' }}>Sede</label>
            <select
              style={{
                ...inputStyle,
                marginBottom: 0,
                cursor: 'pointer',
                border: inputErrBorder('sede_id'),
              }}
              value={form.sede_id}
              onChange={(e) => {
                clearField('sede_id');
                setForm((p) => ({ ...p, sede_id: e.target.value }));
              }}
              aria-invalid={Boolean(fieldErrors.sede_id)}
              aria-describedby={fieldErrors.sede_id ? 'sponsor-err-sede' : undefined}
            >
              <option value="">— Elegir —</option>
              {sedesOpts.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {fieldErrors.sede_id ? (
              <p id="sponsor-err-sede" style={fieldHintStyle}>
                {fieldErrors.sede_id}
              </p>
            ) : null}
          </div>
        ) : null}

        {form.scope === 'torneo' ? (
          <div ref={torneoRef} style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, color: '#334155' }}>Torneo</label>
            <select
              style={{
                ...inputStyle,
                marginBottom: 0,
                cursor: 'pointer',
                border: inputErrBorder('torneo_id'),
              }}
              value={form.torneo_id}
              onChange={(e) => {
                clearField('torneo_id');
                setForm((p) => ({ ...p, torneo_id: e.target.value }));
              }}
              aria-invalid={Boolean(fieldErrors.torneo_id)}
              aria-describedby={fieldErrors.torneo_id ? 'sponsor-err-torneo' : undefined}
            >
              <option value="">— Elegir —</option>
              {torneosOpts.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {torneoLabel(t)}
                </option>
              ))}
            </select>
            {fieldErrors.torneo_id ? (
              <p id="sponsor-err-torneo" style={fieldHintStyle}>
                {fieldErrors.torneo_id}
              </p>
            ) : null}
          </div>
        ) : null}

        {form.scope === 'nacional' ? (
          <div ref={paisRef} style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, color: '#334155' }}>País</label>
            <select
              style={{
                ...inputStyle,
                marginBottom: 0,
                cursor: 'pointer',
                border: inputErrBorder('pais'),
              }}
              value={form.pais}
              onChange={(e) => {
                clearField('pais');
                setForm((p) => ({ ...p, pais: e.target.value }));
              }}
              aria-invalid={Boolean(fieldErrors.pais)}
              aria-describedby={fieldErrors.pais ? 'sponsor-err-pais' : undefined}
            >
              <option value="">— Elegir —</option>
              {PAIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {fieldErrors.pais ? (
              <p id="sponsor-err-pais" style={fieldHintStyle}>
                {fieldErrors.pais}
              </p>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
          <div>
            <label style={{ ...labelStyle, color: '#334155' }}>Fecha desde (opcional)</label>
            <input
              type="date"
              style={{ ...inputStyle, color: '#0f172a' }}
              value={form.fecha_desde}
              onChange={(e) => setForm((p) => ({ ...p, fecha_desde: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, color: '#334155' }}>Fecha hasta (opcional)</label>
            <input
              type="date"
              style={{ ...inputStyle, color: '#0f172a' }}
              value={form.fecha_hasta}
              onChange={(e) => setForm((p) => ({ ...p, fecha_hasta: e.target.value }))}
            />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontWeight: 700, color: '#334155' }}>
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))}
          />
          Activo
        </label>

        <div ref={guardarRowRef}>
          {fieldErrors._session ? (
            <div
              role="alert"
              style={{
                ...errorBannerStyle,
                marginBottom: 12,
              }}
            >
              {fieldErrors._session}
            </div>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              disabled={saving || uploading}
              onClick={() => void guardar()}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                border: 'none',
                background: saving || uploading ? '#94a3b8' : PADBOL_RED,
                color: '#fff',
                fontWeight: 800,
                cursor: saving || uploading ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {form.id != null && form.id !== '' ? (
              <button
                type="button"
                disabled={saving}
                onClick={resetForm}
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#e2e8f0',
                  color: '#334155',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: 720,
            borderCollapse: 'collapse',
            background: 'white',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <thead>
            <tr style={{ background: PADBOL_RED, color: '#fff' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13 }}>Marca</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13 }}>Scope</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13 }}>Activo</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                  No hay sponsors. Creá uno con el formulario de arriba.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee', background: i % 2 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.logo_url ? (
                        <img src={r.logo_url} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                      ) : null}
                      {r.nombre}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#334155' }}>
                    {String(r.scope || '')}
                    {r.sede_id != null ? ` · sede ${r.sede_id}` : ''}
                    {r.torneo_id != null ? ` · torneo ${r.torneo_id}` : ''}
                    {r.pais ? ` · ${r.pais}` : ''}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: r.activo ? '#15803d' : '#b91c1c' }}>
                    {r.activo ? 'Sí' : 'No'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => editRow(r)}
                      style={{
                        padding: '6px 10px',
                        marginRight: 6,
                        borderRadius: 6,
                        border: 'none',
                        background: PADBOL_RED,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void eliminar(r)}
                      style={{
                        padding: '6px 10px',
                        marginRight: 6,
                        borderRadius: 6,
                        border: 'none',
                        background: '#b91c1c',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Eliminar
                    </button>
                    {r.activo ? (
                      <button
                        type="button"
                        onClick={() => void desactivar(r.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#f1f5f9',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Desactivar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
