import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../../constants/deportesCanchaSede';
import { DeporteIcono } from '../../utils/deporteIcono';
import { cancelarInscripcionClase, fetchClaseDetalle, inscribirClase } from '../../utils/clasesApi';
import { stripProfesorPublic } from '../../utils/profesorPublic';
import { labelDiaCorta, nextNDaysFrom, normalizeHoraClase, todayISO } from '../../utils/clasesFechas';

function msHastaInicioClase(fechaYmd, horaInicio) {
  const hi = normalizeHoraClase(horaInicio);
  if (!fechaYmd || !hi) return null;
  const start = new Date(`${fechaYmd}T${hi}:00-03:00`);
  if (Number.isNaN(start.getTime())) return null;
  return start.getTime() - Date.now();
}

const COL_MAX = 390;
const ACCENT = '#E11B22';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k;
}

function labelTipo(tipo) {
  return String(tipo || 'grupal').toLowerCase() === 'individual' ? 'Individual' : 'Grupal';
}

export default function ClaseDetalle({ claseId, moneda = 'ARS' }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [clase, setClase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fecha, setFecha] = useState(() => todayISO());
  const [horaSel, setHoraSel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [okMsg, setOkMsg] = useState('');

  const dias = useMemo(() => nextNDaysFrom(todayISO(), 30), []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await fetchClaseDetalle(claseId, {
        fecha,
        accessToken: session?.access_token,
      });
      setClase(data);
      setHoraSel('');
    } catch (e) {
      setErr(e?.message || String(e));
      setClase(null);
    } finally {
      setLoading(false);
    }
  }, [claseId, fecha, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  const miInscripcion = clase?.mi_inscripcion || null;
  const horasCancel = Number(clase?.horas_cancelacion) || 24;
  const puedeCancelarPorPolitica = useMemo(() => {
    if (!miInscripcion) return false;
    const ms = msHastaInicioClase(miInscripcion.fecha, miInscripcion.hora_inicio);
    if (ms == null) return false;
    return ms >= horasCancel * 60 * 60 * 1000;
  }, [miInscripcion, horasCancel]);

  const cancelarInscripcion = async () => {
    if (!session?.access_token || !miInscripcion?.id) {
      navigate('/login', { state: { from: `/clases/${claseId}` } });
      return;
    }
    if (!puedeCancelarPorPolitica) {
      setErr(`No se puede cancelar con menos de ${horasCancel} horas de anticipación`);
      return;
    }
    if (!window.confirm('¿Cancelar tu inscripción a esta clase?')) return;
    setCancelando(true);
    setErr('');
    setOkMsg('');
    try {
      await cancelarInscripcionClase({
        inscripcionId: miInscripcion.id,
        accessToken: session.access_token,
      });
      setOkMsg('Inscripción cancelada.');
      await load();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setCancelando(false);
    }
  };

  const cuposPorHorario = useMemo(() => {
    const list = Array.isArray(clase?.cupos_por_horario) ? clase.cupos_por_horario : [];
    return list.map((h) => ({
      ...h,
      hora_inicio: normalizeHoraClase(h.hora_inicio) || h.hora_inicio,
    }));
  }, [clase]);

  const precioBase = Math.round(Number(clase?.precio) || 0);
  const cargoPlataforma = Math.round(precioBase * 0.03);
  const precioTotal = precioBase + cargoPlataforma;
  const mon = String(moneda || 'ARS').trim() || 'ARS';

  const horaSelNorm = normalizeHoraClase(horaSel);
  const slotSel = cuposPorHorario.find((h) => h.hora_inicio === horaSelNorm);

  const reservar = async () => {
    if (!session?.access_token) {
      navigate('/login', { state: { from: `/clases/${claseId}` } });
      return;
    }
    if (!horaSelNorm) {
      setErr('Elegí un horario.');
      return;
    }
    setSubmitting(true);
    setErr('');
    setOkMsg('');
    try {
      await inscribirClase({
        claseId,
        fecha,
        horaInicio: horaSelNorm,
        accessToken: session.access_token,
      });
      setOkMsg('¡Listo! Tu reserva de clase quedó registrada.');
      await load();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !clase) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando clase…</p>;
  }

  if (!clase && err) {
    return <p style={{ color: 'var(--pm-color-error, #dc2626)', fontSize: 14 }}>{err}</p>;
  }

  if (!clase) return null;

  const prof = stripProfesorPublic(clase.profesor) || {};

  return (
    <div style={{ width: '100%', maxWidth: COL_MAX, margin: '0 auto', boxSizing: 'border-box' }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          margin: '0 0 14px',
          padding: 0,
          border: 'none',
          background: 'none',
          color: ACCENT,
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ← Volver
      </button>

      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2 }}>
        {clase.titulo}
      </h1>
      {clase.descripcion ? (
        <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          {clase.descripcion}
        </p>
      ) : null}

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
          fontSize: 14,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
        }}
      >
        <div>
          <strong>Profesor:</strong> {prof.nombre || '—'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>Deporte:</strong>
          <DeporteIcono deporte={clase.deporte} size={18} />
          {labelDeporte(clase.deporte)}
        </div>
        <div><strong>Tipo:</strong> {labelTipo(clase.tipo)}</div>
        <div><strong>Cupo máximo:</strong> {clase.cupo_maximo}</div>
        <div><strong>Duración:</strong> {clase.duracion_minutos} min</div>
      </div>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>Día</label>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
        {dias.map((iso, idx) => {
          const active = fecha === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setFecha(iso)}
              style={{
                flex: '0 0 auto',
                minWidth: 88,
                padding: '12px 14px',
                borderRadius: 12,
                border: active ? `2px solid ${ACCENT}` : '1px solid var(--border)',
                background: active ? 'rgba(229, 57, 53, 0.12)' : 'var(--bg-page)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {labelDiaCorta(iso, idx)}
            </button>
          );
        })}
      </div>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 16, marginBottom: 8 }}>Horarios disponibles</label>
      {cuposPorHorario.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No hay horarios para este día.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
          {cuposPorHorario.map((h) => {
            const active = horaSelNorm === h.hora_inicio;
            const agotado = h.cupos_restantes <= 0;
            return (
              <button
                key={h.hora_inicio}
                type="button"
                disabled={agotado}
                onClick={() => setHoraSel(h.hora_inicio)}
                style={{
                  padding: '12px 8px',
                  borderRadius: 12,
                  border: active ? `2px solid ${ACCENT}` : '1px solid var(--border)',
                  background: active ? 'rgba(229, 57, 53, 0.12)' : 'var(--bg-page)',
                  opacity: agotado ? 0.45 : 1,
                  cursor: agotado ? 'not-allowed' : 'pointer',
                  color: 'var(--text-primary)',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                <div>{h.hora_inicio}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {agotado ? 'Sin cupo' : `${h.cupos_restantes} lugares`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {miInscripcion ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
            fontSize: 14,
            color: '#166534',
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Ya estás inscripto</div>
          <div>
            Turno: {miInscripcion.fecha} · {normalizeHoraClase(miInscripcion.hora_inicio) || miInscripcion.hora_inicio}
          </div>
          {!puedeCancelarPorPolitica ? (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#b45309', fontWeight: 600 }}>
              No se puede cancelar con menos de {horasCancel} horas de anticipación.
            </p>
          ) : null}
          <button
            type="button"
            disabled={cancelando || !puedeCancelarPorPolitica}
            onClick={() => void cancelarInscripcion()}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '11px 14px',
              borderRadius: 10,
              border: '1px solid #fca5a5',
              background: cancelando ? '#fecaca' : '#fff',
              color: '#b91c1c',
              fontWeight: 800,
              fontSize: 14,
              cursor: cancelando || !puedeCancelarPorPolitica ? 'not-allowed' : 'pointer',
              opacity: !puedeCancelarPorPolitica ? 0.6 : 1,
            }}
          >
            {cancelando ? 'Cancelando…' : 'Cancelar inscripción'}
          </button>
        </div>
      ) : null}

      {err ? <p style={{ color: 'var(--pm-color-error, #dc2626)', fontSize: 14, marginTop: 12 }}>{err}</p> : null}
      {okMsg ? <p style={{ color: 'var(--pm-color-success, #16a34a)', fontSize: 14, marginTop: 12, fontWeight: 600 }}>{okMsg}</p> : null}

      {!miInscripcion ? (
        <>
          <div
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 14,
              marginTop: 16,
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--text-primary)',
            }}
          >
            <div>
              <strong>Subtotal:</strong> {mon} {precioBase.toLocaleString('es-AR')}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>
              <strong>Cargo de servicio (3%):</strong> {mon} {cargoPlataforma.toLocaleString('es-AR')}
            </div>
            <div style={{ marginTop: 10, fontWeight: 900, fontSize: 18 }}>
              Total a pagar: {mon} {precioTotal.toLocaleString('es-AR')}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || !horaSelNorm || (slotSel && slotSel.cupos_restantes <= 0)}
            onClick={() => void reservar()}
            style={{
              width: '100%',
              marginTop: 16,
              border: 'none',
              borderRadius: 12,
              padding: 14,
              background: submitting ? '#94a3b8' : `linear-gradient(135deg, ${ACCENT}, #b91c1c)`,
              color: '#fff',
              fontWeight: 900,
              fontSize: 16,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Reservando…' : 'Reservar clase'}
          </button>
        </>
      ) : null}
    </div>
  );
}
