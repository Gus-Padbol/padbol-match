import React from 'react';
import { Link } from 'react-router-dom';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { authUrlWithRedirect } from '../utils/authLoginRedirect';

const ACCENT = '#E11B22';
const BG = '#FFFFFF';
const TEXT = '#0F172A';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';
const COL_MAX = 390;

const shell = {
  minHeight: '100dvh',
  width: '100%',
  maxWidth: '100%',
  margin: 0,
  boxSizing: 'border-box',
  background: BG,
  color: TEXT,
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
  boxShadow: '0 4px 14px rgba(225, 27, 34, 0.28)',
};

const btnSecondary = {
  ...btnPrimary,
  background: BG,
  color: ACCENT,
  border: `2px solid ${ACCENT}`,
  boxShadow: 'none',
};

const btnOutline = {
  ...btnPrimary,
  background: BG,
  color: TEXT,
  border: `1px solid ${BORDER}`,
  fontWeight: 700,
  boxShadow: 'none',
};

function HowCard({ emoji, title, description }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '20px 18px',
        background: BG,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 2, background: ACCENT, marginBottom: 12 }} aria-hidden />
      <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 10 }} aria-hidden>
        {emoji}
      </div>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 17,
          fontWeight: 800,
          color: TEXT,
          lineHeight: 1.25,
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: TEXT_MUTED, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const reservarConLogin = authUrlWithRedirect('/reservar');

  return (
    <div style={shell}>
      <header style={{ ...column, textAlign: 'center', paddingBottom: 8 }}>
        <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ ...padbolLogoImgStyle, height: 72, maxWidth: '100%' }} />
      </header>

      <main style={column}>
        <section style={{ paddingTop: 8, paddingBottom: 28 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1.15,
              color: TEXT,
              letterSpacing: '-0.02em',
            }}
          >
            Nació con Padbol.
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1.15,
              color: TEXT,
              letterSpacing: '-0.02em',
            }}
          >
            Hoy es para todos los deportes.
          </p>
          <p
            style={{
              margin: '16px 0 0',
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.5,
              color: TEXT_MUTED,
            }}
          >
            La plataforma que lleva el Padbol al mundo, y abre sus puertas al Pádel, Pickleball, Fútbol y más.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
          <Link to={reservarConLogin} style={btnPrimary}>
            Reservar un turno
          </Link>
          <Link to="/sedes" style={btnSecondary}>
            Explorar Padbol Match
          </Link>
          <Link to="/auth?modo=registro" style={btnOutline}>
            Crear una cuenta
          </Link>
        </section>

        <section style={{ marginBottom: 44 }}>
          <h2
            style={{
              margin: '0 0 20px',
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 800,
              color: TEXT,
            }}
          >
            ¿Cómo funciona?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <HowCard
              emoji="📍"
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
            borderTop: `1px solid ${BORDER}`,
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
              borderTop: `1px solid ${BORDER}`,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            <Link to="/terminos" style={{ color: TEXT_MUTED, fontWeight: 600, textDecoration: 'none' }}>
              Términos
            </Link>
            <span style={{ color: BORDER, margin: '0 8px' }}>|</span>
            <Link to="/privacidad" style={{ color: TEXT_MUTED, fontWeight: 600, textDecoration: 'none' }}>
              Privacidad
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
