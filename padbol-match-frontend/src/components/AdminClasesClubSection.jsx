import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import {
  crearClaseAdmin,
  fetchAdminClaseAsistencia,
  fetchAdminClases,
  fetchAdminProfesores,
  patchAdminClaseAsistencia,
  patchClaseActivoAdmin,
} from '../utils/clasesAdminApi';
import { todayISO } from '../utils/clasesFechas';

const DIAS_KEYS = [
  { v: 0, key: 'dom' },
  { v: 1, key: 'lun' },
  { v: 2, key: 'mar' },
  { v: 3, key: 'mie' },
  { v: 4, key: 'jue' },
  { v: 5, key: 'vie' },
  { v: 6, key: 'sab' },
];
const ACCENT = 'var(--accent)';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k;
}

function emptyHorario() {
  return { dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00' };
}

export default function AdminClasesClubSection({ accessToken, sedeId, canchas = [], monedaSede = 'ARS' }) {
  const { t } = useTranslation();
  const DIAS = useMemo(
    () => DIAS_KEYS.map(({ v, key }) => ({ v, label: t(`admin.weekdays.${key}`) })),
    [t],
  );
  const [clases, setClases] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [asistenciaModal, setAsistenciaModal] = useState(null);
  const [asistenciaFecha, setAsistenciaFecha] = useState(() => todayISO());
  const [asistenciaRows, setAsistenciaRows] = useState([]);
  const [asistenciaLoading, setAsistenciaLoading] = useState(false);
  const [asistenciaPatchId, setAsistenciaPatchId] = useState(null);
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    profesor_id: '',
    cancha_id: '',
    deporte: '',
    tipo: 'grupal',
    cupo_maximo: '4',
    duracion_minutos: '60',
    precio: '',
    activo: true,
    horarios: [emptyHorario()],
  });

  const profsAprobados = useMemo(
    () => profesores.filter((p) => p.aprobado && p.activo !== false),
    [profesores],
  );

  const mon = String(monedaSede || 'ARS').trim() || 'ARS';

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const [cls, profs] = await Promise.all([
        fetchAdminClases({ sedeId, accessToken }),
        fetchAdminProfesores({ sedeId, accessToken }),
      ]);
      setClases(cls);
      setProfesores(profs);
    } catch (e) {
      setMsg(e?.message || 'Error');
      setClases([]);
    } finally {
      setLoading(false);
    }
  }, [sedeId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const addHorario = () => setForm((f) => ({ ...f, horarios: [...f.horarios, emptyHorario()] }));
  const updateHorario = (idx, patch) =>
    setForm((f) => ({
      ...f,
      horarios: f.horarios.map((h, i) => (i === idx ? { ...h, ...patch } : h)),
    }));
  const removeHorario = (idx) =>
    setForm((f) => ({ ...f, horarios: f.horarios.filter((_, i) => i !== idx) }));

  const guardar = async () => {
    const titulo = String(form.titulo || '').trim();
    const profesorId = Number(form.profesor_id);
    const deporte = String(form.deporte || '').trim().toLowerCase();
    if (!titulo || !Number.isFinite(profesorId) || !deporte) {
      setMsg(t('admin.formularios.completeClassFields'));
      return;
    }
    if (!form.horarios.length) {
      setMsg(t('admin.formularios.addAtLeastOneSchedule'));
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await crearClaseAdmin({
        accessToken,
        body: {
          sede_id: sedeId,
          profesor_id: profesorId,
          cancha_id: form.cancha_id ? Number(form.cancha_id) : null,
          deporte,
          titulo,
          descripcion: String(form.descripcion || '').trim() || null,
          tipo: form.tipo,
          cupo_maximo: form.tipo === 'grupal' ? Number(form.cupo_maximo) || 4 : 1,
          duracion_minutos: Number(form.duracion_minutos) || 60,
          precio: form.precio !== '' ? Number(form.precio) : 0,
          activo: !!form.activo,
          horarios: form.horarios.map((h) => ({
            dia_semana: Number(h.dia_semana),
            hora_inicio: h.hora_inicio,
            hora_fin: h.hora_fin,
          })),
        },
      });
      setForm({
        titulo: '',
        descripcion: '',
        profesor_id: '',
        cancha_id: '',
        deporte: '',
        tipo: 'grupal',
        cupo_maximo: '4',
        duracion_minutos: '60',
        precio: '',
        activo: true,
        horarios: [emptyHorario()],
      });
      setShowForm(false);
      await load();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const cargarAsistencia = useCallback(async () => {
    if (!asistenciaModal?.id) return;
    setAsistenciaLoading(true);
    setMsg('');
    try {
      const data = await fetchAdminClaseAsistencia({
        claseId: asistenciaModal.id,
        fecha: asistenciaFecha,
        accessToken,
      });
      setAsistenciaRows(Array.isArray(data?.inscripciones) ? data.inscripciones : []);
    } catch (e) {
      setMsg(e?.message || 'Error');
      setAsistenciaRows([]);
    } finally {
      setAsistenciaLoading(false);
    }
  }, [asistenciaModal?.id, asistenciaFecha, accessToken]);

  useEffect(() => {
    if (!asistenciaModal) return;
    void cargarAsistencia();
  }, [asistenciaModal, cargarAsistencia]);

  const abrirAsistencia = (claseRow) => {
    setAsistenciaModal(claseRow);
    setAsistenciaFecha(todayISO());
    setAsistenciaRows([]);
  };

  const toggleAsistio = async (insRow, asistio) => {
    if (!asistenciaModal?.id) return;
    setAsistenciaPatchId(insRow.id);
    setMsg('');
    try {
      await patchAdminClaseAsistencia({
        claseId: asistenciaModal.id,
        inscripcionId: insRow.id,
        asistio,
        accessToken,
      });
      await cargarAsistencia();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setAsistenciaPatchId(null);
    }
  };

  const toggleActivo = async (row) => {
    setTogglingId(row.id);
    setMsg('');
    try {
      await patchClaseActivoAdmin({ claseId: row.id, activo: !row.activo, accessToken });
      await load();
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setTogglingId(null);
    }
  };

  const inputStyle = { width: '100%', marginBottom: 10, boxSizing: 'border-box' };

  return (
        <div>
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        style={{
          border: 'none',
          borderRadius: 10,
          padding: '10px 14px',
          background: ACCENT,
          color: '#fff',
          fontWeight: 800,
          fontSize: 14,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        {showForm ? 'Cerrar formulario' : '+ Crear clase'}
      </button>
      {msg ? <p style={{ color: 'var(--pm-color-error, #f87171)', fontSize: 13, marginBottom: 10 }}>{msg}</p> : null}
      {showForm ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16, background: 'var(--bg-page)' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.hub.title')}</label>
          <input className="admin-mi-sede-theme-input" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.sedes.description')}</label>
          <textarea className="admin-mi-sede-theme-input" rows={2} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Profesor (aprobado)</label>
          <select className="admin-mi-sede-theme-input" value={form.profesor_id} onChange={(e) => setForm((f) => ({ ...f, profesor_id: e.target.value }))} style={inputStyle}>
            <option value="">Elegir…</option>
            {profsAprobados.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.nombre, p.apellido].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
          {profsAprobados.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -6, marginBottom: 10 }}>No hay profesores aprobados.</p>
          ) : null}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.metricas.courtCol')}</label>
          <select className="admin-mi-sede-theme-input" value={form.cancha_id} onChange={(e) => setForm((f) => ({ ...f, cancha_id: e.target.value }))} style={inputStyle}>
            <option value="">Sin cancha</option>
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre || `Cancha ${c.id}`}</option>
            ))}
          </select>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.metricas.sportLabel')}</label>
          <select className="admin-mi-sede-theme-input" value={form.deporte} onChange={(e) => setForm((f) => ({ ...f, deporte: e.target.value }))} style={inputStyle}>
            <option value="">Elegir…</option>
            {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.franjas.type')}</label>
          <select className="admin-mi-sede-theme-input" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
            <option value="grupal">Grupal</option>
            <option value="individual">Individual</option>
          </select>
          {form.tipo === 'grupal' ? (
            <>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.formularios.maxCapacity')}</label>
              <input type="number" min={2} className="admin-mi-sede-theme-input" value={form.cupo_maximo} onChange={(e) => setForm((f) => ({ ...f, cupo_maximo: e.target.value }))} style={inputStyle} />
            </>
          ) : null}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('admin.formularios.durationMin')}</label>
          <input type="number" min={15} className="admin-mi-sede-theme-input" value={form.duracion_minutos} onChange={(e) => setForm((f) => ({ ...f, duracion_minutos: e.target.value }))} style={inputStyle} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Precio ({mon})</label>
          <input type="number" min={0} className="admin-mi-sede-theme-input" value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} style={inputStyle} />
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Horarios recurrentes</p>
          {form.horarios.map((h, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <select className="admin-mi-sede-theme-input" value={h.dia_semana} onChange={(e) => updateHorario(idx, { dia_semana: Number(e.target.value) })}>
                {DIAS.map((d) => (
                  <option key={d.v} value={d.v}>{d.label}</option>
                ))}
              </select>
              <input type="time" className="admin-mi-sede-theme-input" value={h.hora_inicio} onChange={(e) => updateHorario(idx, { hora_inicio: e.target.value.slice(0, 5) })} />
              <input type="time" className="admin-mi-sede-theme-input" value={h.hora_fin} onChange={(e) => updateHorario(idx, { hora_fin: e.target.value.slice(0, 5) })} />
              {form.horarios.length > 1 ? (
                <button type="button" onClick={() => removeHorario(idx)} style={{ gridColumn: '1 / -1', fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>Quitar turno</button>
              ) : null}
            </div>
          ))}
          <button type="button" onClick={addHorario} style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Agregar horario</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />
            Clase activa
          </label>
          <button type="button" disabled={saving || profsAprobados.length === 0} onClick={() => void guardar()} style={{ border: 'none', borderRadius: 10, padding: '10px 16px', background: ACCENT, color: '#fff', fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? t('admin.metricas.saving') : t('admin.formularios.saveClass')}
          </button>
        </div>
      ) : null}
      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
      ) : clases.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No hay clases creadas.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {clases.map((c) => {
            const tipo = String(c.tipo || 'grupal').toLowerCase() === 'individual' ? 'Individual' : 'Grupal';
            return (
              <li key={c.id} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{c.titulo}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {c.profesor_nombre} · {labelDeporte(c.deporte)} · {tipo} · {mon} {Math.round(Number(c.precio) || 0).toLocaleString('es-AR')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: c.activo ? '#dcfce7' : '#f1f5f9', color: c.activo ? '#166534' : '#64748b' }}>
                    {c.activo ? t('admin.sedes.subscriptionActive') : 'Inactiva'}
                  </span>
                  <button type="button" disabled={togglingId === c.id} onClick={() => void toggleActivo(c)} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {togglingId === c.id ? '…' : c.activo ? t('admin.sponsors.deactivateBtn') : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirAsistencia(c)}
                    style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Ver asistencia
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {asistenciaModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 19998,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => setAsistenciaModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 20,
              maxWidth: 480,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Asistencia — {asistenciaModal.titulo}</h3>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Fecha</label>
            <input
              type="date"
              className="admin-mi-sede-theme-input"
              value={asistenciaFecha}
              onChange={(e) => setAsistenciaFecha(e.target.value)}
              style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
            />
            {asistenciaLoading ? (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
            ) : asistenciaRows.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sin inscriptos para esta fecha.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {asistenciaRows.map((row) => {
                  const marcado = row.asistio === true;
                  const ausente = row.asistio === false;
                  const pendiente = row.asistio == null;
                  return (
                    <li
                      key={row.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-page)',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{row.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {row.hora_inicio}
                        {row.email ? ` · ${row.email}` : ''}
                        {row.telefono ? ` · ${row.telefono}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={asistenciaPatchId === row.id}
                          onClick={() => void toggleAsistio(row, true)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: marcado ? '2px solid #16a34a' : '1px solid var(--border)',
                            background: marcado ? '#dcfce7' : 'var(--bg-card)',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          ✅ Asistió
                        </button>
                        <button
                          type="button"
                          disabled={asistenciaPatchId === row.id}
                          onClick={() => void toggleAsistio(row, false)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: ausente ? '2px solid #dc2626' : '1px solid var(--border)',
                            background: ausente ? '#fee2e2' : 'var(--bg-card)',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          ❌ No asistió
                        </button>
                        {pendiente ? (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>— Pendiente</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setAsistenciaModal(null)}
              style={{
                marginTop: 14,
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                fontWeight: 700,
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              {t('general.close')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
