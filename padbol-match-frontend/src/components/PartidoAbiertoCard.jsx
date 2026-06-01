import React from 'react';
import { Link } from 'react-router-dom';
import SportIcon from './common/SportIcon';
import { useAuth } from '../context/AuthContext';
import './PartidoAbiertoCard.css';

export function partidoJugadorFotoUrl(jugador) {
  const u = jugador?.foto_url ?? jugador?.avatar_url;
  return u != null && String(u).trim() ? String(u).trim() : '';
}

export function partidoCapitanFotoUrl(partido) {
  const u =
    partido?.capitan_foto_url ??
    partido?.capitan?.foto_url ??
    partido?.capitan?.avatar_url ??
    partido?.organizador_foto_url ??
    partido?.organizador?.foto_url ??
    partido?.organizador?.avatar_url;
  return u != null && String(u).trim() ? String(u).trim() : '';
}

export function normalizePartidoUserId(id) {
  return id != null && String(id).trim() !== '' ? String(id).trim().toLowerCase() : '';
}

/** ID del capitán/organizador (API: `capitan_user_id`). */
export function partidoCapitanUserId(partido) {
  const id =
    partido?.capitan_user_id ??
    partido?.capitan_id ??
    partido?.organizador_id ??
    partido?.capitan?.user_id ??
    partido?.capitan?.id ??
    partido?.organizador?.user_id ??
    partido?.organizador?.id;
  return normalizePartidoUserId(id);
}

export function partidoSedeId(partido) {
  const n = parseInt(String(partido?.sede_id ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function partidoJugadorUserId(jugador) {
  const id = jugador?.user_id ?? jugador?.id ?? jugador?.jugador_id;
  return normalizePartidoUserId(id);
}

/** Usuario logueado es capitán u otro jugador confirmado (datos del listado; sin fetch extra). */
export function usuarioYaEnPartido(partido, userId, userEmail) {
  const uid = normalizePartidoUserId(userId);
  const email = String(userEmail || '').trim().toLowerCase();
  if (!uid && !email) return false;

  const capId = partidoCapitanUserId(partido);
  if (uid && capId && capId === uid) return true;

  const capEmail = String(partido?.capitan_email || '').trim().toLowerCase();
  if (email && capEmail && email === capEmail) return true;

  const confirmados = Array.isArray(partido?.jugadores_confirmados) ? partido.jugadores_confirmados : [];
  return confirmados.some((j) => {
    const jid = partidoJugadorUserId(j);
    if (uid && jid && jid === uid) return true;
    const jEmail = String(j?.email || '').trim().toLowerCase();
    return Boolean(email && jEmail && jEmail === email);
  });
}

export const DEPORTE_LABEL_PARTIDO_ABIERTO = {
  padbol: 'Padbol',
  padel: 'Pádel',
  tenis: 'Tenis',
  pickleball: 'Pickleball',
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

function horaPartidoSortKey(hora) {
  const h = String(hora || '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  return m ? `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}` : h;
}

/** Orden: fecha ASC, luego hora ASC. */
export function sortPartidosAbiertosPorFechaHora(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const fa = String(a?.fecha || '').slice(0, 10);
    const fb = String(b?.fecha || '').slice(0, 10);
    if (fa !== fb) return fa.localeCompare(fb);
    return horaPartidoSortKey(a?.hora).localeCompare(horaPartidoSortKey(b?.hora));
  });
}

export const PARTIDOS_ABIERTOS_PREVIEW_LIMIT = 2;

/** "Cancha 1" tal cual; "1" → "Cancha 1"; vacío → null (no mostrar). */
export function partidoCanchaLabel(partido) {
  const raw = String(partido?.cancha_nombre ?? partido?.cancha ?? '').trim();
  if (!raw) return null;
  if (/^cancha\s/i.test(raw)) return raw;
  return `Cancha ${raw}`;
}

const SPORT_ICON_WHITE = '#ffffff';

const MAX_SLOT_CIRCLES = 4;

function renderSlotJugador(jugador, key) {
  const foto = partidoJugadorFotoUrl(jugador);
  const nombre = String(jugador?.nombre || '').trim() || 'Jugador';
  if (foto) {
    return (
      <img key={key} src={foto} alt={nombre} title={nombre} className="partido-abierto-card__slot" />
    );
  }
  if (jugador) {
    return (
      <span key={key} title={nombre} className="partido-abierto-card__slot-fallback" aria-hidden>
        {nombre.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span key={key} title="Libre" className="partido-abierto-card__slot-empty" aria-hidden>
      +
    </span>
  );
}

function PartidoSlots({ capitanNombre, capitanFoto, capitanId, confirmados, requeridos }) {
  const slotCount = Math.min(Math.max(2, requeridos), MAX_SLOT_CIRCLES);
  const otrosConfirmados = (Array.isArray(confirmados) ? confirmados : []).filter((j) => {
    const jid = partidoJugadorUserId(j);
    return !capitanId || !jid || jid !== capitanId;
  });

  return (
    <div className="partido-abierto-card__slots" aria-label="Jugadores confirmados">
      {Array.from({ length: slotCount }, (_, idx) => {
        if (idx === 0) {
          if (capitanFoto) {
            return (
              <img
                key={idx}
                src={capitanFoto}
                alt={capitanNombre}
                title={`${capitanNombre} · Organizador`}
                className="partido-abierto-card__slot"
              />
            );
          }
          return (
            <span
              key={idx}
              title={`${capitanNombre} · Organizador`}
              className="partido-abierto-card__slot-fallback"
              aria-hidden
            >
              {capitanNombre.charAt(0).toUpperCase()}
            </span>
          );
        }
        return renderSlotJugador(otrosConfirmados[idx - 1], idx);
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
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? '';
  const currentUserEmail = session?.user?.email ?? '';
  const confirmados = Array.isArray(partido?.jugadores_confirmados) ? partido.jugadores_confirmados : [];
  const requeridos = Math.max(2, parseInt(String(partido?.jugadores_requeridos || '4'), 10) || 4);
  const faltan = Math.max(0, requeridos - confirmados.length);
  const capitanFoto = partidoCapitanFotoUrl(partido);
  const capitanId = partidoCapitanUserId(partido);
  const capitanNombre =
    String(partido?.capitan_nombre || partido?.organizador_nombre || '').trim() || 'Organizador';
  const yaEnPartido = usuarioYaEnPartido(partido, currentUserId, currentUserEmail);
  const sedeId = partidoSedeId(partido);
  const dep = String(partido?.deporte || 'padbol').toLowerCase();
  const depLabel = DEPORTE_LABEL_PARTIDO_ABIERTO[dep] || partido?.deporte || 'Partido';
  const sedeNombre = String(partido?.sede_nombre || 'Sede').trim() || 'Sede';
  const nivel = String(partido?.nivel || 'Principiante').trim() || 'Principiante';
  const canchaLabel = partidoCanchaLabel(partido);
  const duracion = Number(partido?.duracion_minutos) > 0 ? Number(partido.duracion_minutos) : 90;
  const isSede = variant === 'sede';
  const lugaresLabel = faltan > 0 ? 'LUGARES DISPONIBLES' : 'SIN LUGAR';

  const handleCardClick = onCardClick
    ? (e) => {
        if (e.target.closest('button')) return;
        onCardClick(partido);
      }
    : undefined;

  const ctaDisabled = joining || faltan <= 0 || yaEnPartido;
  const ctaLabel = joining
    ? isSede
      ? '…'
      : 'Enviando...'
    : yaEnPartido
      ? 'Ya estás en este partido'
      : faltan <= 0
        ? 'Partido completo'
        : 'Quiero jugar';

  const sedeLayout = isSede ? (
    <>
      <div className="partido-abierto-card__row partido-abierto-card__sede-row">
        <div className="partido-abierto-card__row partido-abierto-card__row--meta partido-abierto-card__sede-deporte">
          <span className="partido-abierto-card__sport-icon-wrap partido-abierto-card__sport-icon-wrap--accent">
            <SportIcon deporte={dep} size={14} color="var(--accent)" />
          </span>
          <span className="partido-abierto-card__meta-item partido-abierto-card__sede-deporte-label">{depLabel}</span>
        </div>
        <div className="partido-abierto-card__row partido-abierto-card__row--meta partido-abierto-card__sede-datetime">
          <span className="partido-abierto-card__meta-item">{fechaPartidoLabel(partido?.fecha)}</span>
          <span className="partido-abierto-card__meta-sep" aria-hidden>
            ·
          </span>
          <span className="partido-abierto-card__meta-item">{horaPartidoLabel(partido?.hora)}</span>
        </div>
      </div>

      <div className="partido-abierto-card__row partido-abierto-card__sede-row">
        <span className="partido-abierto-card__chip">{nivel}</span>
      </div>

      <div className="partido-abierto-card__row partido-abierto-card__sede-row">
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
            className={[
              'partido-abierto-card__cta',
              yaEnPartido ? 'partido-abierto-card__cta--member' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onJoin(partido)}
            disabled={ctaDisabled}
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </>
  ) : null;

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
      {sedeLayout}

      {!isSede ? (
        <>
          <div className="partido-abierto-card__row partido-abierto-card__row--head">
            <div className="partido-abierto-card__head-main">
              <span
                className="partido-abierto-card__sport-icon-wrap"
                style={{ color: SPORT_ICON_WHITE, display: 'inline-flex', flexShrink: 0 }}
              >
                <SportIcon
                  deporte={dep}
                  size={20}
                  color={SPORT_ICON_WHITE}
                  style={{ color: SPORT_ICON_WHITE }}
                />
              </span>
              <span className="partido-abierto-card__title">
                {depLabel} · {sedeNombre}
              </span>
            </div>
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
          </div>

          <div className="partido-abierto-card__row partido-abierto-card__row--meta">
            <span className="partido-abierto-card__meta-item">{fechaPartidoLabel(partido?.fecha)}</span>
            <span className="partido-abierto-card__meta-sep" aria-hidden>
              ·
            </span>
            <span className="partido-abierto-card__meta-item">{horaPartidoLabel(partido?.hora)}</span>
            <span className="partido-abierto-card__chip">{nivel}</span>
            {canchaLabel ? (
              <span className="partido-abierto-card__meta-item">{canchaLabel}</span>
            ) : null}
            <span className="partido-abierto-card__meta-item">{duracion} min</span>
          </div>

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
            <PartidoSlots
              capitanNombre={capitanNombre}
              capitanFoto={capitanFoto}
              capitanId={capitanId}
              confirmados={confirmados}
              requeridos={requeridos}
            />
          </div>

          {sedeId ? (
            <Link
              to={`/sede/${encodeURIComponent(String(sedeId))}`}
              className="partido-abierto-card__ver-sede"
              onClick={(e) => e.stopPropagation()}
            >
              Ver sede →
            </Link>
          ) : null}

          {onJoin ? (
            <button
              type="button"
              className={[
                'partido-abierto-card__cta',
                yaEnPartido ? 'partido-abierto-card__cta--member' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onJoin(partido)}
              disabled={ctaDisabled}
            >
              {ctaLabel}
            </button>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
