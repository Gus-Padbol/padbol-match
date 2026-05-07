import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES } from '../constants/paisesTelefono';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const PRECIO_MENSUAL_USD =
  typeof process !== 'undefined' && process.env.REACT_APP_PRECIO_MENSUAL_USD != null
    ? String(process.env.REACT_APP_PRECIO_MENSUAL_USD).trim()
    : '$29 USD/mes';

const DEPORTES_OPCIONES = [
  { key: 'padbol', label: 'Padbol' },
  { key: 'padel', label: 'Pádel' },
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'otro', label: 'Otro' },
];

const DEPORTES_INICIAL = { padbol: false, padel: false, pickleball: false, otro: false };
const CANCHAS_INICIAL = { padbol: '', padel: '', pickleball: '', otro: '' };

function countries() {
  const m = new Map();
  [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach((p) => {
    if (p?.nombre) m.set(p.nombre, p);
  });
  return [...m.values()].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

function normalizeWs(s) {
  return String(s || '').trim();
}

export default function UnirsePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    club_nombre: '',
    pais: 'Argentina',
    ciudad: '',
    responsable_nombre: '',
    email: '',
    email_confirm: '',
    whatsapp: '',
    whatsapp_confirm: '',
    deportes: { ...DEPORTES_INICIAL },
    canchas_por_deporte: { ...CANCHAS_INICIAL },
    mensaje: '',
  });
  const paises = useMemo(() => countries(), []);

  const onField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onDeporteToggle = (key, checked) => {
    setForm((p) => ({
      ...p,
      deportes: { ...p.deportes, [key]: checked },
      ...(checked ? {} : { canchas_por_deporte: { ...p.canchas_por_deporte, [key]: '' } }),
    }));
  };

  const onCanchaDeporte = (key, v) =>
    setForm((p) => ({ ...p, canchas_por_deporte: { ...p.canchas_por_deporte, [key]: v } }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!form.club_nombre.trim() || !form.pais.trim() || !form.ciudad.trim() || !form.responsable_nombre.trim() || !form.email.trim() || !form.whatsapp.trim()) {
      setErr('Completá todos los campos obligatorios.');
      return;
    }
    const em = form.email.trim().toLowerCase();
    const em2 = form.email_confirm.trim().toLowerCase();
    if (em !== em2) {
      setErr('Los emails no coinciden. Revisá el campo “Repetir email”.');
      return;
    }
    const wa = normalizeWs(form.whatsapp);
    const wa2 = normalizeWs(form.whatsapp_confirm);
    if (wa !== wa2) {
      setErr('Los números de WhatsApp no coinciden. Revisá “Repetir WhatsApp”.');
      return;
    }
    const deportesSel = DEPORTES_OPCIONES.filter((d) => form.deportes[d.key]).map((d) => d.key);
    const canchas = {};
    for (const k of deportesSel) {
      const raw = form.canchas_por_deporte[k];
      if (raw != null && String(raw).trim() !== '') {
        const n = parseInt(String(raw), 10);
        if (Number.isFinite(n) && n >= 0) canchas[k] = n;
      }
    }
    const deportes_canchas =
      deportesSel.length || Object.keys(canchas).length ? { deportes: deportesSel, canchas } : null;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/solicitudes-licencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_nombre: form.club_nombre.trim(),
          pais: form.pais.trim(),
          ciudad: form.ciudad.trim(),
          responsable_nombre: form.responsable_nombre.trim(),
          email: em,
          whatsapp: wa,
          mensaje: form.mensaje.trim() || null,
          deportes_canchas,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      setMsg('Solicitud enviada. Te contactaremos pronto.');
      setForm((p) => ({
        ...p,
        club_nombre: '',
        ciudad: '',
        responsable_nombre: '',
        email: '',
        email_confirm: '',
        whatsapp: '',
        whatsapp_confirm: '',
        deportes: { ...DEPORTES_INICIAL },
        canchas_por_deporte: { ...CANCHAS_INICIAL },
        mensaje: '',
      }));
    } catch (e2) {
      setErr(e2?.message || 'No se pudo enviar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    maxWidth: '520px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '15px',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontWeight: 700, color: '#1e293b', marginBottom: '6px', fontSize: '14px' };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        paddingTop: hubContentPaddingTopCss('/unirse'),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
      }}
    >
      <AppHeader title="Unirse" onBack={() => navigate(-1)} />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px' }}>
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{ width: '180px', maxWidth: '85vw', display: 'block', margin: '0 auto 20px' }}
        />

        <section
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '22px 20px',
            marginBottom: '16px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            boxSizing: 'border-box',
          }}
        >
          <h1
            style={{
              color: '#312e81',
              margin: '0 0 12px',
              fontSize: 'clamp(1.35rem, 4vw, 1.65rem)',
              fontWeight: 900,
              textAlign: 'center',
              lineHeight: 1.25,
            }}
          >
            Sumá tu club a Padbol Match
          </h1>
          <p style={{ color: '#475569', margin: '0 0 16px', lineHeight: 1.55, fontSize: '15px', textAlign: 'center' }}>
            Padbol Match es la plataforma para gestionar tu club: reservas online, torneos, rankings y visibilidad
            frente a jugadores. Centralizá la operación diaria y ofrecé una experiencia moderna a tu comunidad.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <span
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '14px',
                padding: '8px 14px',
                borderRadius: '999px',
                boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
              }}
            >
              30 días gratis sin tarjeta
            </span>
          </div>
          <p
            style={{
              margin: '0 0 8px',
              textAlign: 'center',
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#1e293b',
            }}
          >
            {PRECIO_MENSUAL_USD}
          </p>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '14px', color: '#64748b', lineHeight: 1.45 }}>
            Después del período de prueba, elegís mensual o anual
          </p>
        </section>

        {err ? <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 12px', borderRadius: 10, marginBottom: 10 }}>{err}</div> : null}
        {msg ? <div style={{ background: '#ecfdf5', color: '#065f46', padding: '10px 12px', borderRadius: 10, marginBottom: 10 }}>{msg}</div> : null}

        <form onSubmit={onSubmit} style={{ background: '#fff', borderRadius: '14px', padding: '18px', boxSizing: 'border-box' }}>
          <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#64748b', lineHeight: 1.45 }}>
            <strong style={{ color: '#334155' }}>Modalidad:</strong> Club Afiliado. Otros planes los asigna el equipo
            Padbol desde el panel.
          </p>

          <label style={labelStyle}>Nombre del club *</label>
          <input style={inputStyle} value={form.club_nombre} onChange={(e) => onField('club_nombre', e.target.value)} required />

          <label style={{ ...labelStyle, marginTop: 12 }}>País *</label>
          <select style={inputStyle} value={form.pais} onChange={(e) => onField('pais', e.target.value)} required>
            {paises.map((p) => (
              <option key={p.nombre} value={p.nombre}>
                {p.bandera ? `${p.bandera} ` : ''}{p.nombre}
              </option>
            ))}
          </select>

          <label style={{ ...labelStyle, marginTop: 12 }}>Ciudad *</label>
          <input style={inputStyle} value={form.ciudad} onChange={(e) => onField('ciudad', e.target.value)} required />

          <label style={{ ...labelStyle, marginTop: 12 }}>Nombre del responsable *</label>
          <input style={inputStyle} value={form.responsable_nombre} onChange={(e) => onField('responsable_nombre', e.target.value)} required />

          <label style={{ ...labelStyle, marginTop: 12 }}>Email *</label>
          <input type="email" style={inputStyle} value={form.email} onChange={(e) => onField('email', e.target.value)} required autoComplete="email" />

          <label style={{ ...labelStyle, marginTop: 12 }}>Repetir email *</label>
          <input
            type="email"
            style={inputStyle}
            value={form.email_confirm}
            onChange={(e) => onField('email_confirm', e.target.value)}
            required
            autoComplete="off"
          />

          <label style={{ ...labelStyle, marginTop: 12 }}>WhatsApp (código país) *</label>
          <input style={inputStyle} value={form.whatsapp} onChange={(e) => onField('whatsapp', e.target.value)} placeholder="+549..." required autoComplete="tel" />

          <label style={{ ...labelStyle, marginTop: 12 }}>Repetir WhatsApp *</label>
          <input
            style={inputStyle}
            value={form.whatsapp_confirm}
            onChange={(e) => onField('whatsapp_confirm', e.target.value)}
            placeholder="+549..."
            required
            autoComplete="off"
          />

          <fieldset style={{ border: 'none', margin: '16px 0 0', padding: 0 }}>
            <legend style={{ ...labelStyle, marginBottom: 8 }}>Tipo de deporte (podés marcar varios)</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEPORTES_OPCIONES.map((d) => (
                <label
                  key={d.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: '15px',
                    color: '#334155',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(form.deportes[d.key])}
                    onChange={(e) => onDeporteToggle(d.key, e.target.checked)}
                    style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                  />
                  <span>
                    <strong>{d.label}</strong>
                    {form.deportes[d.key] ? (
                      <span style={{ display: 'block', marginTop: 8 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Canchas (opcional)</span>
                        <input
                          type="number"
                          min="0"
                          style={{ ...inputStyle, marginTop: 6, maxWidth: '200px' }}
                          value={form.canchas_por_deporte[d.key]}
                          onChange={(e) => onCanchaDeporte(d.key, e.target.value)}
                          placeholder="Ej. 4"
                        />
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label style={{ ...labelStyle, marginTop: 16 }}>Mensaje adicional</label>
          <textarea rows={4} style={{ ...inputStyle, maxWidth: '100%', resize: 'vertical' }} value={form.mensaje} onChange={(e) => onField('mensaje', e.target.value)} />

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: '16px',
              width: '100%',
              maxWidth: '520px',
              padding: '13px 16px',
              border: 'none',
              borderRadius: '10px',
              background: '#4f46e5',
              color: '#fff',
              fontWeight: 800,
              fontSize: '15px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </div>
  );
}
