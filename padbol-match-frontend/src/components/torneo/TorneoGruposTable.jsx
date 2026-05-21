import React, { useMemo } from 'react';
import { useSafeTranslation as useTranslation } from '../../i18n/tSafe';
import { fotoCapitanEquipo } from '../../utils/equipoOpenJoin';
import { formaRecienteEquipoGrupo } from '../../utils/torneoGruposFormaReciente';
import { equipoIdKey } from '../../utils/torneoPartidoResultado';

const FORMA_SLOTS = 6;

function initialFromText(value) {
  const s = String(value || '').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (/[A-Za-zÀ-ÿ0-9]/.test(ch)) return ch.toUpperCase();
  }
  return '?';
}

function avatarHueFromId(id) {
  const n = Number(id);
  const hues = [152, 210, 268, 32, 350, 185];
  const h = hues[Number.isFinite(n) ? Math.abs(n) % hues.length : 0];
  return `hsl(${h} 52% 38%)`;
}

function fotoEquipoTabla(eq) {
  const direct = String(eq?.foto_url || '').trim();
  if (direct) return direct;
  return String(fotoCapitanEquipo(eq) || '').trim();
}

/**
 * Tabla de posiciones por grupo (PJ, PG, PP, SG, SP, JG, JP, PTS, últimos 6).
 */
export default function TorneoGruposTable({
  grupoLabel,
  tablaRows = [],
  equipos = [],
  partidos = [],
  grupoEquipos = [],
  clasificadosCount = 2,
  onEquipoClick,
  nombreEquipo,
}) {
  const { t } = useTranslation();

  const equiposMap = useMemo(() => {
    const m = new Map();
    (equipos || []).forEach((eq) => {
      const k = equipoIdKey(eq?.id);
      if (k) m.set(k, eq);
    });
    return m;
  }, [equipos]);

  const grupoTitulo =
    grupoLabel === 'General'
      ? t('torneos.vista.grupoGeneral')
      : t('torneos.vista.grupo', { label: grupoLabel });

  const filasActivas = (tablaRows || []).filter((row) => (Number(row.jj) || 0) > 0);

  if (!filasActivas.length) {
    return (
      <div className="torneo-grupos-block">
        <h3 className="torneo-grupos-block__title">{grupoTitulo}</h3>
        <p className="torneo-grupos-block__empty">{t('torneos.vista.sinPartidos')}</p>
      </div>
    );
  }

  const resolveNombre = (row) => {
    const eq = equiposMap.get(equipoIdKey(row.id)) || row;
    if (typeof nombreEquipo === 'function') return nombreEquipo(eq);
    return String(eq?.nombre || row?.nombre || '').trim() || `Equipo #${row.id}`;
  };

  return (
    <div className="torneo-grupos-block">
      <h3 className="torneo-grupos-block__title">{grupoTitulo}</h3>
      <div className="torneo-grupos-table-wrap">
        <table className="torneo-grupos-table">
          <thead>
            <tr>
              <th
                className="torneo-grupos-th torneo-grupos-th--pos"
                scope="col"
                style={{ left: 0 }}
              >
                {t('torneos.vista.colPos', { defaultValue: '#' })}
              </th>
              <th
                className="torneo-grupos-th torneo-grupos-th--equipo"
                scope="col"
                style={{ left: 36 }}
              >
                {t('torneos.vista.colEquipo')}
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--num" scope="col">
                {t('torneos.vista.statPj', { defaultValue: 'PJ' })}
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--num" scope="col">
                {t('torneos.vista.statPg', { defaultValue: 'PG' })}
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--num" scope="col">
                {t('torneos.vista.statPp', { defaultValue: 'PP' })}
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--num" scope="col">
                {t('torneos.vista.statSw', { defaultValue: 'SG' })}
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--num" scope="col">
                {t('torneos.vista.statSl', { defaultValue: 'SP' })}
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--num" scope="col">
                JG
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--num" scope="col">
                JP
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--pts" scope="col">
                {t('torneos.vista.statPts', { defaultValue: 'PTS' })}
              </th>
              <th className="torneo-grupos-th torneo-grupos-th--forma" scope="col">
                ÚLTIMOS 6
              </th>
            </tr>
          </thead>
          <tbody>
            {filasActivas.map((row, idx) => {
              const pos = idx + 1;
              const clasifica = idx < clasificadosCount;
              const eqFull = equiposMap.get(equipoIdKey(row.id)) || row;
              const nombre = resolveNombre(row);
              const foto = fotoEquipoTabla(eqFull);
              const initial = initialFromText(nombre);
              const forma = formaRecienteEquipoGrupo(row.id, partidos, grupoEquipos, grupoLabel, FORMA_SLOTS);
              const formaConSlots = [
                ...forma,
                ...Array(Math.max(0, FORMA_SLOTS - forma.length)).fill(null),
              ].slice(0, FORMA_SLOTS);

              const badgeClass =
                pos === 1
                  ? 'torneo-grupos-pos-badge torneo-grupos-pos-badge--1'
                  : pos === 2
                    ? 'torneo-grupos-pos-badge torneo-grupos-pos-badge--2'
                    : pos === 3
                      ? 'torneo-grupos-pos-badge torneo-grupos-pos-badge--3'
                      : 'torneo-grupos-pos-badge torneo-grupos-pos-badge--fuera';

              return (
                <tr
                  key={row.id}
                  className={
                    clasifica ? 'torneo-grupos-row torneo-grupos-row--clasifica' : 'torneo-grupos-row'
                  }
                >
                  <td
                    className="torneo-grupos-td torneo-grupos-td--pos torneo-grupos-td--sticky"
                    style={{ left: 0 }}
                  >
                    <span className={badgeClass}>{pos}</span>
                  </td>
                  <td
                    className="torneo-grupos-td torneo-grupos-td--equipo torneo-grupos-td--sticky"
                    style={{ left: 36 }}
                  >
                    <button
                      type="button"
                      className="torneo-grupos-equipo-btn"
                      onClick={() => onEquipoClick?.(row)}
                      title={nombre}
                    >
                      <span
                        className="torneo-grupos-equipo-avatar"
                        style={!foto ? { background: avatarHueFromId(row.id) } : undefined}
                      >
                        {foto ? (
                          <img src={foto} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="torneo-grupos-equipo-initial">{initial}</span>
                        )}
                      </span>
                      <span className="torneo-grupos-equipo-nombre">{nombre}</span>
                    </button>
                  </td>
                  <td className="torneo-grupos-td torneo-grupos-td--num">{row.jj}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--num">{row.g}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--num">{row.p}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--num">{row.sg}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--num">{row.sp}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--num">{row.gg}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--num">{row.gp}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--pts">{row.pts}</td>
                  <td className="torneo-grupos-td torneo-grupos-td--forma">
                    <div
                      className="torneo-grupos-forma"
                      aria-label={t('torneos.vista.statForma', { defaultValue: 'Últimos 6' })}
                    >
                      {formaConSlots.map((chip, i) =>
                        chip === null ? (
                          <span
                            key={`${row.id}-f-${i}`}
                            className="torneo-grupos-forma-chip torneo-grupos-forma-chip--empty"
                            aria-hidden
                          />
                        ) : (
                          <span
                            key={`${row.id}-f-${i}`}
                            className={`torneo-grupos-forma-chip${
                              chip === 'G'
                                ? ' torneo-grupos-forma-chip--g'
                                : chip === 'E'
                                  ? ' torneo-grupos-forma-chip--e'
                                  : ' torneo-grupos-forma-chip--p'
                            }`}
                          >
                            {chip}
                          </span>
                        ),
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
