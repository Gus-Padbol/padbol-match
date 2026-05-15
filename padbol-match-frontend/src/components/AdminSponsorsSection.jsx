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

const DEFAULT_SPONSOR_CUPOS = {
  max_global: 5,
  max_por_sede_starter: 2,
  max_por_sede_pro: 5,
  max_por_sede_elite: 20,
  max_por_nacion: 3,
};

/** Igual que en NuevaSedeSuperBottomSheet: plan por cantidad de canchas de la sede. */
function matchPlanForTotal(planes, total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const list = [...(planes || [])].sort((a, b) => Number(a.canchas_min) - Number(b.canchas_min));
  for (const p of list) {
    const min = Number(p.canchas_min);
    const maxRaw = p.canchas_max;
    const max = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
    if (!Number.isFinite(min) || min < 0) continue;
    if (n < min) continue;
    if (max != null && Number.isFinite(max) && n > max) continue;
    return p;
  }
  return null;
}

function maxPorSedeSegunNombrePlan(nombrePlan, cupos) {
  const n = String(nombrePlan || '').trim().toLowerCase();
  if (n === 'enterprise') return cupos.max_por_sede_elite;
  if (n === 'elite') return cupos.max_por_sede_elite;
  if (n === 'pro') return cupos.max_por_sede_pro;
  if (n === 'starter') return cupos.max_por_sede_starter;
  return cupos.max_por_sede_starter;
}

function normalizeScopeVal(raw) {
  return String(raw || '').trim().toLowerCase();
}

function emptyForm() {
  return {
    id: null,
    nombre: '',
    logo_url: '',
    url_destino: '',
    texto_boton: 'Ver oferta',
    descripcion: '',
    scope: 'global',
    sede_id: '',
    torneo_id: '',
    pais: '',
    activo: true,
    fecha_desde: '',
    fecha_hasta: '',
  };
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 };
const inputStyle = {
  width: '100%',
  maxWidth: 420,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box',
};

export default function AdminSponsorsSection({ isSuperAdmin = false }) {
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
  const [cupos, setCupos] = useState(() => ({ ...DEFAULT_SPONSOR_CUPOS }));
  const [cuposSaving, setCuposSaving] = useState(false);
  const [cuposMsg, setCuposMsg] = useState('');
  const [planPricingRows, setPlanPricingRows] = useState([]);

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
    const [sr, tr, pr] = await Promise.all([
      supabase.from('sedes').select('id, nombre, cantidad_canchas').order('nombre', { ascending: true }),
      supabase.from('torneos').select('id, nombre, sede_id').order('id', { ascending: false }).limit(400),
      supabase
        .from('plan_pricing')
        .select('nombre, canchas_min, canchas_max')
        .eq('activo', true)
        .order('canchas_min', { ascending: true }),
    ]);
    if (!sr.error && Array.isArray(sr.data)) setSedesOpts(sr.data);
    if (!tr.error && Array.isArray(tr.data)) setTorneosOpts(tr.data);
    if (!pr.error && Array.isArray(pr.data)) setPlanPricingRows(pr.data);
    else setPlanPricingRows([]);
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

  const loadSponsorCupos = useCallback(async () => {
    setCuposMsg('');
    const { data, error } = await supabase.from('sponsor_config').select('*').eq('id', 1).maybeSingle();
    if (error) {
      setCuposMsg(error.message);
      return;
    }
    if (!data) return;
    setCupos({
      max_global: Number(data.max_global) || DEFAULT_SPONSOR_CUPOS.max_global,
      max_por_sede_starter: Number(data.max_por_sede_starter) || DEFAULT_SPONSOR_CUPOS.max_por_sede_starter,
      max_por_sede_pro: Number(data.max_por_sede_pro) || DEFAULT_SPONSOR_CUPOS.max_por_sede_pro,
      max_por_sede_elite: Number(data.max_por_sede_elite) || DEFAULT_SPONSOR_CUPOS.max_por_sede_elite,
      max_por_nacion: Number(data.max_por_nacion) || DEFAULT_SPONSOR_CUPOS.max_por_nacion,
    });
  }, []);

  useEffect(() => {
    void loadRefs();
    void loadSponsors();
    void loadSponsorCupos();
  }, [loadRefs, loadSponsors, loadSponsorCupos]);

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
      descripcion: String(r.descripcion || ''),
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
    try {
      const { data: uploadData, error: upErr } = await supabase.storage.from('sponsors').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });
      if (upErr) {
        setMsg(`Subida: ${upErr.message}`);
        scrollToEl(formCardRef);
        return;
      }
      const filePath = uploadData?.path != null && String(uploadData.path).trim() !== '' ? String(uploadData.path).trim() : path;
      const { data } = supabase.storage.from('sponsors').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl != null ? String(data.publicUrl).trim() : '';
      if (!publicUrl) {
        setMsg('No se pudo obtener la URL pública del logo. Revisá que el bucket sponsors sea público.');
        scrollToEl(formCardRef);
        return;
      }
      setForm((p) => ({ ...p, logo_url: publicUrl }));
      setMsg('Logo subido');
      setTimeout(() => setMsg(''), 2500);
    } finally {
      setUploading(false);
    }
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
      descripcion: String(form.descripcion || '').trim() || null,
      scope,
      sede_id: scope === 'sede' ? sedeId : null,
      torneo_id: scope === 'torneo' ? torneoId : null,
      pais: scope === 'nacional' ? pais : null,
      activo: Boolean(form.activo),
      fecha_desde: form.fecha_desde ? String(form.fecha_desde).slice(0, 10) : null,
      fecha_hasta: form.fecha_hasta ? String(form.fecha_hasta).slice(0, 10) : null,
    };

    const isNew = form.id == null || form.id === '';
    if (isNew && payload.activo) {
      if (scope === 'global') {
        const activosGlobales = rows.filter(
          (r) => normalizeScopeVal(r.scope) === 'global' && r.activo !== false,
        ).length;
        const maxG = Math.max(0, parseInt(String(cupos.max_global), 10) || 0);
        if (activosGlobales >= maxG) {
          setMsg('Límite de sponsors alcanzado para este plan');
          scrollToEl(formCardRef);
          return;
        }
      }
      if (scope === 'sede' && sedeId) {
        const sedeRow = sedesOpts.find((s) => Number(s.id) === Number(sedeId));
        const totalCanchas = Math.max(0, Math.floor(Number(sedeRow?.cantidad_canchas) || 0));
        const canchasParaPlan = totalCanchas > 0 ? totalCanchas : 1;
        const plan = matchPlanForTotal(planPricingRows, canchasParaPlan);
        const maxSede = Math.max(0, maxPorSedeSegunNombrePlan(plan?.nombre, cupos));
        const activosEnSede = rows.filter(
          (r) =>
            normalizeScopeVal(r.scope) === 'sede' &&
            Number(r.sede_id) === Number(sedeId) &&
            r.activo !== false,
        ).length;
        if (activosEnSede >= maxSede) {
          setMsg('Límite de sponsors alcanzado para este plan');
          scrollToEl(formCardRef);
          return;
        }
      }
    }

    setSaving(true);
    setMsg('');
    try {
      if (form.id != null && form.id !== '') {
        const { error } = await supabase.from('sponsors').update(payload).eq('id', form.id);
        if (error) throw error;
        setFieldErrors({});
        setMsg('Sponsor actualizado');
      } else {
        const insert = {
          ...payload,
          creado_por: session.user.id,
          aprobado: Boolean(isSuperAdmin),
        };
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

  const guardarCupos = async () => {
    setCuposMsg('');
    setCuposSaving(true);
    try {
      const payload = {
        max_global: Math.max(0, parseInt(String(cupos.max_global), 10) || 0),
        max_por_sede_starter: Math.max(0, parseInt(String(cupos.max_por_sede_starter), 10) || 0),
        max_por_sede_pro: Math.max(0, parseInt(String(cupos.max_por_sede_pro), 10) || 0),
        max_por_sede_elite: Math.max(0, parseInt(String(cupos.max_por_sede_elite), 10) || 0),
        max_por_nacion: Math.max(0, parseInt(String(cupos.max_por_nacion), 10) || 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('sponsor_config').update(payload).eq('id', 1);
      if (error) throw error;
      setCuposMsg('✅ Configuración de cupos guardada');
      setTimeout(() => setCuposMsg(''), 4000);
      await loadSponsorCupos();
    } catch (err) {
      setCuposMsg(err?.message || String(err));
    } finally {
      setCuposSaving(false);
    }
  };

  const aprobarSponsor = async (id) => {
    setMsg('');
    const { error } = await supabase.from('sponsors').update({ aprobado: true }).eq('id', id);
    if (error) {
      setMsg(error.message);
      scrollToEl(formCardRef);
      return;
    }
    setMsg('Sponsor aprobado');
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
    /logo subido|sponsor actualizado|sponsor creado|sponsor eliminado|sponsor aprobado|^desactivado$/i.test(String(msg).trim());

  const inputErrBorder = (key) => (fieldErrors[key] ? `2px solid ${PADBOL_RED}` : '1px solid #cbd5e1');

  return (
    <div style={{ marginTop: 28, marginBottom: 32, maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 12px', paddingBottom: 8, color: 'rgba(255,255,255,0.95)' }}>🤝 Sponsors</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45 }}>
        Patrocinios por alcance: torneo tiene prioridad sobre sede, país y global.
      </p>

      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 18,
          marginBottom: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: 'var(--text-primary)' }}>Configuración de cupos</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Límites de patrocinadores (fila única <code style={{ fontSize: 12 }}>sponsor_config.id = 1</code>). La aplicación
          puede usar estos valores para validar altas futuras.
        </p>
        {cuposMsg ? (
          <div
            role="alert"
            style={
              String(cuposMsg).startsWith('✅')
                ? { ...successBannerStyle, marginBottom: 12 }
                : { ...errorBannerStyle, marginBottom: 12 }
            }
          >
            {cuposMsg.replace(/^✅\s*/i, '')}
          </div>
        ) : null}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          {[
            { key: 'max_global', label: 'Sponsors globales máximo' },
            { key: 'max_por_sede_starter', label: 'Sponsors por sede — Starter' },
            { key: 'max_por_sede_pro', label: 'Sponsors por sede — Pro' },
            { key: 'max_por_sede_elite', label: 'Sponsors por sede — Elite' },
            { key: 'max_por_nacion', label: 'Sponsors por nación máximo' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                style={{ ...inputStyle, color: 'var(--text-primary)' }}
                value={cupos[key]}
                onChange={(e) => setCupos((p) => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={cuposSaving}
          onClick={() => void guardarCupos()}
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            border: 'none',
            background: cuposSaving ? '#94a3b8' : PADBOL_RED,
            color: '#fff',
            fontWeight: 800,
            cursor: cuposSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {cuposSaving ? 'Guardando…' : 'Guardar configuración de cupos'}
        </button>
      </div>

      {msg ? (
        <div role={bannerIsSuccess ? 'status' : 'alert'} style={bannerIsSuccess ? successBannerStyle : errorBannerStyle}>
          {msg.replace(/^✅\s*/i, '')}
        </div>
      ) : null}

      <div
        ref={formCardRef}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 18,
          marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary)' }}>
          {form.id != null && form.id !== '' ? 'Editar sponsor' : 'Nuevo sponsor'}
        </h3>

        <div ref={nombreRef} style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nombre de la marca *</label>
          <input
            style={{
              ...inputStyle,
              color: 'var(--text-primary)',
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

        <label style={labelStyle}>Logo (bucket sponsors)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input type="file" accept="image/*" disabled={uploading || saving} onChange={(e) => void onLogoFile(e)} />
          {form.logo_url ? (
            <img src={form.logo_url} alt="" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
          ) : null}
        </div>
        <input
          style={{ ...inputStyle, color: 'var(--text-primary)', marginBottom: 12 }}
          value={form.logo_url}
          onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
          placeholder="URL pública del logo (o sube archivo arriba)"
        />

        <label style={labelStyle}>URL destino (opcional)</label>
        <input
          style={{ ...inputStyle, color: 'var(--text-primary)', marginBottom: 12 }}
          value={form.url_destino}
          onChange={(e) => setForm((p) => ({ ...p, url_destino: e.target.value }))}
          placeholder="https://…"
        />

        <label style={labelStyle}>Texto del botón</label>
        <input
          style={{ ...inputStyle, color: 'var(--text-primary)', marginBottom: 12 }}
          value={form.texto_boton}
          onChange={(e) => setForm((p) => ({ ...p, texto_boton: e.target.value }))}
          placeholder="Ver oferta"
        />

        <label style={labelStyle}>Descripción corta (opcional, p. ej. hub 3er tiempo)</label>
        <textarea
          style={{
            ...inputStyle,
            color: 'var(--text-primary)',
            marginBottom: 12,
            minHeight: 72,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
          value={form.descripcion}
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
          placeholder="Una o dos líneas sobre la marca u oferta"
          maxLength={500}
        />

        <label style={labelStyle}>Scope</label>
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
            <label style={labelStyle}>Sede</label>
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
            <label style={labelStyle}>Torneo</label>
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
            <label style={labelStyle}>País</label>
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
            <label style={labelStyle}>Fecha desde (opcional)</label>
            <input
              type="date"
              style={{ ...inputStyle, color: 'var(--text-primary)' }}
              value={form.fecha_desde}
              onChange={(e) => setForm((p) => ({ ...p, fecha_desde: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Fecha hasta (opcional)</label>
            <input
              type="date"
              style={{ ...inputStyle, color: 'var(--text-primary)' }}
              value={form.fecha_hasta}
              onChange={(e) => setForm((p) => ({ ...p, fecha_hasta: e.target.value }))}
            />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
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
                  color: 'var(--text-secondary)',
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
            minWidth: 880,
            borderCollapse: 'collapse',
            background: 'var(--bg-card)',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <thead>
            <tr style={{ background: PADBOL_RED, color: '#fff' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13 }}>Marca</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13 }}>Scope</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13 }}>Estado</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13 }}>Activo</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                  No hay sponsors. Creá uno con el formulario de arriba.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const aprobado = r.aprobado === true || r.aprobado === 'true' || r.aprobado === 1;
                return (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee', background: i % 2 ? 'var(--bg-page)' : 'var(--bg-card)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.logo_url ? (
                        <img src={r.logo_url} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                      ) : null}
                      {r.nombre}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {String(r.scope || '')}
                    {r.sede_id != null ? ` · sede ${r.sede_id}` : ''}
                    {r.torneo_id != null ? ` · torneo ${r.torneo_id}` : ''}
                    {r.pais ? ` · ${r.pais}` : ''}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                    {aprobado ? (
                      <span style={{ color: '#15803d' }}>Aprobado</span>
                    ) : (
                      <span style={{ color: '#ca8a04' }}>Pendiente</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: r.activo ? '#15803d' : '#b91c1c' }}>
                    {r.activo ? 'Sí' : 'No'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!aprobado ? (
                      <button
                        type="button"
                        onClick={() => void aprobarSponsor(r.id)}
                        style={{
                          padding: '6px 10px',
                          marginRight: 6,
                          borderRadius: 6,
                          border: 'none',
                          background: '#15803d',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Aprobar
                      </button>
                    ) : null}
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
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
