import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const emptyForm = () => ({
  activo: false,
  imagen_url: '',
  titulo: '',
  subtitulo: '',
  texto_boton: 'Ver más',
  url_destino: '',
});

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
    } catch (e) {
      setMsg(`⚠️ ${e?.message || String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (sid == null) return null;

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Promo en «Jugar» (hub)</h3>
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
          Card promocional bajo las tres acciones (Reservar / Buscar / Armar) en la pantalla <strong>Jugar</strong>. Solo se
          muestra a jugadores de tu sede si está <strong>activa</strong> y con datos mínimos.
        </p>
        {loading ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>Cargando…</p>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => patch({ activo: e.target.checked })} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Promo activa</span>
            </label>
            {[
              { k: 'imagen_url', label: 'URL de imagen (fondo de la card)', ph: 'https://…' },
              { k: 'titulo', label: 'Título', ph: 'Ej: Pro shop del club' },
              { k: 'subtitulo', label: 'Subtítulo', ph: 'Opcional' },
              { k: 'texto_boton', label: 'Texto del botón', ph: 'Ver más' },
              { k: 'url_destino', label: 'URL al hacer clic', ph: 'https://… o /ruta' },
            ].map(({ k, label, ph }) => (
              <div key={k} style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>{label}</label>
                <input
                  value={form[k]}
                  onChange={(e) => patch({ [k]: e.target.value })}
                  placeholder={ph}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#333',
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              disabled={saving || !canSave}
              onClick={() => void guardar()}
              style={{
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 800,
                fontSize: '14px',
                cursor: saving || !canSave ? 'not-allowed' : 'pointer',
                background: saving || !canSave ? '#94a3b8' : 'linear-gradient(135deg, #E11B22, #b91c1c)',
                color: '#fff',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar promo'}
            </button>
            {msg ? (
              <p style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: 600, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
