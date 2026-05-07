import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function labelEquipo(eq) {
  return String(eq?.nombre || '').trim() || `Equipo #${eq?.id ?? '?'}`;
}

function equipoPorId(equipos, id) {
  return (equipos || []).find((e) => Number(e.id) === Number(id));
}

/** Tono corto estilo sorteo (Web Audio API). */
function playSorteoChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(523.25, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(392, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.2);
    ctx.resume?.();
    setTimeout(() => ctx.close?.(), 400);
  } catch {
    /* sin audio */
  }
}

function buildGruposAtStep(idsCabezas, numGrupos, secuencia, completedExtractions) {
  const g = Array.from({ length: numGrupos }, () => []);
  for (let i = 0; i < (idsCabezas || []).length && i < numGrupos; i += 1) {
    g[i].push(idsCabezas[i]);
  }
  for (let j = 0; j < completedExtractions && j < secuencia.length; j += 1) {
    const { id, groupIndex } = secuencia[j];
    g[groupIndex].push(id);
  }
  return g;
}

const STEP_MS = 800;

/**
 * Sorteo visual estilo Champions: bombo + grupos, cabezas doradas fijas, extracción escalonada.
 */
export default function SorteoAnimado({
  open,
  torneoNombre,
  equipos,
  idsCabezas,
  numGrupos,
  secuencia,
  gruposFinales,
  onComplete,
  onCancel,
  playSound = true,
}) {
  const [step, setStep] = useState(0);
  const doneRef = useRef(false);
  const chime = useCallback(() => {
    if (playSound) playSorteoChime();
  }, [playSound]);

  useEffect(() => {
    if (!open) {
      doneRef.current = false;
      setStep(0);
      return;
    }
    doneRef.current = false;
    setStep(0);
  }, [open, secuencia, idsCabezas, numGrupos]);

  useEffect(() => {
    if (!open || doneRef.current) return;
    const allDone = secuencia.length === 0 ? true : step >= secuencia.length;
    if (!allDone) return;
    doneRef.current = true;
    const t = setTimeout(() => {
      onComplete?.(gruposFinales);
    }, 450);
    return () => clearTimeout(t);
  }, [open, step, secuencia.length, gruposFinales, onComplete]);

  useEffect(() => {
    if (!open || secuencia.length === 0) return;
    if (step >= secuencia.length) return;
    const t = setTimeout(() => {
      chime();
      setStep((s) => s + 1);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [open, step, secuencia.length, chime]);

  const gruposVista = useMemo(
    () => buildGruposAtStep(idsCabezas, numGrupos, secuencia, step),
    [idsCabezas, numGrupos, secuencia, step]
  );

  const bomboIds = useMemo(() => secuencia.slice(step).map((s) => s.id), [secuencia, step]);

  const ultimoColocadoId = step > 0 ? secuencia[step - 1]?.id : null;

  const idsCabezasSet = useMemo(() => new Set((idsCabezas || []).map((id) => Number(id))), [idsCabezas]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sorteo animado de grupos"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'radial-gradient(ellipse at 50% 0%, #1e3a5f 0%, #0a1628 45%, #050b14 100%)',
        display: 'flex',
        flexDirection: 'column',
        color: '#e2e8f0',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes sorteo-bombo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes sorteo-aterriza {
          0% { transform: scale(0.6) translateY(-28px); opacity: 0.85; }
          55% { transform: scale(1.08) translateY(4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes sorteo-pulso-oro {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201, 162, 39, 0.45); }
          50% { box-shadow: 0 0 20px 4px rgba(201, 162, 39, 0.35); }
        }
        .sorteo-bolilla-bombo {
          animation: sorteo-bombo-float 2.8s ease-in-out infinite;
        }
        .sorteo-bolilla-nueva {
          animation: sorteo-aterriza 0.65s ease-out forwards;
        }
        .sorteo-cabeza-slot {
          animation: sorteo-pulso-oro 2.5s ease-in-out infinite;
        }
        @media (max-width: 720px) {
          .sorteo-split-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(201, 162, 39, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'linear-gradient(180deg, rgba(201,162,39,0.12) 0%, transparent 100%)',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.2em', color: '#c9a227' }}>
            SORTEO DE GRUPOS
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(1.1rem, 3vw, 1.45rem)', fontWeight: 900 }}>
            {String(torneoNombre || '').trim() || 'Torneo'}
          </h1>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: '1px solid rgba(226,232,240,0.35)',
            background: 'rgba(15,23,42,0.6)',
            color: '#f8fafc',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>

      <div
        className="sorteo-split-grid"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 1fr) minmax(280px, 1.35fr)',
          gap: '16px',
          padding: '16px 20px 24px',
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            borderRadius: '16px',
            border: '1px solid rgba(201, 162, 39, 0.2)',
            background: 'rgba(15, 23, 42, 0.55)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#c9a227' }}>Bombo</h2>
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
            {secuencia.length === 0
              ? 'Todos los equipos ya están asignados como cabezas de serie.'
              : `${bomboIds.length} equipo${bomboIds.length !== 1 ? 's' : ''} por sortear`}
          </p>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignContent: 'flex-start',
              justifyContent: 'center',
              padding: '8px 4px',
            }}
          >
            {bomboIds.map((eid, i) => {
              const eq = equipoPorId(equipos, eid);
              const isNext = secuencia[step]?.id === eid;
              return (
                <div
                  key={`bombo-${eid}`}
                  className="sorteo-bolilla-bombo"
                  title={labelEquipo(eq || { id: eid })}
                  style={{
                    width: '92px',
                    height: '92px',
                    borderRadius: '50%',
                    background: isNext
                      ? 'radial-gradient(circle at 30% 25%, #fef3c7, #c9a227 55%, #854d0e)'
                      : 'radial-gradient(circle at 30% 25%, #e2e8f0, #64748b 55%, #334155)',
                    border: isNext ? '3px solid #fde68a' : '2px solid rgba(255,255,255,0.25)',
                    boxShadow: isNext ? '0 0 24px rgba(250, 204, 21, 0.45)' : '0 8px 20px rgba(0,0,0,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isNext ? '#1c1917' : '#0f172a',
                    lineHeight: 1.2,
                    transition: 'transform 0.35s ease, box-shadow 0.35s ease',
                    transform: isNext ? 'scale(1.08)' : `scale(${0.96 + (i % 5) * 0.01})`,
                    animationDelay: `${i * 0.08}s`,
                  }}
                >
                  {labelEquipo(eq || { id: eid })}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            borderRadius: '16px',
            border: '1px solid rgba(201, 162, 39, 0.2)',
            background: 'rgba(15, 23, 42, 0.45)',
            padding: '16px',
            overflow: 'auto',
            minHeight: 0,
          }}
        >
          <h2 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 800, color: '#c9a227' }}>Grupos</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, numGrupos)}, minmax(0, 1fr))`,
              gap: '12px',
              overflowX: numGrupos > 4 ? 'auto' : 'visible',
            }}
          >
            {gruposVista.map((ids, gi) => (
              <div
                key={LETRAS[gi] || gi}
                style={{
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(30, 41, 59, 0.65)',
                  padding: '10px',
                  minHeight: '120px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 900,
                    color: '#c9a227',
                    marginBottom: '10px',
                    letterSpacing: '0.06em',
                  }}
                >
                  GRUPO {LETRAS[gi] || gi + 1}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ids.map((eid) => {
                    const eq = equipoPorId(equipos, eid);
                    const esCabeza = idsCabezasSet.has(Number(eid));
                    const recien = ultimoColocadoId === eid;
                    return (
                      <div
                        key={`${gi}-${eid}`}
                        className={`${esCabeza ? 'sorteo-cabeza-slot' : ''} ${recien ? 'sorteo-bolilla-nueva' : ''}`}
                        style={{
                          borderRadius: '999px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 800,
                          textAlign: 'center',
                          lineHeight: 1.25,
                          background: esCabeza
                            ? 'linear-gradient(135deg, #fde68a, #c9a227 45%, #a16207)'
                            : 'linear-gradient(135deg, #334155, #1e293b)',
                          color: esCabeza ? '#1c1917' : '#f1f5f9',
                          border: esCabeza ? '2px solid #facc15' : '1px solid rgba(148,163,184,0.35)',
                          boxShadow: esCabeza ? '0 4px 14px rgba(201, 162, 39, 0.35)' : 'none',
                        }}
                      >
                        {esCabeza ? <span style={{ fontSize: '10px', display: 'block', opacity: 0.85 }}>Cabeza</span> : null}
                        {labelEquipo(eq || { id: eid })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '12px 20px 18px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#94a3b8',
          borderTop: '1px solid rgba(201, 162, 39, 0.15)',
        }}
      >
        {secuencia.length === 0 ? (
          <span>Finalizando…</span>
        ) : (
          <span>
            Extracción {Math.min(step, secuencia.length)} / {secuencia.length}
            {step < secuencia.length ? ' · Próxima bolilla…' : ' · Completado'}
          </span>
        )}
      </div>
    </div>
  );
}
