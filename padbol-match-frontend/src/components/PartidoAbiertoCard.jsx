import React from 'react';
import { DeporteIcono } from '../utils/deporteIcono';
import { hubCardPhotoPorDeporte } from '../constants/hubFotosPorDeporte';

export function partidoJugadorFotoUrl(jugador) {
  const u = jugador?.foto_url ?? jugador?.avatar_url;
  return u != null && String(u).trim() ? String(u).trim() : '';
}

export function partidoCapitanFotoUrl(partido) {
  const u =
    partido?.capitan_foto_url ??
    partido?.capitan?.foto_url ??
    partido?.capitan?.avatar_url;
  return u != null && String(u).trim() ? String(u).trim() : '';
}

export const DEPORTE_LABEL_PARTIDO_ABIERTO = {
  padbol: 'Padbol',
  padel: 'Pádel',
  tenis: 'Tenis',
  pickleball: 'Pickleball',
  squash: 'Squash',
  futbol_5: 'Fútbol 5',
  futbol_7: 'Fútbol 7',
};

const DEPORTE_HERO = {
  padbol: hubCardPhotoPorDeporte('padbol', 'buscar_partido') || 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80',
  padel: hubCardPhotoPorDeporte('padel', 'buscar_partido') || 'https://images.unsplash.com/photo-1595435934249-5df7ed86e2c1?w=800&q=80',
  tenis: hubCardPhotoPorDeporte('tenis', 'buscar_partido') || 'https://images.unsplash.com/photo-1595435934249-5df7ed86e2c1?w=800&q=80',
  pickleball: hubCardPhotoPorDeporte('pickleball', 'buscar_partido') || 'https://images.unsplash.com/photo-1622163642998-1ea36b1adcd3?w=800&q=80',
  squash: hubCardPhotoPorDeporte('squash', 'buscar_partido') || 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?w=800&q=80',
  futbol_5: hubCardPhotoPorDeporte('futbol_5', 'buscar_partido') || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
  futbol_7: hubCardPhotoPorDeporte('futbol_7', 'buscar_partido') || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
};

function fechaPartidoLabel(fecha) {
  if (!fecha) return 'Fecha a confirmar';
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(fecha).slice(0, 10);
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function horaPartidoLabel(hora) {
  const h = String(hora || '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  return m ? `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}` : h || '--:--';
}

export default function PartidoAbiertoCard({ partido, onJoin, joining = false, compact = false }) {
  const confirmados = Array.isArray(partido?.jugadores_confirmados) ? partido.jugadores_confirmados : [];
  const requeridos = Math.max(2, parseInt(String(partido?.jugadores_requeridos || '4'), 10) || 4);
  const faltan = Math.max(0, requeridos - confirmados.length);
  const capitanFoto = partidoCapitanFotoUrl(partido);
  const capitanNombre = String(partido?.capitan_nombre || '').trim() || 'Organizador';
  const dep = String(partido?.deporte || 'padbol').toLowerCase();
  const hero = DEPORTE_HERO[dep] || DEPORTE_HERO.padbol;

  return (
    <article
      style={{
        width: '100%',
        borderRadius: 12,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        boxShadow: compact ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          height: compact ? 100 : 120,
          background: `#6B6B6B url(${hero}) center/cover no-repeat`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.04,
            background: faltan > 0 ? '#16A34A' : '#E11B22',
            color: '#fff',
          }}
        >
          {faltan > 0 ? 'LUGARES DISPONIBLES' : 'SIN LUGAR'}
        </div>
      </div>

      <div style={{ padding: compact ? 14 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {capitanFoto ? (
            <img
              src={capitanFoto}
              alt={capitanNombre}
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', background: 'var(--pm-color-muted-bg)', border: '1px solid var(--border)' }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--pm-color-muted-bg)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 16,
                border: '1px solid var(--border)',
              }}
            >
              {capitanNombre.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{capitanNombre}</strong>
            <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Organizador</span>
          </div>
        </div>

        <h3
          style={{
            margin: '0 0 10px',
            fontSize: compact ? 17 : 18,
            lineHeight: 1.25,
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <DeporteIcono deporte={partido?.deporte} size={20} color="var(--accent)" />
          <span>
            {DEPORTE_LABEL_PARTIDO_ABIERTO[partido?.deporte] || partido?.deporte || 'Partido'} ·{' '}
            {partido?.sede_nombre || 'Sede'}
          </span>
        </h3>
        <ul
          style={{
            margin: '0 0 14px',
            paddingLeft: 18,
            color: 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.55,
          }}
        >
          <li>{fechaPartidoLabel(partido?.fecha)}</li>
          <li>Hora {horaPartidoLabel(partido?.hora)}</li>
          <li>Nivel {partido?.nivel || 'Principiante'}</li>
          <li>Cancha {partido?.cancha || '—'}</li>
          <li>{partido?.duracion_minutos || 90} min</li>
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: onJoin ? 14 : 0 }}>
          {Array.from({ length: requeridos }, (_, idx) => {
            const jugador = confirmados[idx];
            const foto = partidoJugadorFotoUrl(jugador);
            const nombre = String(jugador?.nombre || '').trim() || 'Jugador';
            return foto ? (
              <img
                key={idx}
                src={foto}
                alt={nombre}
                title={nombre}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
              />
            ) : (
              <span
                key={idx}
                title={jugador ? nombre : 'Libre'}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: jugador ? '2px solid var(--border)' : '2px dashed var(--text-secondary)',
                  background: jugador ? 'var(--pm-color-muted-bg)' : 'var(--bg-card)',
                  color: jugador ? 'var(--text-primary)' : 'var(--text-secondary)',
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {jugador ? nombre.charAt(0).toUpperCase() : '+'}
              </span>
            );
          })}
        </div>

        {onJoin ? (
          <button
            type="button"
            onClick={() => onJoin(partido)}
            disabled={joining || faltan <= 0}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 8,
              padding: '14px 16px',
              background: joining || faltan <= 0 ? 'var(--border)' : 'var(--pm-color-primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 16,
              cursor: joining || faltan <= 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {joining ? 'Enviando...' : faltan <= 0 ? 'Partido completo' : 'Quiero jugar'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
