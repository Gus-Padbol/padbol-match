import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES } from '../constants/paisesTelefono';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { useHubNavLayout } from '../context/HubNavLayoutContext';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const PRECIO_MENSUAL_USD =
  typeof process !== 'undefined' && process.env.REACT_APP_PRECIO_MENSUAL_USD != null
    ? String(process.env.REACT_APP_PRECIO_MENSUAL_USD).trim()
    : '$29 USD/mes';

const DEPORTES_OPCIONES = DEPORTES_CANCHA_SEDE_OPTIONS;

const DEPORTES_INICIAL = Object.fromEntries(DEPORTES_OPCIONES.map((d) => [d.key, false]));
const CANCHAS_INICIAL = Object.fromEntries(DEPORTES_OPCIONES.map((d) => [d.key, '']));

const CARGO_RESPONSABLE = [
  { value: 'propietario', label: 'Propietario' },
  { value: 'manager', label: 'Manager' },
  { value: 'otro', label: 'Otro' },
];

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

function getInitialForm() {
  return {
    club_nombre: '',
    club_direccion: '',
    pais: 'Argentina',
    ciudad: '',
    provincia_estado: '',
    club_telefono: '',
    club_email: '',
    club_web: '',
    deportes: { ...DEPORTES_INICIAL },
    canchas_por_deporte: { ...CANCHAS_INICIAL },
    responsable_nombre: '',
    responsable_cargo: 'manager',
    email: '',
    email_confirm: '',
    whatsapp: '',
    whatsapp_confirm: '',
    nombre_legal: '',
    numero_fiscal: '',
    fiscal_misma_que_club: true,
    direccion_fiscal: '',
    pais_fiscal: 'Argentina',
    mensaje: '',
  };
}

function FormSection({ title, subtitle, children }) {
  return (
    <section
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '20px 18px',
        marginBottom: '20px',
        background: 'var(--bg-card)',
        boxSizing: 'border-box',
      }}
    >
      <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      {subtitle ? (
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>{subtitle}</p>
      ) : (
        <div style={{ marginBottom: 14 }} />
      )}
      {children}
    </section>
  );
}

export default function UnirsePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState(getInitialForm);
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

    if (
      !form.club_nombre.trim() ||
      !form.club_direccion.trim() ||
      !form.pais.trim() ||
      !form.ciudad.trim() ||
      !form.provincia_estado.trim() ||
      !form.club_telefono.trim() ||
      !form.club_email.trim() ||
      !form.responsable_nombre.trim() ||
      !form.email.trim() ||
      !form.whatsapp.trim()
    ) {
      setErr('Completa todos los campos obligatorios marcados con *.');
      return;
    }

    const deportesSel = DEPORTES_OPCIONES.filter((d) => form.deportes[d.key]).map((d) => d.key);
    if (deportesSel.length === 0) {
      setErr('Selecciona al menos un deporte disponible en tu instalación.');
      return;
    }

    const em = form.email.trim().toLowerCase();
    const em2 = form.email_confirm.trim().toLowerCase();
    if (em !== em2) {
      setErr('Los emails del responsable no coinciden.');
      return;
    }
    const wa = normalizeWs(form.whatsapp);
    const wa2 = normalizeWs(form.whatsapp_confirm);
    if (wa !== wa2) {
      setErr('Los números de WhatsApp no coinciden.');
      return;
    }

    const canchas = {};
    for (const k of deportesSel) {
      const raw = form.canchas_por_deporte[k];
      if (raw != null && String(raw).trim() !== '') {
        const n = parseInt(String(raw), 10);
        if (Number.isFinite(n) && n >= 0) canchas[k] = n;
      }
    }
    const deportes_canchas = { deportes: deportesSel, canchas };

    const clubEmailTrim = form.club_email.trim().toLowerCase();
    const body = {
      club_nombre: form.club_nombre.trim(),
      club_direccion: form.club_direccion.trim(),
      pais: form.pais.trim(),
      ciudad: form.ciudad.trim(),
      provincia_estado: form.provincia_estado.trim() || null,
      club_telefono: form.club_telefono.trim() || null,
      club_email: clubEmailTrim || null,
      club_web: form.club_web.trim() || null,
      tipo_instalacion: null,
      horario_apertura: null,
      horario_cierre: null,
      deportes_canchas,
      responsable_nombre: form.responsable_nombre.trim(),
      responsable_cargo: form.responsable_cargo,
      email: em,
      whatsapp: wa,
      nombre_legal: form.nombre_legal.trim() || null,
      numero_fiscal: form.numero_fiscal.trim() || null,
      fiscal_misma_que_club: form.fiscal_misma_que_club,
      direccion_fiscal: form.fiscal_misma_que_club ? null : form.direccion_fiscal.trim() || null,
      pais_fiscal: form.pais_fiscal.trim() || null,
      mensaje: form.mensaje.trim() || null,
    };

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/solicitudes-licencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      setMsg('Solicitud enviada. Te contactaremos pronto.');
      setForm(getInitialForm());
    } catch (e2) {
      setErr(e2?.message || 'No se pudo enviar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '16px',
    boxSizing: 'border-box',
    background: 'var(--bg-card)',
  };
  const labelStyle = { display: 'block', fontWeight: 700, color: '#334155', marginBottom: '6px', fontSize: '13px' };
  const rowGap = { marginTop: 14 };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-card)',
        paddingTop: hubContentPaddingTopCss(location.pathname || '/unirse', navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname || '/unirse', navDock),
      }}
    >
      <AppHeader title="Alta de club" onBack={() => navigate(-1)} />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{ width: '180px', maxWidth: '85vw', display: 'block', margin: '0 auto 20px' }}
        />

        <section
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '22px 20px',
            marginBottom: '16px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            boxSizing: 'border-box',
          }}
        >
          <h1
            style={{
              color: '#0f172a',
              margin: '0 0 10px',
              fontSize: 'clamp(1.35rem, 4vw, 1.75rem)',
              fontWeight: 900,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            Suma tu club a Padbol Match
          </h1>
          <p style={{ color: '#475569', margin: '0 0 16px', lineHeight: 1.55, fontSize: '15px', textAlign: 'center' }}>
            Dejanos los datos básicos del club y un contacto. Horarios, tipo de instalación y el resto de la ficha los
            completas después desde tu panel.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <span
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '999px',
              }}
            >
              30 días gratis sin tarjeta
            </span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#E11B22' }}>{PRECIO_MENSUAL_USD}</span>
          </div>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
            Después del período de prueba, puedes elegir facturación mensual o anual.
          </p>
        </section>

        {err ? (
          <div
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              padding: '12px 14px',
              borderRadius: 12,
              marginBottom: 12,
              fontSize: '14px',
              lineHeight: 1.45,
            }}
          >
            {err}
          </div>
        ) : null}
        {msg ? (
          <div
            style={{
              background: '#ecfdf5',
              color: '#065f46',
              padding: '12px 14px',
              borderRadius: 12,
              marginBottom: 12,
              fontSize: '14px',
            }}
          >
            {msg}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '22px 18px 24px',
            boxSizing: 'border-box',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          }}
        >
          <FormSection
            title="Datos del club"
            subtitle="Información de la instalación que verán los jugadores y usaremos para contactarte."
          >
            <label style={labelStyle}>Nombre del club *</label>
            <input style={inputStyle} value={form.club_nombre} onChange={(e) => onField('club_nombre', e.target.value)} required />

            <label style={{ ...labelStyle, ...rowGap }}>País *</label>
            <select style={inputStyle} value={form.pais} onChange={(e) => onField('pais', e.target.value)} required>
              {paises.map((p) => (
                <option key={p.nombre} value={p.nombre}>
                  {p.bandera ? `${p.bandera} ` : ''}{p.nombre}
                </option>
              ))}
            </select>

            <label style={{ ...labelStyle, ...rowGap }}>Dirección *</label>
            <input
              style={inputStyle}
              value={form.club_direccion}
              onChange={(e) => onField('club_direccion', e.target.value)}
              placeholder="Calle, número, barrio, referencias…"
              autoComplete="street-address"
              required
            />

            <label style={{ ...labelStyle, ...rowGap }}>Ciudad *</label>
            <input style={inputStyle} value={form.ciudad} onChange={(e) => onField('ciudad', e.target.value)} required />

            <label style={{ ...labelStyle, ...rowGap }}>Provincia / Estado *</label>
            <input style={inputStyle} value={form.provincia_estado} onChange={(e) => onField('provincia_estado', e.target.value)} required />

            <label style={{ ...labelStyle, ...rowGap }}>Teléfono del club *</label>
            <input
              style={inputStyle}
              value={form.club_telefono}
              onChange={(e) => onField('club_telefono', e.target.value)}
              placeholder="+54…"
              inputMode="tel"
              required
            />

            <label style={{ ...labelStyle, ...rowGap }}>Email del club *</label>
            <input
              type="email"
              style={inputStyle}
              value={form.club_email}
              onChange={(e) => onField('club_email', e.target.value)}
              autoComplete="email"
              required
            />

            <label style={{ ...labelStyle, ...rowGap }}>Sitio web (opcional)</label>
            <input style={inputStyle} value={form.club_web} onChange={(e) => onField('club_web', e.target.value)} placeholder="https://…" inputMode="url" />

            <p style={{ ...labelStyle, marginTop: 18, marginBottom: 8 }}>Deportes disponibles * (uno o más)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  <span style={{ flex: 1 }}>
                    <strong>{d.label}</strong>
                    {form.deportes[d.key] ? (
                      <span style={{ display: 'block', marginTop: 8 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Cantidad de canchas (opcional)</span>
                        <input
                          type="number"
                          min="0"
                          style={{ ...inputStyle, marginTop: 6, maxWidth: '220px' }}
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
          </FormSection>

          <FormSection title="Datos del responsable" subtitle="Persona de contacto principal para la cuenta y la activación.">
            <label style={labelStyle}>Nombre completo *</label>
            <input style={inputStyle} value={form.responsable_nombre} onChange={(e) => onField('responsable_nombre', e.target.value)} required />

            <label style={{ ...labelStyle, ...rowGap }}>Cargo *</label>
            <select style={inputStyle} value={form.responsable_cargo} onChange={(e) => onField('responsable_cargo', e.target.value)} required>
              {CARGO_RESPONSABLE.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label style={{ ...labelStyle, ...rowGap }}>Email *</label>
            <input type="email" style={inputStyle} value={form.email} onChange={(e) => onField('email', e.target.value)} required autoComplete="email" />

            <label style={{ ...labelStyle, ...rowGap }}>Repetir email *</label>
            <input
              type="email"
              style={inputStyle}
              value={form.email_confirm}
              onChange={(e) => onField('email_confirm', e.target.value)}
              required
              autoComplete="off"
            />

            <label style={{ ...labelStyle, ...rowGap }}>WhatsApp (con código de país) *</label>
            <input style={inputStyle} value={form.whatsapp} onChange={(e) => onField('whatsapp', e.target.value)} placeholder="+549…" required autoComplete="tel" />

            <label style={{ ...labelStyle, ...rowGap }}>Repetir WhatsApp *</label>
            <input
              style={inputStyle}
              value={form.whatsapp_confirm}
              onChange={(e) => onField('whatsapp_confirm', e.target.value)}
              placeholder="+549…"
              required
              autoComplete="off"
            />
          </FormSection>

          <FormSection
            title="Datos legales y fiscales"
            subtitle="Opcional pero recomendado para facturación y contrato. Puedes completarlo más adelante si lo prefieres."
          >
            <label style={labelStyle}>Nombre legal de la empresa o persona</label>
            <input style={inputStyle} value={form.nombre_legal} onChange={(e) => onField('nombre_legal', e.target.value)} />

            <label style={{ ...labelStyle, ...rowGap }}>Número fiscal (NIF / CIF / RUT / CUIT…)</label>
            <input style={inputStyle} value={form.numero_fiscal} onChange={(e) => onField('numero_fiscal', e.target.value)} placeholder="Según tu país" />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 16,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              <input
                type="checkbox"
                checked={form.fiscal_misma_que_club}
                onChange={(e) => onField('fiscal_misma_que_club', e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              La dirección fiscal es la misma que la del club
            </label>

            <label style={{ ...labelStyle, ...rowGap }}>Dirección fiscal</label>
            <input
              style={{ ...inputStyle, opacity: form.fiscal_misma_que_club ? 0.55 : 1 }}
              value={form.direccion_fiscal}
              onChange={(e) => onField('direccion_fiscal', e.target.value)}
              disabled={form.fiscal_misma_que_club}
              placeholder={form.fiscal_misma_que_club ? 'Marca “misma que el club” arriba' : 'Solo si difiere del club'}
            />

            <label style={{ ...labelStyle, ...rowGap }}>País fiscal</label>
            <select style={inputStyle} value={form.pais_fiscal} onChange={(e) => onField('pais_fiscal', e.target.value)}>
              {paises.map((p) => (
                <option key={`f-${p.nombre}`} value={p.nombre}>
                  {p.bandera ? `${p.bandera} ` : ''}{p.nombre}
                </option>
              ))}
            </select>
          </FormSection>

          <label style={{ ...labelStyle, marginTop: 4 }}>Comentarios adicionales</label>
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical', maxWidth: '100%' }} value={form.mensaje} onChange={(e) => onField('mensaje', e.target.value)} />

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: '22px',
              width: '100%',
              padding: '15px 18px',
              border: 'none',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #E11B22, #b91c1c)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '16px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.85 : 1,
              boxShadow: '0 8px 24px rgba(225, 27, 34, 0.35)',
            }}
          >
            {saving ? 'Enviando…' : 'Enviar solicitud de alta'}
          </button>
        </form>
      </div>
    </div>
  );
}
