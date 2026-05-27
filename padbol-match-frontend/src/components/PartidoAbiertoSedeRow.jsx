import React from 'react';
import { DeporteIcono } from '../utils/deporteIcono';
import {
  DEPORTE_LABEL_PARTIDO_ABIERTO,
} from './PartidoAbiertoCard';

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

/** Fila compacta para «Partidos abiertos» en perfil público de sede (sin hero ni slots). */
export default function PartidoAbiertoSedeRow({ partido, onJoin, joining = false }) {
  const confirmados = Array.isArray(partido?.jugadores_confirmados) ? partido.jugadores_confirmados : [];
  const requeridos = Math.max(2, parseInt(String(partido?.jugadores_requeridos || '4'), 10) || 4);
  const faltan = Math.max(0, requeridos - confirmados.length);
  const dep = String(partido?.deporte || 'padbol').toLowerCase();
  const depLabel = DEPORTE_LABEL_PARTIDO_ABIERTO[dep] || partido?.deporte || 'Partido';
  const nivel = String(partido?.nivel || '—').trim() || '—';
  const cancha = String(partido?.cancha_nombre || partido?.cancha || '—').trim() || '—';
  const fechaHora = `${fechaPartidoLabel(partido?.fecha)} · ${horaPartidoLabel(partido?.hora)}`;

  return (
    <article className="sede-publica-partido-row">
      <div className="sede-publica-partido-row__left">
        <span className="sede-publica-partido-row__icon" aria-hidden>
          <DeporteIcono deporte={dep} size={18} color="var(--accent)" />
        </span>
        <div className="sede-publica-partido-row__meta">
          <span className="sede-publica-partido-row__deporte">{depLabel}</span>
          <span className="sede-publica-partido-row__fecha">{fechaHora}</span>
        </div>
      </div>

      <div className="sede-publica-partido-row__center">
        <span className="sede-publica-partido-row__chip">{nivel}</span>
        <span className="sede-publica-partido-row__cancha">{cancha}</span>
      </div>

      <div className="sede-publica-partido-row__right">
        {faltan > 0 ? (
          <span className="sede-publica-partido-row__badge">Lugares disponibles</span>
        ) : (
          <span className="sede-publica-partido-row__badge sede-publica-partido-row__badge--full">
            Completo
          </span>
        )}
        {onJoin ? (
          <button
            type="button"
            className="sede-publica-partido-row__cta"
            onClick={() => onJoin(partido)}
            disabled={joining || faltan <= 0}
          >
            {joining ? '…' : 'Quiero jugar'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
