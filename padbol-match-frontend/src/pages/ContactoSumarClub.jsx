import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

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

export default function ContactoSumarClub() {
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
          ← Inicio
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
          Sumar mi club
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
          Completa el formulario y nos ponemos en contacto para darte de alta en la plataforma.
        </p>
        <Link to="/unirse" style={{ ...btnPrimary, marginBottom: 14 }}>
          Completar formulario de alta
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
          ¿Tienes dudas?{' '}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}
          >
            Escribinos por WhatsApp
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
            Términos
          </Link>
          <span style={{ color: 'var(--border)', margin: '0 8px' }}>|</span>
          <Link to="/privacidad" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
            Privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
