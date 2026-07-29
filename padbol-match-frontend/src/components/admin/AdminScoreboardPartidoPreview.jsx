import React from 'react';
import { useSafeTranslation } from '../../i18n/tSafe';
import UniformJerseyStrip from '../scoreboard/UniformJerseyStrip';
import { DEFAULT_SCOREBOARD_COLOR_A, DEFAULT_SCOREBOARD_COLOR_B } from '../../utils/scoreboardTeamColors';
import { resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import {
  getScoreboardJerseyLabel,
  listVisibleScoreboardJugadores,
  scoreboardPlayerName,
} from '../../utils/scoreboardPlayers';

const SCOREBOARD_PUBLIC_BASE = 'https://padbolmatch.com';

function buildScoreboardTvCanchaUrl(sedeId, cancha) {
  const encodedCancha = encodeURIComponent(String(cancha || '').trim() || 'Cancha 1');
  return `${SCOREBOARD_PUBLIC_BASE}/display/${sedeId}/cancha/${encodedCancha}`;
}

function jugadoresPreviewList(jugadores, jerseyFields = []) {
  const list = Array.isArray(jugadores) ? jugadores : [];
  const bySlot = new Map();
  list.forEach((j, idx) => {
    const slot = Number(j?.slot);
    const key = Number.isFinite(slot) && slot >= 1 && slot <= 4 ? slot : idx + 1;
    if (key >= 1 && key <= 4) bySlot.set(key, j);
  });

  const merged = [1, 2, 3, 4].map((slot, idx) => {
    const j = bySlot.get(slot) || {};
    const jerseyField = jerseyFields[idx];
    const jerseyRaw = j.jersey ?? j.numero ?? j.dorsal ?? (
      jerseyField != null && jerseyField !== 0 ? jerseyField : null
    );
    return {
      ...j,
      slot,
      nombre: j.nombre ?? j.name ?? '',
      jersey: jerseyRaw,
      numero: jerseyRaw,
    };
  });

  return listVisibleScoreboardJugadores(merged, 4).map((j) => ({
    jersey: getScoreboardJerseyLabel(j),
    nombre: scoreboardPlayerName(j),
  }));
}

export default function AdminScoreboardPartidoPreview({ partido, onEdit }) {
  const { t } = useSafeTranslation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tvLink = buildScoreboardTvCanchaUrl(partido.sede_id, partido.cancha);
  const arbiterLink = `${origin}/admin/scoreboard/${partido.id}`;

  const uniformA = resolveUniformJerseyColors(partido, 'A');
  const uniformB = resolveUniformJerseyColors(partido, 'B');
  const colorA = uniformA.color1 || partido.color_a || DEFAULT_SCOREBOARD_COLOR_A;
  const colorB = uniformB.color1 || partido.color_b || DEFAULT_SCOREBOARD_COLOR_B;
  const jugadoresA = jugadoresPreviewList(
    partido.equipo_a_jugadores,
    [partido.jersey_a1, partido.jersey_a2, partido.jersey_a3, partido.jersey_a4],
  );
  const jugadoresB = jugadoresPreviewList(
    partido.equipo_b_jugadores,
    [partido.jersey_b1, partido.jersey_b2, partido.jersey_b3, partido.jersey_b4],
  );

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
          {nombre || t('admin.scoreboard.teamFallback', { side, defaultValue: `Equipo ${side}` })}
        </p>
        <ul className="admin-sb-partido-preview__players">
          {jugadores.map((j, idx) => (
            <li key={`${side}-${idx}`}>
              {j.jersey != null ? (
                <span className="admin-sb-partido-preview__jersey">#{j.jersey}</span>
              ) : null}
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
          🎮 {t('admin.scoreboard.refereeAction', 'Árbitro')}
        </a>
        <button
          type="button"
          onClick={() => onEdit(partido.id)}
          className="admin-sb-partido-preview__action-btn"
        >
          ✏️ {t('admin.scoreboard.editAction', 'Editar')}
        </button>
      </div>
    </div>
  );
}
