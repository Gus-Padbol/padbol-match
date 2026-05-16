import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { IconGeroUbicacion } from '../components/icons/GeroIcons';
import './LandingPage.css';

const ACCENT = '#E11B22';
const COL_MAX = 390;

const shell = {
  paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
  paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
};

const column = {
  width: '100%',
  maxWidth: COL_MAX,
  marginLeft: 'auto',
  marginRight: 'auto',
  paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
  boxSizing: 'border-box',
};

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
  boxShadow: '0 4px 0 #6b0a0a, 0 6px 24px rgba(220, 30, 30, 0.5)',
  borderTop: '1px solid rgba(255, 80, 80, 0.3)',
};

const btnSecondary = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '15px 18px',
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 16,
  cursor: 'pointer',
  textDecoration: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: ACCENT,
  background: 'transparent',
  border: '2px solid #e02020',
  boxShadow: '0 6px 0 #6b0a0a, 0 8px 20px rgba(180, 20, 20, 0.35)',
};

const btnCuenta = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '15px 18px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
  textDecoration: 'none',
  color: 'var(--text-primary)',
  background: 'var(--bg-input)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  boxShadow: '0 4px 0 #0a0d18, 0 6px 12px rgba(0, 0, 0, 0.35)',
};

function HowCard({ lead, emoji, title, description }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 18px',
        background: 'var(--bg-card)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 2, background: ACCENT, marginBottom: 12 }} aria-hidden />
      <div
        style={{
          fontSize: lead ? undefined : 26,
          lineHeight: 1,
          marginBottom: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        {lead != null ? lead : emoji}
      </div>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 17,
          fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.25,
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const location = useLocation();

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

  useEffect(() => {
    window.scrollTo(0, 0);
    try {
      if (typeof document !== 'undefined') {
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname, location.key]);

  return (
    <div className="landing-page" style={shell}>
      <header style={{ ...column, textAlign: 'center', paddingBottom: 0 }}>
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            ...padbolLogoImgStyle,
            width: 120,
            height: 120,
            maxWidth: '100%',
            objectFit: 'contain',
            marginBottom: 20,
          }}
        />
      </header>

      <main style={column}>
        <section style={{ paddingTop: 0, paddingBottom: 28, textAlign: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              lineHeight: 1.3,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Nació con Padbol.
            <br />
            Hoy es para todos los deportes.
          </h1>
          <p
            style={{
              margin: '16px 0 0',
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            La plataforma que lleva el Padbol al mundo, y abre sus puertas al Pádel, Pickleball, Fútbol y más.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <Link to="/reservar" style={btnPrimary}>
            Reservar un turno
          </Link>
          <Link to="/hub" style={btnSecondary}>
            Entrá y empezá a jugar
          </Link>
          <Link to="/auth?modo=registro" style={btnCuenta}>
            Crear una cuenta
          </Link>
        </section>

        <p
          style={{
            margin: '0 0 40px',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          Podés explorar la app sin registrarte. Te pediremos iniciar sesión solo al confirmar una reserva, al
          inscribirte o al comprar.
        </p>

        <section style={{ marginBottom: 44 }}>
          <h2
            style={{
              margin: '0 0 20px',
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            ¿Cómo funciona?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <HowCard
              lead={<IconGeroUbicacion size={26} style={{ color: ACCENT }} />}
              title="Encuentra tu sede"
              description="Busca clubes y elige el que mejor te quede por ubicación y horarios."
            />
            <HowCard
              emoji="📅"
              title="Reserva tu cancha"
              description="Elige fecha, horario y cancha disponible. Paga online o según las opciones del club."
            />
            <HowCard
              emoji="⚽"
              title="Juega"
              description="Recibe la confirmación y a disfrutar del partido en la red de Padbol."
            />
          </div>
        </section>

        <footer
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Link to="/contacto" style={{ ...btnPrimary, maxWidth: '100%' }}>
            Quiero sumar mi club
          </Link>
          <Link
            to="/sobre"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: ACCENT,
              textDecoration: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ¿Qué es Padbol Match?
          </Link>
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            <Link to="/terminos" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
              Términos
            </Link>
            <span style={{ color: 'var(--border)', margin: '0 8px' }}>|</span>
            <Link to="/privacidad" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
              Privacidad
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
