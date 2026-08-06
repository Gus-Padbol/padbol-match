import React, { useEffect, useRef, useState } from 'react';
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

const SERVICE_PLANS = [
  {
    id: 'explorar',
    number: '01',
    name: 'Explora',
    price: 'Gratis',
    period: 'Para conocer la propuesta',
    accent: '#22c55e',
    description: 'Una primera vista para entender cómo Padbol Match puede acompañar a tu sede.',
    includes: ['Recorrido de producto', 'Asistente Chivi', 'Consulta con el equipo'],
  },
  {
    id: 'base',
    number: '02',
    name: 'Sede Base',
    price: PRECIO_MENSUAL_USD,
    period: 'por sede / mes',
    accent: '#38bdf8',
    description: 'La base para abrir tu operación deportiva desde un único panel.',
    includes: ['Canchas, horarios y precios', 'Reservas y jugadores', 'Panel de administración'],
  },
  {
    id: 'pro',
    number: '03',
    name: 'Sede Pro',
    price: '$59 USD/mes',
    period: 'por sede / mes',
    accent: '#E11B22',
    featured: true,
    description: 'Para sedes que además quieren activar comunidad y competencia.',
    includes: ['Torneos y rankings', 'Marcador conectado', 'PadCoins y membresías'],
  },
  {
    id: '360',
    number: '04',
    name: 'Sede 360',
    price: '$99 USD/mes',
    period: 'por sede / mes',
    accent: '#f59e0b',
    description: 'La capa para operar, comunicar y mostrar tu sede en una experiencia ampliada.',
    includes: ['Pantallas y publicidad', 'Sponsor y tienda', 'Automatizaciones por etapas'],
  },
];

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
  const [selectedPlanId, setSelectedPlanId] = useState('base');
  const formRef = useRef(null);
  const selectedPlan = SERVICE_PLANS.find((plan) => plan.id === selectedPlanId) || SERVICE_PLANS[1];

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
  const selectPlan = (planId) => {
    setSelectedPlanId(planId);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    if (
      !form.club_nombre.trim() || !form.responsable_nombre.trim() || !form.email.trim() || !form.whatsapp.trim()
    ) {
      setErr('Completa nombre de sede, responsable, email y WhatsApp para comenzar.');
      return;
    }

    const em = form.email.trim().toLowerCase();
    const wa = normalizeWs(form.whatsapp);
    const body = {
      club_nombre: form.club_nombre.trim(),
      responsable_nombre: form.responsable_nombre.trim(),
      email: em,
      whatsapp: wa,
      mensaje: `[Plan elegido: ${selectedPlan.name} — ${selectedPlan.price}]${form.mensaje.trim() ? `\n${form.mensaje.trim()}` : ''}`,
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
      setMsg(`Listo. Recibimos tu solicitud para ${selectedPlan.name}. Te acompañamos a activar la cuenta, confirmar el plan y completar tu sede con la configuración guiada.`);
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
            Elige la capa que mejor acompaña a tu sede. Puedes empezar hoy, completar tus datos después y recibir
            apoyo humano cuando lo necesites.
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
          </div>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Eliges tu plan, inicias el alta y completas la operación de tu sede con una configuración guiada.
          </p>
        </section>

        <section style={{ margin: '0 0 20px' }}>
          <p style={{ margin: '0 0 7px', color: '#E11B22', fontSize: 12, fontWeight: 900, letterSpacing: '.09em', textTransform: 'uppercase' }}>
            Planes para crecer con Padbol Match
          </p>
          <h2 style={{ margin: '0 0 9px', color: 'var(--text-primary)', fontSize: 'clamp(1.25rem, 3vw, 1.55rem)', lineHeight: 1.12 }}>
            Todo lo que necesitás, a tu escala
          </h2>
          <p style={{ margin: '0 0 13px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.45 }}>
            Elige un plan para empezar. Los valores son de referencia y se pueden ajustar por país, moneda y necesidad de cada sede.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {SERVICE_PLANS.map((plan) => {
              const selected = selectedPlanId === plan.id;
              return (
              <article
                key={plan.id}
                style={{
                  border: `1px solid ${selected ? plan.accent : 'var(--border)'}`,
                  borderRadius: 16,
                  padding: '16px 14px',
                  background: `linear-gradient(145deg, var(--bg-card), color-mix(in srgb, ${plan.accent} 9%, var(--bg-card)))`,
                  minHeight: 294,
                  boxSizing: 'border-box',
                  boxShadow: selected ? `0 16px 34px color-mix(in srgb, ${plan.accent} 24%, transparent)` : `0 14px 30px color-mix(in srgb, ${plan.accent} 12%, transparent)`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <span style={{ display: 'block', color: plan.accent, fontSize: 12, fontWeight: 900, marginBottom: 10, letterSpacing: '.06em' }}>{plan.number}</span>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 17, lineHeight: 1.16, marginBottom: 4 }}>{plan.name}</strong>
                <span style={{ display: 'block', color: plan.accent, fontSize: 20, fontWeight: 900, marginBottom: 2 }}>{plan.price}</span>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 11, marginBottom: 10 }}>{plan.period}</span>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.38, minHeight: 49 }}>{plan.description}</span>
                <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 14px', display: 'grid', gap: 5 }}>
                  {plan.includes.map((item) => <li key={item} style={{ color: 'var(--text-primary)', fontSize: 11, lineHeight: 1.3 }}>✓ {item}</li>)}
                </ul>
                <button
                  type="button"
                  onClick={() => selectPlan(plan.id)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: `1px solid ${plan.accent}`, background: selected ? plan.accent : 'transparent', color: selected ? '#fff' : plan.accent, cursor: 'pointer', fontWeight: 800, fontSize: 12 }}
                >
                  {selected ? 'Plan elegido' : `Elegir ${plan.name}`}
                </button>
              </article>
              );
            })}
          </div>
          <p style={{ margin: '14px 0 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>
            ¿Quieres conversarlo antes de elegir? Escríbenos a <a href="mailto:info@padbol.com?subject=Consulta%20sobre%20planes%20de%20Padbol%20Match" style={{ color: '#E11B22', fontWeight: 800 }}>info@padbol.com</a>. También tendrás ayuda de Chivi y soporte humano durante el alta.
          </p>
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
          ref={formRef}
          onSubmit={onSubmit}
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '22px 18px 24px',
            boxSizing: 'border-box',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          }}
        >
          <FormSection title={`Empieza ${selectedPlan.name === 'Explora' ? 'la consulta' : `con ${selectedPlan.name}`}`} subtitle={`Plan elegido: ${selectedPlan.name} · ${selectedPlan.price}. Solo necesitamos una referencia de la sede y una persona de contacto para abrir el proceso.`}>
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

          <p style={{ margin: '14px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
            Esta solicitud inicia el alta. La activación del plan y el medio de pago se confirman con vos antes de cualquier cobro.
          </p>

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
            {saving ? 'Enviando…' : selectedPlan.id === 'explorar' ? 'Enviar mi consulta' : `Comenzar con ${selectedPlan.name}`}
          </button>
        </form>
      </div>
    </div>
  );
}
