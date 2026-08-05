import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import PadbolBrandLogo from '../components/PadbolBrandLogo';
import '../pages/LandingPage.css';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const PRECIO_MENSUAL_USD =
  typeof process !== 'undefined' && process.env.REACT_APP_PRECIO_MENSUAL_USD != null
    ? String(process.env.REACT_APP_PRECIO_MENSUAL_USD).trim()
    : '$29 USD/mes';

function normalizeWs(s) {
  return String(s || '').trim();
}

function getInitialForm() {
  return {
    club_nombre: '',
    responsable_nombre: '',
    email: '',
    whatsapp: '',
    mensaje: '',
  };
}

function FormSection({ title, subtitle, children }) {
  return (
    <section
      style={{
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '20px 18px',
        marginBottom: '20px',
        background: 'var(--bg-card)',
        boxSizing: 'border-box',
      }}
    >
      <h2
        style={{
          margin: '0 0 6px',
          fontSize: '17px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{subtitle}</p>
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
  const startBenefits = useMemo(() => [
    ['01', 'Tu cuenta', 'Creamos el acceso principal de la sede.'],
    ['02', 'Tu plan', 'Elegís el plan y el medio de pago cuando esté listo.'],
    ['03', 'Configuración guiada', 'Completás sede, ubicación, canchas, horarios y precios.'],
    ['04', 'Publicación', 'Revisás el resumen y activás tu sede para jugadores.'],
  ], []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('landing-page-active');
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevThemeColor = meta?.getAttribute('content') ?? null;
    if (meta) meta.setAttribute('content', '#0F172A');
    return () => {
      root.classList.remove('landing-page-active');
      if (meta && prevThemeColor != null) meta.setAttribute('content', prevThemeColor);
    };
  }, []);

  const onField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    if (
      !form.club_nombre.trim() || !form.responsable_nombre.trim() || !form.email.trim() || !form.whatsapp.trim()
    ) {
      setErr('Completá nombre de sede, responsable, email y WhatsApp para comenzar.');
      return;
    }

    const em = form.email.trim().toLowerCase();
    const wa = normalizeWs(form.whatsapp);
    const body = {
      club_nombre: form.club_nombre.trim(),
      responsable_nombre: form.responsable_nombre.trim(),
      email: em,
      whatsapp: wa,
      mensaje: form.mensaje.trim() || null,
      solicitud_inicial: true,
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
      setMsg('Listo. Recibimos tu solicitud. El siguiente paso es activar tu cuenta y continuar con el plan; después completás los datos de tu sede con la configuración guiada.');
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
    border: '1px solid var(--border)',
    fontSize: '16px',
    boxSizing: 'border-box',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
  };
  const labelStyle = {
    display: 'block',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '6px',
    fontSize: '13px',
  };
  const rowGap = { marginTop: 14 };

  return (
    <div
      className="landing-page"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        paddingTop: hubContentPaddingTopCss(location.pathname || '/unirse', navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname || '/unirse', navDock),
      }}
    >
      <AppHeader title="Alta de club" onBack={() => navigate(-1)} />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        <PadbolBrandLogo
          style={{ width: '180px', height: 'auto', maxWidth: '85vw', display: 'block', margin: '0 auto 20px' }}
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
              color: 'var(--text-primary)',
              margin: '0 0 10px',
              fontSize: 'clamp(1.35rem, 4vw, 1.75rem)',
              fontWeight: 900,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            Suma tu club a Padbol Match
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              margin: '0 0 16px',
              lineHeight: 1.55,
              fontSize: '15px',
              textAlign: 'center',
            }}
          >
            Empezá con lo mínimo. Los datos de la sede, ubicación, canchas, horarios, precios y cobros se completan
            después, desde una configuración guiada.
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
              Alta simple, sin planillas
            </span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#E11B22' }}>{PRECIO_MENSUAL_USD}</span>
          </div>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Primero creamos tu acceso. Luego elegís el plan y completás la operación de tu sede.
          </p>
        </section>

        <section style={{ margin: '0 0 16px' }}>
          <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Después del alta, te acompañamos así
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
            {startBenefits.map(([number, title, description]) => (
              <article key={number} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '14px 13px', background: 'var(--bg-card)', minHeight: 118, boxSizing: 'border-box' }}>
                <span style={{ display: 'block', color: '#E11B22', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>{number}</span>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 14, marginBottom: 6 }}>{title}</strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.4 }}>{description}</span>
              </article>
            ))}
          </div>
        </section>

        {err ? (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.35)',
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
              background: 'rgba(22, 163, 74, 0.15)',
              color: '#86efac',
              border: '1px solid rgba(22, 163, 74, 0.35)',
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
          <FormSection title="Empezá con estos datos" subtitle="Sólo necesitamos una referencia de la sede y una persona de contacto para abrir el proceso.">
            <label style={labelStyle}>Nombre de la sede o club *</label>
            <input style={inputStyle} value={form.club_nombre} onChange={(e) => onField('club_nombre', e.target.value)} required />
            <label style={labelStyle}>Nombre completo *</label>
            <input style={inputStyle} value={form.responsable_nombre} onChange={(e) => onField('responsable_nombre', e.target.value)} required />
            <label style={{ ...labelStyle, ...rowGap }}>Email de contacto *</label>
            <input type="email" style={inputStyle} value={form.email} onChange={(e) => onField('email', e.target.value)} required autoComplete="email" />
            <label style={{ ...labelStyle, ...rowGap }}>WhatsApp (con código de país) *</label>
            <input style={inputStyle} value={form.whatsapp} onChange={(e) => onField('whatsapp', e.target.value)} placeholder="+549…" required autoComplete="tel" />
          </FormSection>
          <label style={{ ...labelStyle, marginTop: 4 }}>¿Algo que quieras contarnos? (opcional)</label>
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
            {saving ? 'Enviando…' : 'Comenzar alta de mi sede'}
          </button>
        </form>
      </div>
    </div>
  );
}
