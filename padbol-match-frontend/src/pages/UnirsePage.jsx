import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import '../pages/LandingPage.css';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES, paisTelefonoTranslationKey } from '../constants/paisesTelefono';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { commercialFlowCopy } from './commercialFlowCopy';
import { COMMERCIAL_PLANS_PREVIEW, PRO_MONTHLY_AMOUNT_USD, PADBOL_COURTS_PRO_MONTHLY_AMOUNT_USD, PADBOL_COURTS_PRO_OBJECTIVES_MONTHLY_AMOUNT_USD, PADBOL_COURTS_VENUE_SERVICE_PERCENT } from '../config/commercialPlans';

const API_BASE = getApiBaseUrl();

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
  const onboardingCopy = flowCopy.onboarding;
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
  const selectedPlan = COMMERCIAL_PLANS_PREVIEW.find((plan) => plan.slug === requestedPlanId && !plan.contactOnly)
    || COMMERCIAL_PLANS_PREVIEW.find((plan) => plan.slug === 'starter');
  const legacyPlans = [];
  const selectedPlanId = '';
  const countryOptions = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('landing-page-active');
    window.scrollTo(0, 0);
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
          mensaje: `[Beneficio Padbol Courts solicitado: 3 meses iniciales de Padbol Match Pro sin cargo; desde el cuarto mes, USD 34 de referencia sobre la base de USD 68; otro 50% sobre USD 34 únicamente al cumplir las cuatro metas mensuales, sin descuentos parciales: organizar y finalizar al menos un torneo al mes, gestionado íntegramente en Padbol Match, con al menos 8 parejas y jugadores inscritos desde la app (sorteo automático o manual por el club y zonas en el sistema); registrar todos los resultados en Padbol Match: el último punto de la final en el marcador digital define al campeón y finaliza el torneo; los demás partidos pueden registrarse en vivo desde PC o tablet o cargarse manualmente al terminar, sin pantalla física obligatoria, 12 reservas reales completadas al mes, realizadas desde la app por usuarios verificados (las reservas canceladas no cuentan), y al menos 10 jugadores distintos vinculados a la sede con actividad real mensual (cada persona cuenta una sola vez, también quienes juegan efectivamente en los torneos; pueden repetirse de meses anteriores); tarifa mínima USD 17, metas no acumulables; facturación cerrada]\n[Otros deportes en la sede: ${form.tiene_otros_deportes === 'si' ? 'Sí' : 'No'}]`,
          solicitud_inicial: true,
        }
      : {
          club_nombre: form.club_nombre.trim(),
          responsable_nombre: form.responsable_nombre.trim(),
          email: em,
          whatsapp: wa,
          mensaje: `[${t('clubOnboarding.request.planLabel')}: ${selectedPlan.name} — ${selectedPlan.monthlyAmount === 0 ? onboardingCopy.starterNote : `${selectedPlan.currency} ${selectedPlan.monthlyAmount}/mes`}]${form.mensaje.trim() ? `\n${form.mensaje.trim()}` : ''}`,
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
        onBack={() => (isPadbolPromo ? navigate('/planes#padbol-owner-title') : navigate(-1))}
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
              {[
                [PRO_MONTHLY_AMOUNT_USD, promoCopy.basePriceLabel, promoCopy.basePriceDetail],
                [PADBOL_COURTS_PRO_MONTHLY_AMOUNT_USD, promoCopy.benefits[1][1], promoCopy.benefits[1][2]],
                [PADBOL_COURTS_PRO_OBJECTIVES_MONTHLY_AMOUNT_USD, promoCopy.benefits[2][1], promoCopy.benefits[2][2]],
              ].map(([amount, title, detail]) => (
                <article
                  key={amount}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '16px 15px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ color: '#f7c948', fontSize: 32, fontWeight: 900 }}>USD {amount}</span>
                  <strong style={{ display: 'block', margin: '7px 0 5px', color: 'var(--text-primary)', fontSize: 15 }}>{title}</strong>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>{detail}</p>
                </article>
              ))}
            </section>

            <p style={{ color: '#f7c948', fontWeight: 800, fontSize: 18, margin: '0 0 18px' }}>
              {promoCopy.venueServiceLabel}: {PADBOL_COURTS_VENUE_SERVICE_PERCENT}%
            </p>

            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
              <strong style={{ color: '#f7c948' }}>{promoCopy.benefits[0][1]}.</strong> {promoCopy.benefits[0][2]}
            </p>

            <section
              aria-labelledby="promo-monthly-goals-title"
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
              <h2 id="promo-monthly-goals-title" style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 19, lineHeight: 1.2 }}>
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
              <aside
                aria-labelledby="promo-growth-advice-title"
                style={{
                  marginTop: 14,
                  padding: '13px 14px',
                  borderRadius: 11,
                  background: 'color-mix(in srgb, #f7c948 8%, var(--bg-card))',
                  border: '1px solid color-mix(in srgb, #f7c948 24%, var(--border))',
                }}
              >
                <h3 id="promo-growth-advice-title" style={{ display: 'block', margin: '0 0 5px', color: 'var(--text-primary)', fontSize: 13 }}>
                  {promoCopy.outreachTitle}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                  {promoCopy.outreachText}
                </p>
              </aside>
              </div>
            </section>
          </>
        ) : (
          <>
            <section style={{ background: 'linear-gradient(145deg, var(--bg-card), color-mix(in srgb, #e11b22 8%, var(--bg-card)))', border: '1px solid color-mix(in srgb, #e11b22 30%, var(--border))', borderRadius: 16, padding: '24px 20px', marginBottom: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
              <p style={{ margin: '0 0 8px', color: '#e11b22', fontSize: 12, fontWeight: 900, letterSpacing: '.09em' }}>{onboardingCopy.eyebrow}</p>
              <h1 style={{ color: 'var(--text-primary)', margin: '0 0 10px', fontSize: 'clamp(1.55rem, 4vw, 2rem)', fontWeight: 900, lineHeight: 1.14 }}>{onboardingCopy.title}</h1>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.55, fontSize: 15 }}>{onboardingCopy.lead}</p>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '13px 14px', background: 'rgba(15,23,42,.22)' }}>
                <span style={{ display: 'block', color: '#e11b22', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', marginBottom: 4 }}>{onboardingCopy.selectedPlan}</span>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 18 }}>{selectedPlan.name}</strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45, marginTop: 4 }}>{selectedPlan.slug === 'starter' ? onboardingCopy.starterNote : onboardingCopy.proNote}</span>
              </div>
            </section>

            <section style={{ margin: '0 0 20px' }}>
              <h2 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: 'clamp(1.2rem, 3vw, 1.45rem)', lineHeight: 1.15 }}>{onboardingCopy.includes}</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 9 }}>
                {selectedPlan.features.map((feature) => <li key={feature} style={{ padding: '12px 13px', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)', fontSize: 13, lineHeight: 1.4 }}>✓ {feature}</li>)}
              </ul>
            </section>
            <section style={{ margin: '0 0 20px' }}>
              <h2 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: 'clamp(1.2rem, 3vw, 1.45rem)', lineHeight: 1.15 }}>{onboardingCopy.nextTitle}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                {onboardingCopy.steps.map(([number, title, detail]) => <article key={number} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '15px 14px', background: 'var(--bg-card)' }}><span style={{ color: '#e11b22', fontWeight: 900, fontSize: 12 }}>{number}</span><strong style={{ display: 'block', color: 'var(--text-primary)', margin: '6px 0 4px', fontSize: 15 }}>{title}</strong><p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13, lineHeight: 1.45 }}>{detail}</p></article>)}
              </div>
            </section>

        <section style={{ display: 'none' }} aria-hidden="true">
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
            {legacyPlans.map((plan) => {
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
              <FormSection title={onboardingCopy.formTitle} subtitle={onboardingCopy.formLead}>
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
                : onboardingCopy.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
