import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES } from '../constants/paisesTelefono';

const PADBOL_RED = '#E11B22';

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
      setMsg(`⚠️ ${error.message}`);
      setRows([]);
    } else {
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRefs();
    void loadSponsors();
  }, [loadRefs, loadSponsors]);

  const resetForm = () => setForm(emptyForm());

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setMsg('⚠️ Elige una imagen (JPEG, PNG, WebP o GIF).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMsg('⚠️ Máximo 4MB para el logo.');
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
      setMsg(`⚠️ Subida: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('sponsors').getPublicUrl(path);
    setForm((p) => ({ ...p, logo_url: publicUrl }));
    setUploading(false);
    setMsg('✅ Logo subido');
    setTimeout(() => setMsg(''), 2500);
  };

  const guardar = async () => {
    if (!session?.user?.id) {
      setMsg('⚠️ Inicia sesión como super admin.');
      return;
    }
    const nombre = String(form.nombre || '').trim();
    if (!nombre) {
      setMsg('⚠️ Indica el nombre de la marca.');
      return;
    }
    const scope = String(form.scope || 'global').toLowerCase();
    const sedeId = scope === 'sede' && form.sede_id ? parseInt(String(form.sede_id), 10) : null;
    const torneoId = scope === 'torneo' && form.torneo_id ? parseInt(String(form.torneo_id), 10) : null;
    const pais = scope === 'nacional' ? String(form.pais || '').trim() : null;
    if (scope === 'sede' && (!sedeId || sedeId <= 0)) {
      setMsg('⚠️ Elige una sede.');
      return;
    }
    if (scope === 'torneo' && (!torneoId || torneoId <= 0)) {
      setMsg('⚠️ Elige un torneo.');
      return;
    }
    if (scope === 'nacional' && !pais) {
      setMsg('⚠️ Elige un país.');
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
      if (form.id != null) {
        const { error } = await supabase.from('sponsors').update(payload).eq('id', form.id);
        if (error) throw error;
        setMsg('✅ Sponsor actualizado');
      } else {
        const insert = { ...payload, creado_por: session.user.id };
        const { error } = await supabase.from('sponsors').insert([insert]);
        if (error) throw error;
        setMsg('✅ Sponsor creado');
        resetForm();
      }
      await loadSponsors();
    } catch (err) {
      setMsg(`⚠️ ${err?.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const desactivar = async (id) => {
    if (!window.confirm('¿Desactivar este sponsor? Dejará de mostrarse en la app.')) return;
    const { error } = await supabase.from('sponsors').update({ activo: false }).eq('id', id);
    if (error) {
      setMsg(`⚠️ ${error.message}`);
      return;
    }
    setMsg('✅ Desactivado');
    if (form.id === id) resetForm();
    await loadSponsors();
  };

  const torneoLabel = useCallback((t) => {
    const sid = t.sede_id != null ? ` · sede ${t.sede_id}` : '';
    return `${String(t.nombre || 'Torneo').slice(0, 80)} (id ${t.id})${sid}`;
  }, []);

  return (
    <div style={{ marginTop: 28, marginBottom: 32, maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 12px', paddingBottom: 8, color: 'rgba(255,255,255,0.95)' }}>🤝 Sponsors</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45 }}>
        Patrocinios por alcance: torneo tiene prioridad sobre sede, país y global. Logos en el bucket{' '}
        <code style={{ color: '#fef08a' }}>sponsors</code> (público).
      </p>

      {msg ? (
        <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14, color: msg.startsWith('✅') ? '#86efac' : '#fde68a' }}>
          {msg}
        </p>
      ) : null}

      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 18,
          marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#0f172a' }}>{form.id != null ? 'Editar sponsor' : 'Nuevo sponsor'}</h3>

        <label style={{ ...labelStyle, color: '#334155' }}>Nombre de la marca *</label>
        <input
          style={{ ...inputStyle, color: '#0f172a', marginBottom: 12 }}
          value={form.nombre}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          placeholder="Ej: Marca deportiva"
        />

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
          onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
        >
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {form.scope === 'sede' ? (
          <>
            <label style={{ ...labelStyle, color: '#334155' }}>Sede</label>
            <select
              style={{ ...inputStyle, marginBottom: 12, cursor: 'pointer' }}
              value={form.sede_id}
              onChange={(e) => setForm((p) => ({ ...p, sede_id: e.target.value }))}
            >
              <option value="">— Elegir —</option>
              {sedesOpts.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {form.scope === 'torneo' ? (
          <>
            <label style={{ ...labelStyle, color: '#334155' }}>Torneo</label>
            <select
              style={{ ...inputStyle, marginBottom: 12, cursor: 'pointer' }}
              value={form.torneo_id}
              onChange={(e) => setForm((p) => ({ ...p, torneo_id: e.target.value }))}
            >
              <option value="">— Elegir —</option>
              {torneosOpts.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {torneoLabel(t)}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {form.scope === 'nacional' ? (
          <>
            <label style={{ ...labelStyle, color: '#334155' }}>País</label>
            <select
              style={{ ...inputStyle, marginBottom: 12, cursor: 'pointer' }}
              value={form.pais}
              onChange={(e) => setForm((p) => ({ ...p, pais: e.target.value }))}
            >
              <option value="">— Elegir —</option>
              {PAIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
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
          {form.id != null ? (
            <button
              type="button"
              disabled={saving}
              onClick={resetForm}
              style={{
                padding: '12px 18px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: 640,
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
