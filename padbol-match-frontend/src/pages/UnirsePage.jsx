import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import '../pages/LandingPage.css';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES, paisTelefonoTranslationKey } from '../constants/paisesTelefono';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { commercialFlowCopy } from './commercialFlowCopy';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const PRECIO_MENSUAL_USD =
  typeof process !== 'undefined' && process.env.REACT_APP_PRECIO_MENSUAL_USD != null
    ? String(process.env.REACT_APP_PRECIO_MENSUAL_USD).trim().replace(/\/\s*mes\b/i, '').trim()
    : 'USD 29';

const SERVICE_PLAN_DEFINITIONS = [
  { id: 'explorar', number: '01', accent: '#22c55e' },
  { id: 'base', number: '02', price: PRECIO_MENSUAL_USD, accent: '#38bdf8' },
  { id: 'pro', number: '03', price: 'USD 59', accent: '#E11B22', featured: true },
  { id: '360', number: '04', price: 'USD 99', accent: '#f59e0b' },
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
    pais: '',
    ubicacion_sede: '',
    cantidad_canchas_padbol: '',
    tiene_otros_deportes: '',
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
  const { t, i18n } = useTranslation();
  const flowCopy = commercialFlowCopy(i18n.resolvedLanguage || i18n.language);
  const promoCopy = flowCopy.promo;
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState(getInitialForm);
  const query = new URLSearchParams(location.search);
  const isPadbolPromo = ['padbol-pro-renovable', 'padbol-pro-12m'].includes(query.get('promo'));
  const requestedPlanId = query.get('plan');
  const [selectedPlanId, setSelectedPlanId] = useState(() => (
    SERVICE_PLAN_DEFINITIONS.some((plan) => plan.id === requestedPlanId) ? requestedPlanId : 'base'
  ));
  const formRef = useRef(null);
  const servicePlans = SERVICE_PLAN_DEFINITIONS.map((plan) => ({
    ...plan,
    name: t(`clubOnboarding.plans.${plan.id}.name`),
    price: plan.price || t(`clubOnboarding.plans.${plan.id}.price`),
    period: t(`clubOnboarding.plans.${plan.id}.period`),
    description: t(`clubOnboarding.plans.${plan.id}.description`),
    includes: [1, 2, 3].map((item) => t(`clubOnboarding.plans.${plan.id}.include${item}`)),
  }));
  const selectedPlan = servicePlans.find((plan) => plan.id === selectedPlanId) || servicePlans[1];
  const countryOptions = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

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

    if (isPadbolPromo) {
      const requiredPromoFields = [
        form.club_nombre,
        form.responsable_nombre,
        form.email,
        form.whatsapp,
        form.pais,
        form.ubicacion_sede,
        form.cantidad_canchas_padbol,
        form.tiene_otros_deportes,
      ];
      if (requiredPromoFields.some((value) => !String(value || '').trim())) {
        setErr(promoCopy.required);
        return;
      }
      const courtCount = Number.parseInt(form.cantidad_canchas_padbol, 10);
      if (!Number.isInteger(courtCount) || courtCount < 1) {
        setErr(promoCopy.invalidCourts);
        return;
      }
    } else if (
      !form.club_nombre.trim() || !form.responsable_nombre.trim() || !form.email.trim() || !form.whatsapp.trim()
    ) {
      setErr(t('clubOnboarding.validation.required'));
      return;
    }

    const em = form.email.trim().toLowerCase();
    const wa = normalizeWs(form.whatsapp);
    const body = isPadbolPromo
      ? {
          club_nombre: form.club_nombre.trim(),
          club_direccion: form.ubicacion_sede.trim(),
          pais: form.pais.trim(),
          ciudad: form.ubicacion_sede.trim(),
          provincia_estado: form.ubicacion_sede.trim(),
          club_telefono: wa,
          club_email: em,
          responsable_nombre: form.responsable_nombre.trim(),
          responsable_cargo: 'propietario',
          email: em,
          whatsapp: wa,
          cantidad_canchas: Number.parseInt(form.cantidad_canchas_padbol, 10),
          deportes_canchas: {
            deportes: ['padbol'],
            canchas: { padbol: Number.parseInt(form.cantidad_canchas_padbol, 10) },
          },
          mensaje: `[Beneficio solicitado: 6 meses iniciales de Padbol Match Pro sin cargo y renovación mensual por continuidad]\n[Otros deportes en la sede: ${form.tiene_otros_deportes === 'si' ? 'Sí' : 'No'}]`,
          solicitud_inicial: true,
        }
      : {
          club_nombre: form.club_nombre.trim(),
          responsable_nombre: form.responsable_nombre.trim(),
          email: em,
          whatsapp: wa,
          mensaje: `[${t('clubOnboarding.request.planLabel')}: ${selectedPlan.name} — ${selectedPlan.price}]${form.mensaje.trim() ? `\n${form.mensaje.trim()}` : ''}`,
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
      setMsg(isPadbolPromo
        ? promoCopy.success
        : t('clubOnboarding.success', { plan: selectedPlan.name }));
      setForm(getInitialForm());
    } catch {
      setErr(t('clubOnboarding.error.submit'));
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
      <AppHeader
        title={isPadbolPromo ? promoCopy.header : t('clubOnboarding.header')}
        onBack={() => (isPadbolPromo ? navigate('/planes') : navigate(-1))}
        backLabel={isPadbolPromo ? `← ${t('general.back')}` : undefined}
      />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        <img
          src="/media/public-site/jero/padbol-match-logo-white.svg"
          alt="Padbol Match"
          style={{ width: '180px', height: 'auto', maxWidth: '85vw', display: 'block', margin: '0 auto 20px' }}
        />

        {isPadbolPromo ? (
          <>
            <section
              style={{
                background: 'linear-gradient(145deg, var(--bg-card), color-mix(in srgb, #f7c948 8%, var(--bg-card)))',
                border: '1px solid color-mix(in srgb, #f7c948 38%, var(--border))',
                borderRadius: '16px',
                padding: '28px 22px',
                marginBottom: '14px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 8px', color: '#f7c948', fontSize: 12, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                {promoCopy.eyebrow}
              </p>
              <h1 style={{ color: 'var(--text-primary)', margin: '0 0 10px', fontSize: 'clamp(1.55rem, 4vw, 2.15rem)', fontWeight: 900, lineHeight: 1.12 }}>
                {promoCopy.title}
              </h1>
              <p style={{ color: 'var(--text-secondary)', margin: '0 auto', lineHeight: 1.55, fontSize: '15px', maxWidth: 650 }}>
                {promoCopy.lead}
              </p>
            </section>

            <section
              aria-label={promoCopy.howAria}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                marginBottom: 18,
              }}
            >
              {promoCopy.benefits.map(([number, title, detail]) => (
                <article
                  key={number}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '16px 15px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ color: '#f7c948', fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>{number}</span>
                  <strong style={{ display: 'block', margin: '7px 0 5px', color: 'var(--text-primary)', fontSize: 15 }}>{title}</strong>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>{detail}</p>
                </article>
              ))}
            </section>

            <section
              style={{
                background: 'var(--bg-card)',
                border: '1px solid color-mix(in srgb, #f7c948 28%, var(--border))',
                borderRadius: 14,
                padding: '18px 18px 16px',
                marginBottom: 18,
              }}
            >
              <p style={{ margin: '0 0 5px', color: '#f7c948', fontSize: 11, fontWeight: 900, letterSpacing: '.09em', textTransform: 'uppercase' }}>
                {promoCopy.goalsEyebrow}
              </p>
              <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 19, lineHeight: 1.2 }}>
                {promoCopy.goalsTitle}
              </h2>
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                {promoCopy.goalsLead}
              </p>
              <details style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>{promoCopy.goalsSummary}</summary>
                <ul style={{ margin: '12px 0 2px', paddingLeft: 20, display: 'grid', gap: 7, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {promoCopy.goals.map((goal) => <li key={goal}>{goal}</li>)}
                </ul>
              </details>
              <div
                style={{
                  marginTop: 14,
                  padding: '13px 14px',
                  borderRadius: 11,
                  background: 'color-mix(in srgb, #f7c948 8%, var(--bg-card))',
                  border: '1px solid color-mix(in srgb, #f7c948 24%, var(--border))',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 5, color: 'var(--text-primary)', fontSize: 13 }}>
                  {promoCopy.outreachTitle}
                </strong>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                  {promoCopy.outreachText}
                </p>
              </div>
            </section>

            <section
              aria-labelledby="promo-launch-support-title"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, #e11b22 10%, var(--bg-card)), var(--bg-card))',
                border: '1px solid color-mix(in srgb, #e11b22 30%, var(--border))',
                borderRadius: 14,
                padding: '18px',
                marginBottom: 18,
              }}
            >
              <div>
                <p style={{ margin: '0 0 4px', color: '#f7c948', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {promoCopy.supportEyebrow}
                </p>
                <h2 id="promo-launch-support-title" style={{ margin: '0 0 7px', color: 'var(--text-primary)', fontSize: 19, lineHeight: 1.2 }}>
                  {promoCopy.supportTitle}
                </h2>
                <p style={{ margin: '0 0 9px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                  {promoCopy.supportText}
                </p>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
                  {promoCopy.supportNote}
                </p>
              </div>
            </section>
          </>
        ) : (
          <>
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
            {t('clubOnboarding.hero.title')}
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
            {t('clubOnboarding.hero.lead')}
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
              {t('clubOnboarding.hero.badge')}
            </span>
          </div>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {t('clubOnboarding.hero.guide')}
          </p>
        </section>

        <section style={{ margin: '0 0 20px' }}>
          <p style={{ margin: '0 0 7px', color: '#E11B22', fontSize: 12, fontWeight: 900, letterSpacing: '.09em', textTransform: 'uppercase' }}>
            {t('clubOnboarding.plansEyebrow')}
          </p>
          <h2 style={{ margin: '0 0 9px', color: 'var(--text-primary)', fontSize: 'clamp(1.25rem, 3vw, 1.55rem)', lineHeight: 1.12 }}>
            {t('clubOnboarding.plansTitle')}
          </h2>
          <p style={{ margin: '0 0 13px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.45 }}>
            {t('clubOnboarding.plansLead')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {servicePlans.map((plan) => {
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
                  {selected ? t('clubOnboarding.selected') : t('clubOnboarding.choose', { plan: plan.name })}
                </button>
              </article>
              );
            })}
          </div>
          <p style={{ margin: '14px 0 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>
            {t('clubOnboarding.contact.before')} <a href={`mailto:info@padbol.com?subject=${encodeURIComponent(t('clubOnboarding.contact.subject'))}`} style={{ color: '#E11B22', fontWeight: 800 }}>info@padbol.com</a>. {t('clubOnboarding.contact.after')}
          </p>
        </section>
          </>
        )}

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
            background: isPadbolPromo ? '#f4f1e9' : 'var(--bg-card)',
            borderRadius: '16px',
            padding: '22px 18px 24px',
            boxSizing: 'border-box',
            boxShadow: isPadbolPromo ? '0 16px 42px rgba(0,0,0,0.2)' : '0 12px 40px rgba(0,0,0,0.12)',
            ...(isPadbolPromo ? {
              '--bg-card': '#fffdf8',
              '--bg-input': '#ffffff',
              '--text-primary': '#172033',
              '--text-secondary': '#626b78',
              '--border': '#d8d2c5',
              colorScheme: 'light',
              border: '1px solid rgba(247,201,72,0.28)',
            } : {}),
          }}
        >
          {isPadbolPromo ? (
            <FormSection
              title={promoCopy.formTitle}
              subtitle={promoCopy.formSubtitle}
            >
              <label htmlFor="promo-club-nombre" style={labelStyle}>{promoCopy.clubName} *</label>
              <input id="promo-club-nombre" style={inputStyle} value={form.club_nombre} onChange={(e) => onField('club_nombre', e.target.value)} required autoComplete="organization" />

              <label htmlFor="promo-propietario" style={{ ...labelStyle, ...rowGap }}>{promoCopy.ownerName} *</label>
              <input id="promo-propietario" style={inputStyle} value={form.responsable_nombre} onChange={(e) => onField('responsable_nombre', e.target.value)} required autoComplete="name" />

              <label htmlFor="promo-pais" style={{ ...labelStyle, ...rowGap }}>{promoCopy.country} *</label>
              <select id="promo-pais" style={inputStyle} value={form.pais} onChange={(e) => onField('pais', e.target.value)} required>
                <option value="">{flowCopy.chooseCountry}</option>
                {countryOptions.map((country) => (
                  <option key={`${country.nombre}-${country.codigo}`} value={country.nombre}>
                    {country.bandera} {t(`paises.${paisTelefonoTranslationKey(country.nombre)}`, { defaultValue: country.nombre })}
                  </option>
                ))}
              </select>

              <label htmlFor="promo-ubicacion" style={{ ...labelStyle, ...rowGap }}>{promoCopy.location} *</label>
              <input id="promo-ubicacion" style={inputStyle} value={form.ubicacion_sede} onChange={(e) => onField('ubicacion_sede', e.target.value)} placeholder={promoCopy.locationPlaceholder} required autoComplete="address-level2" />

              <label htmlFor="promo-canchas-padbol" style={{ ...labelStyle, ...rowGap }}>{promoCopy.courtCount} *</label>
              <input id="promo-canchas-padbol" type="number" min="1" step="1" inputMode="numeric" style={inputStyle} value={form.cantidad_canchas_padbol} onChange={(e) => onField('cantidad_canchas_padbol', e.target.value)} required />

              <label htmlFor="promo-otros-deportes" style={{ ...labelStyle, ...rowGap }}>{promoCopy.otherSports} *</label>
              <select id="promo-otros-deportes" style={inputStyle} value={form.tiene_otros_deportes} onChange={(e) => onField('tiene_otros_deportes', e.target.value)} required>
                <option value="">{flowCopy.chooseOption}</option>
                <option value="si">{flowCopy.yes}</option>
                <option value="no">{flowCopy.no}</option>
              </select>

              <label htmlFor="promo-email" style={{ ...labelStyle, ...rowGap }}>{promoCopy.email} *</label>
              <input id="promo-email" type="email" style={inputStyle} value={form.email} onChange={(e) => onField('email', e.target.value)} required autoComplete="email" />

              <label htmlFor="promo-whatsapp" style={{ ...labelStyle, ...rowGap }}>{promoCopy.whatsapp} *</label>
              <input id="promo-whatsapp" type="tel" style={inputStyle} value={form.whatsapp} onChange={(e) => onField('whatsapp', e.target.value)} placeholder="+54 9…" required autoComplete="tel" />
            </FormSection>
          ) : (
            <>
              <FormSection title={selectedPlan.id === 'explorar' ? t('clubOnboarding.form.startInquiry') : t('clubOnboarding.form.startPlan', { plan: selectedPlan.name })} subtitle={t('clubOnboarding.form.subtitle', { plan: selectedPlan.name, price: selectedPlan.price })}>
                <label style={labelStyle}>{t('clubOnboarding.form.clubName')} *</label>
                <input style={inputStyle} value={form.club_nombre} onChange={(e) => onField('club_nombre', e.target.value)} required />
                <label style={{ ...labelStyle, ...rowGap }}>{t('clubOnboarding.form.fullName')} *</label>
                <input style={inputStyle} value={form.responsable_nombre} onChange={(e) => onField('responsable_nombre', e.target.value)} required />
                <label style={{ ...labelStyle, ...rowGap }}>{t('clubOnboarding.form.email')} *</label>
                <input type="email" style={inputStyle} value={form.email} onChange={(e) => onField('email', e.target.value)} required autoComplete="email" />
                <label style={{ ...labelStyle, ...rowGap }}>{t('clubOnboarding.form.whatsapp')} *</label>
                <input style={inputStyle} value={form.whatsapp} onChange={(e) => onField('whatsapp', e.target.value)} placeholder="+549…" required autoComplete="tel" />
              </FormSection>
              <label style={{ ...labelStyle, marginTop: 4 }}>{t('clubOnboarding.form.message')}</label>
              <textarea rows={3} style={{ ...inputStyle, resize: 'vertical', maxWidth: '100%' }} value={form.mensaje} onChange={(e) => onField('mensaje', e.target.value)} />

              <p style={{ margin: '14px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
                {t('clubOnboarding.form.disclaimer')}
              </p>
            </>
          )}

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
            {saving
              ? t('clubOnboarding.form.sending')
              : isPadbolPromo
                ? promoCopy.submit
                : selectedPlan.id === 'explorar'
                  ? t('clubOnboarding.form.sendInquiry')
                  : t('clubOnboarding.form.startPlan', { plan: selectedPlan.name })}
          </button>
        </form>
      </div>
    </div>
  );
}
