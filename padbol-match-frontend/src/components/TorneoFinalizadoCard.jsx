import SportIcon from './common/SportIcon';
import { IconGeroUbicacion } from './icons/GeroIcons';
import './TorneoFinalizadoCard.css';

function medalForPosicion(pos) {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return '🏅';
}

function slotClassForPosicion(pos) {
  if (pos === 1) return 'torneo-fin-card__podio-slot torneo-fin-card__podio-slot--1';
  if (pos === 2) return 'torneo-fin-card__podio-slot torneo-fin-card__podio-slot--2';
  if (pos === 3) return 'torneo-fin-card__podio-slot torneo-fin-card__podio-slot--3';
  return 'torneo-fin-card__podio-slot';
}

function initialFromName(name) {
  const s = String(name || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}

function buildPodioSlots(podio) {
  const byPos = {};
  (Array.isArray(podio) ? podio : []).forEach((row) => {
    const n = Number(row?.posicion);
    if (n >= 1 && n <= 3) byPos[n] = row;
  });
  return [1, 2, 3].map((pos) => byPos[pos] || { posicion: pos, jugadores: [], equipo_nombre: '' });
}

export default function TorneoFinalizadoCard({ torneo, onOpen, t, deporteLabel, formatDate }) {
  const podioSlots = buildPodioSlots(torneo?.podio);
  const sedeLine = [torneo?.sede, torneo?.sede_ciudad, torneo?.sede_pais].filter(Boolean).join(' · ');
  const fechaLine =
    torneo?.fecha_inicio && torneo?.fecha_fin && torneo.fecha_inicio !== torneo.fecha_fin && formatDate
      ? t('torneos.listado.datesRange', {
          start: formatDate(torneo.fecha_inicio),
          end: formatDate(torneo.fecha_fin),
        })
      : torneo?.fecha_display ||
        (formatDate && torneo?.fecha_inicio ? formatDate(torneo.fecha_inicio) : '—');

  return (
    <button type="button" className="torneo-fin-card" onClick={() => onOpen(torneo.torneo_id)}>
      <div className="torneo-fin-card__header">
        <h3 className="torneo-fin-card__title">{torneo.nombre}</h3>
        <span className="torneo-fin-card__badge">{t('torneos.vista.estado.finalizado')}</span>
      </div>

      <div className="torneo-fin-card__meta">
        <div className="torneo-fin-card__meta-row">
          <SportIcon deporte={torneo.deporte} size={16} color="var(--text-secondary)" />
          <span>{deporteLabel || torneo.deporte_label || torneo.deporte}</span>
        </div>
        {sedeLine ? (
          <div className="torneo-fin-card__meta-row">
            <IconGeroUbicacion size={14} />
            <span>{sedeLine}</span>
          </div>
        ) : null}
        <div className="torneo-fin-card__meta-row">
          <span aria-hidden>📅</span>
          <span>{fechaLine}</span>
        </div>
      </div>

      <p className="torneo-fin-card__participants">
        {t('torneos.listado.participants', { count: Number(torneo.total_participantes) || 0 })}
      </p>

      <div className="torneo-fin-card__podio">
        {podioSlots.map((slot) => {
          const jugadores = Array.isArray(slot.jugadores) ? slot.jugadores : [];
          const nombres = jugadores.map((j) => j.display_name || j.nombre || j.alias).filter(Boolean);
          return (
            <div key={slot.posicion} className={slotClassForPosicion(slot.posicion)}>
              <div className="torneo-fin-card__medal" aria-hidden>
                {medalForPosicion(slot.posicion)}
              </div>
              <p className="torneo-fin-card__equipo" title={slot.equipo_nombre || ''}>
                {slot.equipo_nombre || '—'}
              </p>
              {jugadores.length > 0 ? (
                <div className="torneo-fin-card__avatars">
                  {jugadores.slice(0, 3).map((j, idx) => (
                    <div key={`${j.user_id || j.email || idx}`} className="torneo-fin-card__avatar">
                      {j.avatar_url ? (
                        <img src={j.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="torneo-fin-card__avatar-fallback">{initialFromName(j.display_name || j.nombre)}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="torneo-fin-card__jugadores">{nombres.length ? nombres.join(' · ') : '—'}</p>
            </div>
          );
        })}
      </div>
    </button>
  );
}

export function TorneosVistaTabs({ active, onChange, t }) {
  return (
    <div className="torneo-fin-tabs" role="tablist" aria-label={t('torneos.listado.vistaTabsAria')}>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'activos'}
        className={`torneo-fin-tabs__btn${active === 'activos' ? ' torneo-fin-tabs__btn--active' : ''}`}
        onClick={() => onChange('activos')}
      >
        {t('torneos.listado.tabActivos')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'finalizados'}
        className={`torneo-fin-tabs__btn${active === 'finalizados' ? ' torneo-fin-tabs__btn--active' : ''}`}
        onClick={() => onChange('finalizados')}
      >
        {t('torneos.listado.tabFinalizados')}
      </button>
    </div>
  );
}
