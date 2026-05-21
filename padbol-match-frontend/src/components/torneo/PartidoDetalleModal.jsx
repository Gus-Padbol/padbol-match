import React, { useEffect, useMemo } from 'react';
import { useSafeTranslation as useTranslation } from '../../i18n/tSafe';
import {
  equipoIdKey,
  formatSetsLineaNeutral,
  parseResultadoPartido,
  resolvePartidoEstadoUi,
  validarMarcadorSetsPartido,
} from '../../utils/torneoPartidoResultado';
import './PartidoDetalleModal.css';

/** Torneo de prueba: mock de sets cuando el JSONB viene vacío (solo visualización). */
const TORNEO_ID_MOCK_RESULTADO = 21;
const MOCK_SETS_LINEA = '6-4 / 4-6 / 7-5';
const MOCK_GANADOR_NOMBRE = 'Los Cóndores';

function nombreEquipoEsCondores(nombre) {
  const s = String(nombre || '').trim();
  return s === MOCK_GANADOR_NOMBRE || /c[oó]ndores/i.test(s);
}

function nombreEquipoEsPumas(nombre) {
  return /pumas/i.test(String(nombre || '').trim());
}

/** Sets ganados mock: Cóndores 2, Pumas 1 (6-4 / 4-6 / 7-5). */
function mockSetsGanadosEquipoA(na, nb) {
  if (nombreEquipoEsCondores(na)) return 2;
  if (nombreEquipoEsPumas(na)) return 1;
  if (nombreEquipoEsCondores(nb)) return 1;
  if (nombreEquipoEsPumas(nb)) return 2;
  return 2;
}

function mockSetsGanadosEquipoB(na, nb) {
  if (nombreEquipoEsCondores(nb)) return 2;
  if (nombreEquipoEsPumas(nb)) return 1;
  if (nombreEquipoEsCondores(na)) return 1;
  if (nombreEquipoEsPumas(na)) return 2;
  return 1;
}

function equipoPorId(equiposList, id) {
  const key = equipoIdKey(id);
  if (!key) return null;
  return (equiposList || []).find((e) => equipoIdKey(e.id) === key) || null;
}

/**
 * Modal de detalle de partido (fixture / llave): equipos, estado, fecha, marcador JSONB.
 */
export default function PartidoDetalleModal({
  open,
  onClose,
  partido,
  equipos = [],
  nombreEquipo,
  onCargarResultado,
  torneoId = null,
}) {
  const { t } = useTranslation();

  const eqA = useMemo(
    () => (partido ? equipoPorId(equipos, partido.equipo_a_id) : null),
    [partido, equipos],
  );
  const eqB = useMemo(
    () => (partido ? equipoPorId(equipos, partido.equipo_b_id) : null),
    [partido, equipos],
  );

  const na = useMemo(() => {
    if (typeof nombreEquipo === 'function') return nombreEquipo(eqA || {});
    return String(eqA?.nombre || '').trim() || t('torneos.partidoDetalle.equipoA');
  }, [eqA, nombreEquipo, t]);

  const nb = useMemo(() => {
    if (typeof nombreEquipo === 'function') return nombreEquipo(eqB || {});
    return String(eqB?.nombre || '').trim() || t('torneos.partidoDetalle.equipoB');
  }, [eqB, nombreEquipo, t]);

  const estadoUi = useMemo(() => (partido ? resolvePartidoEstadoUi(partido) : 'pendiente'), [partido]);

  const estadoLabel = useMemo(() => {
    if (estadoUi === 'finalizado') return t('torneos.partidoDetalle.estadoFinalizado');
    if (estadoUi === 'en_juego') return t('torneos.partidoDetalle.estadoEnJuego');
    return t('torneos.partidoDetalle.estadoPendiente');
  }, [estadoUi, t]);

  const setsLista = useMemo(() => (partido ? parseResultadoPartido(partido) : []), [partido]);

  const tieneSets = setsLista.length > 0;

  const marcadorValidacion = useMemo(
    () => (partido && tieneSets ? validarMarcadorSetsPartido(partido) : { valido: false, empate: false, sgA: 0, sgB: 0 }),
    [partido, tieneSets],
  );

  const setsLinea = useMemo(() => {
    if (!partido || !tieneSets) return '';
    return formatSetsLineaNeutral(partido) || setsLista.join(' / ');
  }, [partido, tieneSets, setsLista]);

  const usarMockResultado = useMemo(() => {
    const tid = Number(torneoId ?? partido?.torneo_id);
    return (
      Number.isFinite(tid) &&
      tid === TORNEO_ID_MOCK_RESULTADO &&
      estadoUi === 'finalizado' &&
      !tieneSets
    );
  }, [torneoId, partido?.torneo_id, estadoUi, tieneSets]);

  const mockSgA = useMemo(
    () => (usarMockResultado ? mockSetsGanadosEquipoA(na, nb) : 0),
    [usarMockResultado, na, nb],
  );
  const mockSgB = useMemo(
    () => (usarMockResultado ? mockSetsGanadosEquipoB(na, nb) : 0),
    [usarMockResultado, na, nb],
  );

  const fechaTexto = useMemo(() => {
    if (!partido?.fecha_hora) return '';
    const d = new Date(partido.fecha_hora);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
  }, [partido?.fecha_hora]);

  const grupoLabel = useMemo(() => {
    const g = partido?.grupo;
    if (g == null || String(g).trim() === '') return '';
    return t('torneos.vista.grupo', { label: g });
  }, [partido?.grupo, t]);

  const rondaLabel = useMemo(() => {
    const r = partido?.ronda;
    if (r == null || String(r).trim() === '') return '';
    return t('torneos.partidoDetalle.ronda', { n: r });
  }, [partido?.ronda, t]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !partido) return null;

  const sgA = usarMockResultado ? mockSgA : marcadorValidacion.sgA;
  const sgB = usarMockResultado ? mockSgB : marcadorValidacion.sgB;
  const marcadorValido = usarMockResultado || marcadorValidacion.valido;
  const ganaA = marcadorValido && sgA > sgB;
  const ganaB = marcadorValido && sgB > sgA;
  const setsDisplayA = marcadorValido ? sgA : null;
  const setsDisplayB = marcadorValido ? sgB : null;
  const showCargar = typeof onCargarResultado === 'function' && estadoUi === 'pendiente';
  const resultadoInvalidoMsg = t('torneos.partidoDetalle.resultadoInvalido', {
    defaultValue: 'Resultado inválido',
  });

  return (
    <div className="pdm-overlay" role="presentation" onClick={() => onClose?.()}>
      <div
        className="pdm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partido-detalle-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pdm-header">
          <h2 id="partido-detalle-titulo" className="pdm-title">
            {t('torneos.partidoDetalle.titulo')}
          </h2>
          <button type="button" className="pdm-close" onClick={() => onClose?.()} aria-label={t('general.close')}>
            ×
          </button>
        </header>

        <div className="pdm-body">
          <div className="pdm-equipos">
            <div className={`pdm-equipo${ganaA ? ' pdm-equipo--winner' : ''}`}>
              <span className="pdm-equipo-nombre">{na}</span>
              {setsDisplayA != null ? <span className="pdm-equipo-sets">{setsDisplayA}</span> : null}
            </div>
            <span className="pdm-vs">{t('torneos.partidoDetalle.vs')}</span>
            <div className={`pdm-equipo${ganaB ? ' pdm-equipo--winner' : ''}`}>
              <span className="pdm-equipo-nombre">{nb}</span>
              {setsDisplayB != null ? <span className="pdm-equipo-sets">{setsDisplayB}</span> : null}
            </div>
          </div>

          <div className={`pdm-estado pdm-estado--${estadoUi}`}>{estadoLabel}</div>

          {estadoUi === 'finalizado' && !tieneSets && !usarMockResultado ? (
            <p className="pdm-placeholder">{t('torneos.partidoDetalle.sinMarcadorSets', { defaultValue: 'Sin detalle de sets cargado.' })}</p>
          ) : null}

          {usarMockResultado ? (
            <>
              <h3 className="pdm-section-title">{t('torneos.partidoDetalle.resultadoFinal')}</h3>
              <p className="pdm-resultado-final">
                {na} <strong>{mockSgA}</strong>
                <span className="pdm-resultado-sep">–</span>
                <strong>{mockSgB}</strong> {nb}
              </p>
              <h3 className="pdm-section-title">{t('torneos.partidoDetalle.detalleSets')}</h3>
              <p className="pdm-sets-linea">{MOCK_SETS_LINEA}</p>
            </>
          ) : null}

          {estadoUi === 'pendiente' && !tieneSets ? (
            <div className="pdm-pendiente-block">
              <p className="pdm-pendiente-msg">{t('torneos.partidoDetalle.partidoPendiente')}</p>
              {fechaTexto ? (
                <p className="pdm-pendiente-fecha">
                  <span className="pdm-meta-lbl">{t('torneos.partidoDetalle.fechaProgramada')}</span>
                  {fechaTexto}
                </p>
              ) : (
                <p className="pdm-placeholder">{t('torneos.partidoDetalle.sinFecha')}</p>
              )}
            </div>
          ) : null}

          {tieneSets && marcadorValidacion.valido ? (
            <>
              <h3 className="pdm-section-title">{t('torneos.partidoDetalle.resultadoFinal')}</h3>
              <p className="pdm-resultado-final">
                {na} <strong>{sgA}</strong>
                <span className="pdm-resultado-sep">–</span>
                <strong>{sgB}</strong> {nb}
              </p>
              <h3 className="pdm-section-title">{t('torneos.partidoDetalle.detalleSets')}</h3>
              <p className="pdm-sets-linea">{setsLinea || '—'}</p>
            </>
          ) : null}

          {tieneSets && !marcadorValidacion.valido ? (
            <p className="pdm-resultado-invalido" role="alert">
              {resultadoInvalidoMsg}
            </p>
          ) : null}

          <h3 className="pdm-section-title">{t('torneos.partidoDetalle.fechaHora')}</h3>
          <p className="pdm-fecha-valor">{fechaTexto || t('torneos.partidoDetalle.sinFecha')}</p>

          {[grupoLabel, rondaLabel].filter(Boolean).length > 0 ? (
            <p className="pdm-meta-extra">{[grupoLabel, rondaLabel].filter(Boolean).join(' · ')}</p>
          ) : null}
        </div>

        <footer className="pdm-footer">
          {showCargar ? (
            <button
              type="button"
              className="pdm-btn-cargar"
              onClick={() => {
                onCargarResultado(partido);
                onClose?.();
              }}
            >
              {t('torneos.partidoDetalle.cargarResultado')}
            </button>
          ) : null}
          <button type="button" className="pdm-btn-cerrar" onClick={() => onClose?.()}>
            {t('torneos.partidoDetalle.cerrar')}
          </button>
        </footer>
      </div>
    </div>
  );
}
