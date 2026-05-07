import React from 'react';
import { Link } from 'react-router-dom';

const IG_DEFAULT = 'https://www.instagram.com/padbolmatch/';
const CONTACT_MAIL = 'mailto:hola@padbolmatch.com';

const instagramUrl =
  (typeof import.meta !== 'undefined' && String(import.meta.env?.VITE_PADBOL_INSTAGRAM_URL || '').trim()) || IG_DEFAULT;

/** Contraste sobre fondo oscuro (App.css fuerza h2/h3 en #1a1a1a si no hay color inline). */
const c = {
  title: '#FFFFFF',
  titleSoft: '#E2E8F0',
  body: '#CBD5E1',
  muted: '#94A3B8',
  accentStat: '#C4B5FD',
  footerLink: '#E2E8F0',
  footerDot: 'rgba(226, 232, 240, 0.35)',
};

const shell = {
  position: 'relative',
  minHeight: '100vh',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  overflowX: 'hidden',
  background: 'linear-gradient(180deg, #0b1020 0%, #151832 38%, #1a1040 100%)',
  color: c.body,
};

const btnLoginTop = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
  fontWeight: 600,
  color: c.titleSoft,
  textDecoration: 'none',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255, 255, 255, 0.22)',
  background: 'rgba(255, 255, 255, 0.06)',
  boxSizing: 'border-box',
};

const section = {
  width: '100%',
  maxWidth: 'min(720px, 100%)',
  marginLeft: 'auto',
  marginRight: 'auto',
  paddingLeft: 'clamp(16px, 4vw, 24px)',
  paddingRight: 'clamp(16px, 4vw, 24px)',
  boxSizing: 'border-box',
};

const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  maxWidth: '320px',
  padding: '14px 22px',
  borderRadius: '14px',
  border: 'none',
  fontWeight: 800,
  fontSize: 'clamp(15px, 3.8vw, 16px)',
  cursor: 'pointer',
  textDecoration: 'none',
  color: '#fff',
  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
  boxShadow: '0 6px 22px rgba(34, 197, 94, 0.35)',
  boxSizing: 'border-box',
};

const btnSecondary = {
  ...btnPrimary,
  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  boxShadow: '0 6px 22px rgba(99, 102, 241, 0.35)',
};

const card = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px',
  padding: 'clamp(18px, 4vw, 24px)',
  boxSizing: 'border-box',
};

function StepCard({ icon, title, text }) {
  return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ fontSize: 'clamp(36px, 9vw, 44px)', lineHeight: 1, marginBottom: '12px' }} aria-hidden>
        {icon}
      </div>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 'clamp(1rem, 3.5vw, 1.1rem)',
          fontWeight: 800,
          color: c.titleSoft,
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 'clamp(0.88rem, 3.2vw, 0.95rem)', color: c.body, lineHeight: 1.5 }}>
        {text}
      </p>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 'clamp(1.35rem, 5vw, 1.75rem)', fontWeight: 900, color: c.accentStat, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 'clamp(0.78rem, 2.8vw, 0.85rem)', color: c.muted, marginTop: '4px' }}>{label}</div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div style={shell}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          paddingRight: 'clamp(16px, 4vw, 24px)',
          paddingLeft: 'clamp(16px, 4vw, 24px)',
          paddingBottom: '4px',
        }}
      >
        <Link to="/login" style={btnLoginTop}>
          Iniciar sesión
        </Link>
      </div>
      <header style={{ ...section, paddingTop: 'clamp(12px, 5vw, 32px)', paddingBottom: 'clamp(8px, 3vw, 16px)' }}>
        <div style={{ textAlign: 'center' }}>
          <img
            src="/logo-padbol-match.png"
            alt="Padbol Match"
            style={{
              display: 'block',
              margin: '0 auto',
              height: 'clamp(120px, 28vw, 180px)',
              width: 'auto',
              maxWidth: 'min(92vw, 360px)',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.45))',
            }}
          />
          <p
            style={{
              margin: 'clamp(16px, 4vw, 24px) 0 0',
              fontSize: 'clamp(1.12rem, 4.2vw, 1.45rem)',
              fontWeight: 800,
              lineHeight: 1.3,
              color: c.title,
              maxWidth: 'min(92vw, 640px)',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            La plataforma deportiva más avanzada del planeta
          </p>
          <p
            style={{
              margin: 'clamp(12px, 3vw, 16px) 0 0',
              fontSize: 'clamp(0.95rem, 3.5vw, 1.05rem)',
              fontWeight: 600,
              lineHeight: 1.45,
              color: c.titleSoft,
              maxWidth: 'min(92vw, 560px)',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Reservas, torneos y ranking global para cualquier deporte, en cualquier país.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              marginTop: 'clamp(22px, 5vw, 32px)',
            }}
          >
            <Link to="/hub" style={btnPrimary}>
              Explorar Padbol Match
            </Link>
            <Link to="/unirse" style={btnSecondary}>
              Unirme como club
            </Link>
          </div>
        </div>
      </header>

      <section style={{ ...section, paddingTop: 'clamp(36px, 10vw, 56px)', paddingBottom: 'clamp(24px, 6vw, 40px)' }}>
        <h2
          style={{
            fontSize: 'clamp(1.25rem, 4.5vw, 1.5rem)',
            fontWeight: 900,
            margin: '0 0 clamp(18px, 4vw, 24px)',
            textAlign: 'center',
            color: c.title,
          }}
        >
          Cómo funciona
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '14px',
          }}
        >
          <StepCard icon="📍" title="Encontrá tu sede" text="Buscá clubes y elegí el que mejor te quede por ubicación y horarios." />
          <StepCard icon="📅" title="Reservá tu cancha" text="Elegí fecha, horario y cancha disponible. Pagá online o según las opciones del club." />
          <StepCard icon="⚽" title="Jugá" text="Recibí la confirmación y a disfrutar del partido en la red de Padbol." />
        </div>
      </section>

      <section
        style={{
          ...section,
          paddingTop: 'clamp(8px, 3vw, 16px)',
          paddingBottom: 'clamp(32px, 8vw, 48px)',
        }}
      >
        <div style={{ ...card, maxWidth: '100%' }}>
          <h2
            style={{
              fontSize: 'clamp(1.2rem, 4.2vw, 1.45rem)',
              fontWeight: 900,
              margin: '0 0 12px',
              textAlign: 'center',
              color: c.title,
            }}
          >
            De Padbol al mundo
          </h2>
          <p
            style={{
              margin: '0 0 22px',
              fontSize: 'clamp(0.92rem, 3.4vw, 1rem)',
              lineHeight: 1.65,
              color: c.body,
              textAlign: 'center',
            }}
          >
            Padbol Match{' '}
            <strong style={{ color: c.titleSoft, fontWeight: 800 }}>nació con Padbol</strong>
            {' '}—el deporte que fusiona fútbol, tenis y vóley en una cancha cerrada con red— y{' '}
            <strong style={{ color: c.titleSoft, fontWeight: 800 }}>hoy abre sus puertas a todos los deportes</strong>
            . Construimos una infraestructura internacional de primer nivel: misma exigencia de producto, misma ambición
            global. Conectamos clubes y jugadores sin fronteras, con herramientas pensadas para competir a escala mundial.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 'clamp(10px, 3vw, 16px)',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Stat value="30+" label="países" />
            <Stat value="200+" label="sedes" />
            <Stat value="12.000+" label="jugadores" />
          </div>
        </div>
      </section>

      <section style={{ ...section, paddingBottom: 'clamp(36px, 9vw, 56px)' }}>
        <div style={{ ...card, background: 'rgba(99, 102, 241, 0.12)', borderColor: 'rgba(165, 180, 252, 0.25)' }}>
          <h2
            style={{
              fontSize: 'clamp(1.2rem, 4.2vw, 1.45rem)',
              fontWeight: 900,
              margin: '0 0 14px',
              textAlign: 'center',
              color: c.title,
            }}
          >
            Para clubes
          </h2>
          <p
            style={{
              margin: '0 0 14px',
              fontSize: 'clamp(0.92rem, 3.35vw, 1rem)',
              lineHeight: 1.55,
              color: c.body,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            <strong style={{ color: c.titleSoft, fontWeight: 800 }}>Padbol, Pádel, Pickleball, Tenis, Fútbol</strong>
            {' '}y más: tu disciplina, nuestra plataforma.
          </p>
          <ul
            style={{
              margin: '0 0 20px',
              paddingLeft: '1.15rem',
              fontSize: 'clamp(0.9rem, 3.3vw, 0.98rem)',
              lineHeight: 1.55,
              color: c.body,
            }}
          >
            <li style={{ marginBottom: '8px' }}>Más visibilidad y reservas online para tus canchas</li>
            <li style={{ marginBottom: '8px' }}>Gestión de torneos, rankings y comunidad de jugadores</li>
            <li>Herramientas de cobro y presencia en el mapa oficial de Padbol Match</li>
          </ul>
          <div style={{ textAlign: 'center' }}>
            <Link
              to="/unirse"
              style={{
                ...btnSecondary,
                display: 'inline-flex',
                width: 'auto',
                minWidth: 'min(100%, 280px)',
              }}
            >
              Quiero sumar mi club
            </Link>
          </div>
        </div>
      </section>

      <footer
        style={{
          ...section,
          paddingTop: 'clamp(20px, 5vw, 28px)',
          paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        <nav aria-label="Pie de página">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '10px 16px',
              marginBottom: '14px',
            }}
          >
            <Link to="/torneos" style={{ color: c.footerLink, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
              Torneos
            </Link>
            <span style={{ color: c.footerDot }} aria-hidden>
              ·
            </span>
            <Link to="/rankings" style={{ color: c.footerLink, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
              Ranking
            </Link>
            <span style={{ color: c.footerDot }} aria-hidden>
              ·
            </span>
            <Link to="/sedes" style={{ color: c.footerLink, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
              Sedes
            </Link>
            <span style={{ color: c.footerDot }} aria-hidden>
              ·
            </span>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: c.footerLink, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}
            >
              Instagram
            </a>
            <span style={{ color: c.footerDot }} aria-hidden>
              ·
            </span>
            <a href={CONTACT_MAIL} style={{ color: c.footerLink, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
              Contacto
            </a>
          </div>
        </nav>
        <p style={{ margin: 0, textAlign: 'center', fontSize: '0.8rem', color: c.muted }}>
          © {new Date().getFullYear()} Padbol Match
        </p>
      </footer>
    </div>
  );
}
