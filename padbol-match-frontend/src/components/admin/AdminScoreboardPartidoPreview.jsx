import React from 'react';
import UniformJerseyStrip from '../scoreboard/UniformJerseyStrip';
import { DEFAULT_SCOREBOARD_COLOR_A, DEFAULT_SCOREBOARD_COLOR_B } from '../../utils/scoreboardTeamColors';
import { resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';

const SCOREBOARD_PUBLIC_BASE = 'https://padbolmatch.com';

function buildScoreboardTvCanchaUrl(sedeId, cancha) {
  const encodedCancha = encodeURIComponent(String(cancha || '').trim() || 'Cancha 1');
  return `${SCOREBOARD_PUBLIC_BASE}/display/${sedeId}/cancha/${encodedCancha}`;
}

function jugadoresPreviewList(jugadores) {
  const list = Array.isArray(jugadores) ? jugadores : [];
  return list
    .map((j, idx) => {
      const nombre = String(j.nombre ?? j.name ?? '').trim();
      if (!nombre) return null;
      const slot = Number(j?.slot);
      const jersey = j.jersey ?? j.numero ?? (Number.isFinite(slot) && slot >= 1 ? slot : idx + 1);
      return { jersey, nombre };
    })
    .filter(Boolean);
}

export default function AdminScoreboardPartidoPreview({ partido, onEdit }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tvLink = buildScoreboardTvCanchaUrl(partido.sede_id, partido.cancha);
  const arbiterLink = `${origin}/admin/scoreboard/${partido.id}`;

  const uniformA = resolveUniformJerseyColors(partido, 'A');
  const uniformB = resolveUniformJerseyColors(partido, 'B');
  const colorA = uniformA.color1 || partido.color_a || DEFAULT_SCOREBOARD_COLOR_A;
  const colorB = uniformB.color1 || partido.color_b || DEFAULT_SCOREBOARD_COLOR_B;
  const jugadoresA = jugadoresPreviewList(partido.equipo_a_jugadores);
  const jugadoresB = jugadoresPreviewList(partido.equipo_b_jugadores);

  const renderTeam = (side, nombre, uniform, accentColor, jugadores) => (
    <div className="admin-sb-partido-preview__team">
      <div className="admin-sb-partido-preview__uniform">
        <UniformJerseyStrip color1={uniform.color1} color2={uniform.color2} size="compact" />
      </div>
      <div className="admin-sb-partido-preview__team-body">
        <p
          className="admin-sb-partido-preview__team-name"
          style={{ color: accentColor }}
        >
          {nombre || `Equipo ${side}`}
        </p>
        <ul className="admin-sb-partido-preview__players">
          {jugadores.map((j, idx) => (
            <li key={`${side}-${idx}`}>
              <span className="admin-sb-partido-preview__jersey">#{j.jersey}</span>
              <span className="admin-sb-partido-preview__player-name">{j.nombre}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="admin-sb-partido-preview">
      <div className="admin-sb-partido-preview__teams">
        {renderTeam('A', partido.equipo_a_nombre, uniformA, colorA, jugadoresA)}
        <span className="admin-sb-partido-preview__vs" aria-hidden="true">vs</span>
        {renderTeam('B', partido.equipo_b_nombre, uniformB, colorB, jugadoresB)}
      </div>
      <div className="admin-sb-partido-preview__actions">
        <a
          href={tvLink}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-sb-partido-preview__action-btn"
        >
          📺 TV
        </a>
        <a href={arbiterLink} className="admin-sb-partido-preview__action-btn">
          🎮 Árbitro
        </a>
        <button
          type="button"
          onClick={() => onEdit(partido.id)}
          className="admin-sb-partido-preview__action-btn"
        >
          ✏️ Editar
        </button>
      </div>
    </div>
  );
}
