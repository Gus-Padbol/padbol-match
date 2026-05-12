import React from 'react';
import { Link } from 'react-router-dom';

const BG = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const ACCENT = '#E11B22';
const BORDER = '#E2E8F0';

export default function SobrePadbolMatch() {
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
        <h1 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>¿Qué es Padbol Match?</h1>
        <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55, color: MUTED, fontWeight: 500 }}>
          Padbol Match es la plataforma oficial para descubrir sedes, reservar canchas y vivir la red de clubes Padbol en
          todo el mundo. Nació con el deporte Padbol y hoy también conecta jugadores y clubes de Pádel, Pickleball,
          Fútbol y más deportes de cancha.
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55, color: MUTED, fontWeight: 500 }}>
          Desde un mismo lugar podés explorar clubes, ver disponibilidad, reservar turno y gestionar tu experiencia con
          el club.
        </p>
        <div
          style={{
            marginTop: 28,
            padding: 18,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            background: BG,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>¿Listo para jugar?</p>
          <Link
            to="/sedes"
            style={{
              display: 'inline-block',
              marginTop: 12,
              fontSize: 15,
              fontWeight: 800,
              color: ACCENT,
              textDecoration: 'none',
            }}
          >
            Explorar sedes →
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
