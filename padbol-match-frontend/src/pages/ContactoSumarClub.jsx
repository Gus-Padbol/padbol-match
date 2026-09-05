import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES } from '../constants/paisesTelefono';
import './LandingPage.css';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const ACCENT = '#E11B22';

const btnPrimary = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '15px 18px',
  borderRadius: 12,
  border: 'none',
  fontWeight: 800,
  fontSize: 16,
  cursor: 'pointer',
  textDecoration: 'none',
  color: '#fff',
  background: ACCENT,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  boxShadow: 'none',
};

const WHATSAPP_URL = 'https://wa.me/17864588533';

const API_BASE = String(
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? process.env.REACT_APP_API_BASE_URL
    : 'https://padbol-backend.onrender.com',
).replace(/\/$/, '');

const BUSINESS_SPORTS = [
  ['padbol', 'Padbol'],
  ['padel', 'Pádel'],
  ['pickleball', 'Pickleball'],
  ['tenis', 'Tenis'],
];

const BUSINESS_FORM_INITIAL = {
  organizacion: '',
  responsable: '',
  pais: '',
  ubicacion: '',
  sedes: '',
  canchas: '',
  deporte: '',
  otros_deportes: '',
  email: '',
  whatsapp: '',
};

function BusinessContactForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(BUSINESS_FORM_INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const countries = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const inputStyle = {
    width: '100%',
    padding: '12px 13px',
    border: '1px solid #d8d2c5',
    borderRadius: 10,
    boxSizing: 'border-box',
    background: '#fff',
    color: '#172033',
    fontSize: 16,
  };
  const labelStyle = { display: 'block', margin: '15px 0 6px', color: '#172033', fontSize: 13, fontWeight: 800 };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const venueCount = Number.parseInt(form.sedes, 10);
    const courtCount = Number.parseInt(form.canchas, 10);
    if (!Number.isInteger(venueCount) || venueCount < 2) {
      setError('Indicá cuántas sedes tiene la organización. Para una sola sede podés elegir Starter o Pro.');
      return;
    }
    if (!Number.isInteger(courtCount) || courtCount < 1) {
      setError('Indicá la cantidad total aproximada de canchas.');
      return;
    }
    const email = form.email.trim().toLowerCase();
    const whatsapp = form.whatsapp.trim();
    const body = {
      club_nombre: form.organizacion.trim(),
      club_direccion: form.ubicacion.trim(),
      pais: form.pais.trim(),
      ciudad: form.ubicacion.trim(),
      provincia_estado: form.ubicacion.trim(),
      club_telefono: whatsapp,
      club_email: email,
      responsable_nombre: form.responsable.trim(),
      responsable_cargo: 'manager',
      email,
      whatsapp,
      cantidad_canchas: courtCount,
      deportes_canchas: {
        deportes: [form.deporte],
        canchas: { [form.deporte]: courtCount },
      },
      mensaje: `[Plan consultado: Business]\n[Cantidad de sedes: ${venueCount}]\n[Deporte principal: ${BUSINESS_SPORTS.find(([key]) => key === form.deporte)?.[1] || form.deporte}]\n[Otros deportes: ${form.otros_deportes === 'si' ? 'Sí' : 'No'}]`,
      solicitud_inicial: true,
    };
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/solicitudes-licencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || response.statusText);
      setForm(BUSINESS_FORM_INITIAL);
      setSuccess('Recibimos tu consulta Business. Nuestro equipo te contactará para definir la estructura multisede y una propuesta por volumen.');
    } catch (submitError) {
      setError(submitError?.message || 'No se pudo enviar la consulta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="landing-page" style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <AppHeader title="Consulta Plan Business" onBack={() => navigate('/planes')} backLabel="← Volver a planes" />
      <main style={{ width: 'min(760px, calc(100% - 32px))', margin: '0 auto', padding: '112px 0 48px' }}>
        <img
          src="/media/public-site/jero/padbol-match-logo-white.svg"
          alt="Padbol Match"
          style={{ width: 180, height: 'auto', display: 'block', margin: '0 auto 22px' }}
        />
        <section style={{ padding: '25px 22px', border: '1px solid rgba(242,201,76,.35)', borderRadius: 16, background: 'linear-gradient(145deg,#1e2635,#171d28)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', color: '#f2c94c', fontSize: 12, fontWeight: 900, letterSpacing: '.12em' }}>BUSINESS · CADENAS Y OPERADORES MULTISEDE</p>
          <h1 style={{ margin: '0 0 10px', color: '#fff', fontSize: 'clamp(1.55rem, 4vw, 2.1rem)', lineHeight: 1.15 }}>Contanos cómo está formada tu organización</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,.68)', lineHeight: 1.55 }}>Preparamos la administración central, los permisos de cada sede y una propuesta acorde al volumen.</p>
        </section>

        {error ? <p role="alert" style={{ padding: 13, borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>{error}</p> : null}
        {success ? <p role="status" style={{ padding: 13, borderRadius: 10, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>{success}</p> : null}

        <form onSubmit={submit} style={{ marginTop: 18, padding: '24px 22px', border: '1px solid rgba(242,201,76,.28)', borderRadius: 16, background: '#f4f1e9', colorScheme: 'light', boxShadow: '0 16px 42px rgba(0,0,0,.2)' }}>
          <h2 style={{ margin: '0 0 4px', color: '#172033', fontSize: 20 }}>Datos para preparar la propuesta</h2>
          <p style={{ margin: '0 0 14px', color: '#626b78', fontSize: 13, lineHeight: 1.5 }}>La consulta no activa ningún plan, suscripción ni cobro.</p>

          <label htmlFor="business-organizacion" style={labelStyle}>Nombre de la organización o cadena *</label>
          <input id="business-organizacion" style={inputStyle} value={form.organizacion} onChange={(e) => field('organizacion', e.target.value)} required autoComplete="organization" />

          <label htmlFor="business-responsable" style={labelStyle}>Nombre y apellido del responsable *</label>
          <input id="business-responsable" style={inputStyle} value={form.responsable} onChange={(e) => field('responsable', e.target.value)} required autoComplete="name" />

          <label htmlFor="business-pais" style={labelStyle}>País principal *</label>
          <select id="business-pais" style={inputStyle} value={form.pais} onChange={(e) => field('pais', e.target.value)} required>
            <option value="">Seleccioná un país</option>
            {countries.map((country) => <option key={`${country.nombre}-${country.codigo}`} value={country.nombre}>{country.bandera} {country.nombre}</option>)}
          </select>

          <label htmlFor="business-ubicacion" style={labelStyle}>Ciudad o ubicación central *</label>
          <input id="business-ubicacion" style={inputStyle} value={form.ubicacion} onChange={(e) => field('ubicacion', e.target.value)} required autoComplete="address-level2" />

          <label htmlFor="business-sedes" style={labelStyle}>¿Cuántas sedes tiene la organización? *</label>
          <input id="business-sedes" type="number" min="2" step="1" inputMode="numeric" style={inputStyle} value={form.sedes} onChange={(e) => field('sedes', e.target.value)} required />

          <label htmlFor="business-canchas" style={labelStyle}>Cantidad total aproximada de canchas *</label>
          <input id="business-canchas" type="number" min="1" step="1" inputMode="numeric" style={inputStyle} value={form.canchas} onChange={(e) => field('canchas', e.target.value)} required />

          <label htmlFor="business-deporte" style={labelStyle}>Deporte principal *</label>
          <select id="business-deporte" style={inputStyle} value={form.deporte} onChange={(e) => field('deporte', e.target.value)} required>
            <option value="">Seleccioná un deporte</option>
            {BUSINESS_SPORTS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>

          <label htmlFor="business-otros" style={labelStyle}>¿Ofrece otros deportes? *</label>
          <select id="business-otros" style={inputStyle} value={form.otros_deportes} onChange={(e) => field('otros_deportes', e.target.value)} required>
            <option value="">Seleccioná una opción</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>

          <label htmlFor="business-email" style={labelStyle}>Email de contacto *</label>
          <input id="business-email" type="email" style={inputStyle} value={form.email} onChange={(e) => field('email', e.target.value)} required autoComplete="email" />

          <label htmlFor="business-whatsapp" style={labelStyle}>WhatsApp con código de país *</label>
          <input id="business-whatsapp" type="tel" style={inputStyle} value={form.whatsapp} onChange={(e) => field('whatsapp', e.target.value)} placeholder="+34…" required autoComplete="tel" />

          <button type="submit" disabled={saving} style={{ ...btnPrimary, marginTop: 22, opacity: saving ? .75 : 1 }}>
            {saving ? 'Enviando…' : 'Enviar consulta Business'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function ContactoSumarClub() {
  const location = useLocation();
  const isBusiness = new URLSearchParams(location.search).get('tema') === 'business';
  const { t } = useTranslation();
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

  if (isBusiness) return <BusinessContactForm />;

  return (
    <div
      className="landing-page"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        style={{
          maxWidth: 390,
          margin: '0 auto',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
          boxSizing: 'border-box',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-block',
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 600,
            color: ACCENT,
            textDecoration: 'none',
          }}
        >
          ← {t('aboutPage.home')}
        </Link>
        <h1
          style={{
            margin: '0 0 16px',
            fontSize: 24,
            fontWeight: 900,
            lineHeight: 1.2,
            color: 'var(--text-primary)',
          }}
        >
          {t('publicSite.contact.venue')}
        </h1>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          {t('clubOnboarding.hero.lead')}
        </p>
        <Link to="/unirse" style={{ ...btnPrimary, marginBottom: 14 }}>
          {t('clubOnboarding.form.startInquiry')}
        </Link>
        <p
          style={{
            margin: '0 0 40px',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          {t('clubOnboarding.contact.before')}{' '}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}
          >
            WhatsApp
          </a>
        </p>
        <div
          style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
            fontSize: 13,
          }}
        >
          <Link to="/terminos" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
            {t('legal.terminos')}
          </Link>
          <span style={{ color: 'var(--border)', margin: '0 8px' }}>|</span>
          <Link to="/privacidad" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
            {t('legal.privacidad')}
          </Link>
        </div>
      </div>
    </div>
  );
}
