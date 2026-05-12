import React from 'react';
import { Link } from 'react-router-dom';

const BG = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const ACCENT = '#E11B22';
const BORDER = '#E2E8F0';
const MAIL = 'mailto:info@padbol.com';

export default function ContactoSumarClub() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        color: TEXT,
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
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
        <h1 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>Sumar mi club</h1>
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.55, color: MUTED, fontWeight: 500 }}>
          Si representás a un club y querés formar parte de Padbol Match, escribinos. Te respondemos con los pasos para
          alta y configuración en la plataforma.
        </p>
        <a
          href={MAIL}
          style={{
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
            marginBottom: 20,
          }}
        >
          Escribir a info@padbol.com
        </a>
        <div
          style={{
            padding: 18,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            background: BG,
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: TEXT }}>Solicitud online</p>
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: MUTED }}>
            También podés dejar los datos del club en nuestro formulario de alta.
          </p>
          <Link
            to="/unirse"
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: ACCENT,
              textDecoration: 'none',
            }}
          >
            Ir a solicitud de club →
          </Link>
        </div>
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${BORDER}`, fontSize: 13 }}>
          <Link to="/terminos" style={{ color: MUTED, fontWeight: 600, textDecoration: 'none' }}>
            Términos
          </Link>
          <span style={{ color: BORDER, margin: '0 8px' }}>|</span>
          <Link to="/privacidad" style={{ color: MUTED, fontWeight: 600, textDecoration: 'none' }}>
            Privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
