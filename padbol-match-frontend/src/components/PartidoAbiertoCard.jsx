import React from 'react';
import { DeporteIcono } from '../utils/deporteIcono';
import './PartidoAbiertoCard.css';

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

export function fechaPartidoLabel(fecha) {
  if (!fecha) return 'Fecha a confirmar';
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(fecha).slice(0, 10);
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function horaPartidoLabel(hora) {
  const h = String(hora || '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  return m ? `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}` : h || '--:--';
}

const MAX_SLOT_CIRCLES = 4;

function PartidoSlots({ confirmados, requeridos }) {
  const slotCount = Math.min(Math.max(2, requeridos), MAX_SLOT_CIRCLES);
  return (
    <div className="partido-abierto-card__slots" aria-label="Jugadores confirmados">
      {Array.from({ length: slotCount }, (_, idx) => {
        const jugador = confirmados[idx];
        const foto = partidoJugadorFotoUrl(jugador);
        const nombre = String(jugador?.nombre || '').trim() || 'Jugador';
        if (foto) {
          return (
            <img
              key={idx}
              src={foto}
              alt={nombre}
              title={nombre}
              className="partido-abierto-card__slot"
            />
          );
        }
        if (jugador) {
          return (
            <span
              key={idx}
              title={nombre}
              className="partido-abierto-card__slot-fallback"
              aria-hidden
            >
              {nombre.charAt(0).toUpperCase()}
            </span>
          );
        }
        return (
          <span key={idx} title="Libre" className="partido-abierto-card__slot-empty" aria-hidden>
            +
          </span>
        );
      })}
    </div>
  );
}

/**
 * @param {'full'|'sede'} [variant] — `sede`: fila compacta en perfil público (sin fila de organizador)
 */
export default function PartidoAbiertoCard({
  partido,
  onJoin,
  joining = false,
  onCardClick,
  variant = 'full',
  /** @deprecated Siempre compacto; se ignora */
  compact: _compact = false,
}) {
  const confirmados = Array.isArray(partido?.jugadores_confirmados) ? partido.jugadores_confirmados : [];
  const requeridos = Math.max(2, parseInt(String(partido?.jugadores_requeridos || '4'), 10) || 4);
  const faltan = Math.max(0, requeridos - confirmados.length);
  const capitanFoto = partidoCapitanFotoUrl(partido);
  const capitanNombre = String(partido?.capitan_nombre || '').trim() || 'Organizador';
  const dep = String(partido?.deporte || 'padbol').toLowerCase();
  const depLabel = DEPORTE_LABEL_PARTIDO_ABIERTO[dep] || partido?.deporte || 'Partido';
  const sedeNombre = String(partido?.sede_nombre || 'Sede').trim() || 'Sede';
  const nivel = String(partido?.nivel || 'Principiante').trim() || 'Principiante';
  const cancha = String(partido?.cancha_nombre || partido?.cancha || '—').trim() || '—';
  const duracion = Number(partido?.duracion_minutos) > 0 ? Number(partido.duracion_minutos) : 90;
  const isSede = variant === 'sede';
  const lugaresLabel = faltan > 0 ? 'LUGARES DISPONIBLES' : 'SIN LUGAR';

  const handleCardClick = onCardClick
    ? (e) => {
        if (e.target.closest('button')) return;
        onCardClick(partido);
      }
    : undefined;

  const ctaLabel = joining
    ? isSede
      ? '…'
      : 'Enviando...'
    : faltan <= 0
      ? 'Partido completo'
      : 'Quiero jugar';

  return (
    <article
      className={[
        'partido-abierto-card',
        isSede ? 'partido-abierto-card--sede' : '',
        onCardClick ? 'partido-abierto-card--clickable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleCardClick}
      onKeyDown={
        onCardClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardClick(partido);
              }
            }
          : undefined
      }
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
    >
      <div className="partido-abierto-card__row partido-abierto-card__row--head">
        <div className="partido-abierto-card__head-main">
          <DeporteIcono deporte={dep} size={18} color="var(--accent)" />
          <span className="partido-abierto-card__title">
            {depLabel} · {sedeNombre}
          </span>
        </div>
        {isSede ? null : (
          <span
            className={[
              'partido-abierto-card__badge',
              faltan <= 0 ? 'partido-abierto-card__badge--full' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {lugaresLabel}
          </span>
        )}
      </div>

      <div className="partido-abierto-card__row partido-abierto-card__row--meta">
        <span className="partido-abierto-card__meta-item">{fechaPartidoLabel(partido?.fecha)}</span>
        <span className="partido-abierto-card__meta-sep" aria-hidden>
          ·
        </span>
        <span className="partido-abierto-card__meta-item">{horaPartidoLabel(partido?.hora)}</span>
        <span className="partido-abierto-card__chip">{nivel}</span>
        <span className="partido-abierto-card__meta-item">{cancha}</span>
        <span className="partido-abierto-card__meta-item">{duracion} min</span>
      </div>

      {!isSede ? (
        <div className="partido-abierto-card__row partido-abierto-card__row--players">
          <div className="partido-abierto-card__organizer">
            {capitanFoto ? (
              <img
                src={capitanFoto}
                alt=""
                className="partido-abierto-card__avatar"
              />
            ) : (
              <div className="partido-abierto-card__avatar-fallback" aria-hidden>
                {capitanNombre.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="partido-abierto-card__organizer-text">
              {capitanNombre} <span>· Organizador</span>
            </span>
          </div>
          <PartidoSlots confirmados={confirmados} requeridos={requeridos} />
        </div>
      ) : null}

      {isSede ? (
        <div className="partido-abierto-card__sede-actions">
          <span
            className={[
              'partido-abierto-card__badge',
              faltan <= 0 ? 'partido-abierto-card__badge--full' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {lugaresLabel}
          </span>
          {onJoin ? (
            <button
              type="button"
              className="partido-abierto-card__cta partido-abierto-card__cta--solid"
              onClick={() => onJoin(partido)}
              disabled={joining || faltan <= 0}
            >
              {ctaLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {onJoin && !isSede ? (
        <button
          type="button"
          className={[
            'partido-abierto-card__cta',
            joining || faltan <= 0 ? '' : 'partido-abierto-card__cta--solid',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onJoin(partido)}
          disabled={joining || faltan <= 0}
        >
          {ctaLabel}
        </button>
      ) : null}
    </article>
  );
}
