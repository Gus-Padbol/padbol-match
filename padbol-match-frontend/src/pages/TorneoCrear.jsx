import React, { useState, useEffect, useMemo } from 'react';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import '../styles/TorneoCrear.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authUrlWithRedirect } from '../utils/authLoginRedirect';
import { CATEGORIA_TORNEO_DEFAULT, TORNEO_CATEGORIA_OPTIONS } from '../constants/torneoCategoria';
import {
  TORNEO_TIPO_COMPETENCIA_DEFAULT,
  TORNEO_TIPO_COMPETENCIA_OPTIONS,
  TORNEO_CATEGORIA_EDAD_DEFAULT,
  TORNEO_CATEGORIA_EDAD_OPTIONS,
} from '../constants/torneoCompetencia';
import useUserRole from '../hooks/useUserRole';
import { mapEstadoTorneoFormParaApi } from '../utils/torneoEstadoAdminApi';

export default function TorneoCrear({ apiBaseUrl = 'https://padbol-backend.onrender.com', rol: rolProp = null }) {
  const [sedes, setSedes] = useState([]);
  const [tiposCustom, setTiposCustom] = useState([]);
  const [formData, setFormData] = useState({
    nombre: '',
    sede_id: '',
    nivel_torneo: 'club',
    categoria: CATEGORIA_TORNEO_DEFAULT,
    tipo_competencia: TORNEO_TIPO_COMPETENCIA_DEFAULT,
    categoria_edad: TORNEO_CATEGORIA_EDAD_DEFAULT,
    tipo_torneo: 'round_robin',
    fecha_inicio: '',
    fecha_fin: '',
    cantidad_equipos: '',
    costo_inscripcion: '',
    cupos_maximos: '',
    horas_revelar_equipos: '48',
    estado: 'proximo',
    es_multisede: false,
    equipos_por_grupo: '',
    clasificados_por_grupo: '',
    mejores_terceros_clasificados: '',
    fecha_apertura_inscripcion: '',
  });

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol: rolFromHook, sedeId } = useUserRole(currentCliente);
  const rol = rolProp || rolFromHook;
  const esAdminClub = rol === 'admin_club';

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/sedes`)
      .then((res) => res.json())
      .then((data) => setSedes(data || []))
      .catch(() => setError('Error al cargar sedes'));

    try {
      const cfg = JSON.parse(localStorage.getItem('config_puntos') || '{}');
      setTiposCustom(cfg.tipos_custom || []);
    } catch {
      /* ignore */
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!esAdminClub || sedeId == null || sedeId === '') return;
    const idStr = String(sedeId);
    setFormData((prev) => ({
      ...prev,
      sede_id: idStr,
      es_multisede: false,
    }));
  }, [esAdminClub, sedeId]);

  const sedeSeleccionada = useMemo(
    () => sedes.find((s) => String(s.id) === String(formData.sede_id)),
    [sedes, formData.sede_id]
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (esAdminClub && name === 'es_multisede') return;
    if (esAdminClub && name === 'sede_id') return;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) {
      navigate(authUrlWithRedirect('/torneo/crear'));
      return;
    }
    setLoading(true);
    setMensaje('');
    setError('');

    if (!formData.nombre || !formData.tipo_torneo || !formData.fecha_inicio || !formData.fecha_fin) {
      setError('Completa los campos obligatorios');
      setLoading(false);
      return;
    }
    if (!String(formData.categoria || '').trim()) {
      setError('Selecciona la categoría del torneo');
      setLoading(false);
      return;
    }

    if (!formData.es_multisede && !formData.sede_id) {
      setError('Selecciona una sede (o marca multisede)');
      setLoading(false);
      return;
    }

    const payload = {
      nombre: formData.nombre,
      sede_id: formData.es_multisede ? null : parseInt(formData.sede_id, 10),
      nivel_torneo: formData.nivel_torneo,
      categoria: String(formData.categoria || '').trim() || CATEGORIA_TORNEO_DEFAULT,
      tipo_competencia: String(formData.tipo_competencia || '').trim() || TORNEO_TIPO_COMPETENCIA_DEFAULT,
      categoria_edad: String(formData.categoria_edad || '').trim() || TORNEO_CATEGORIA_EDAD_DEFAULT,
      tipo_torneo: formData.tipo_torneo,
      estado: mapEstadoTorneoFormParaApi(formData.estado || 'proximo'),
      fecha_inicio: formData.fecha_inicio,
      fecha_fin: formData.fecha_fin,
      cantidad_equipos: formData.cantidad_equipos ? parseInt(formData.cantidad_equipos, 10) : null,
      es_multisede: formData.es_multisede,
      created_by: null,
    };

    const rawCosto = String(formData.costo_inscripcion ?? '').trim();
    if (rawCosto !== '') {
      const c = parseFloat(rawCosto.replace(',', '.'));
      payload.costo_inscripcion = Number.isFinite(c) && c >= 0 ? c : 0;
    } else {
      payload.costo_inscripcion = 0;
    }

    const rawCupos = String(formData.cupos_maximos ?? '').trim();
    if (rawCupos !== '') {
      const cm = parseInt(rawCupos, 10);
      payload.cupos_maximos = Number.isFinite(cm) && cm > 0 ? cm : null;
    } else {
      payload.cupos_maximos = null;
    }
    const rawHorasRev = String(formData.horas_revelar_equipos ?? '').trim();
    if (rawHorasRev !== '') {
      const hr = parseInt(rawHorasRev, 10);
      payload.horas_revelar_equipos = Number.isFinite(hr) && hr >= 0 ? hr : 48;
    } else {
      payload.horas_revelar_equipos = 48;
    }

    if (formData.tipo_torneo === 'grupos_knockout') {
      const ep = parseInt(String(formData.equipos_por_grupo), 10);
      const cp = parseInt(String(formData.clasificados_por_grupo), 10);
      const mt = parseInt(String(formData.mejores_terceros_clasificados), 10);
      if (!Number.isFinite(ep) || ep < 2) {
        setError('Indica equipos por grupo (mínimo 2)');
        setLoading(false);
        return;
      }
      if (!Number.isFinite(cp) || cp < 1) {
        setError('Indica clasificados por grupo (mínimo 1)');
        setLoading(false);
        return;
      }
      payload.equipos_por_grupo = ep;
      payload.clasificados_por_grupo = cp;
      payload.mejores_terceros_clasificados = Number.isFinite(mt) && mt >= 0 ? mt : 0;
    }

    const rawFap = String(formData.fecha_apertura_inscripcion ?? '').trim();
    if (rawFap) {
      const d = new Date(rawFap);
      if (Number.isNaN(d.getTime())) {
        setError('La fecha/hora de apertura automática no es válida');
        setLoading(false);
        return;
      }
      payload.fecha_apertura_inscripcion = d.toISOString();
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/torneos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('Result recibido:', result);

      if (response.ok) {
        setMensaje('✅ Torneo creado correctamente');
        setTimeout(() => {
          navigate(`/torneo/${result[0].id}`);
        }, 1500);
      } else {
        setError(result.error || 'Error al crear torneo');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const esGruposKnockout = formData.tipo_torneo === 'grupos_knockout';

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Crear torneo" />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: hubContentPaddingTopCss(location.pathname),
          paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        }}
      >
        <div className="torneo-crear-container">
          <div className="torneo-crear-card">
            <h1>🏆 Crear Nuevo Torneo</h1>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre del Torneo *</label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Torneo La Meca 2026"
                  required
                />
              </div>

              <div className="form-group">
                <label>Nivel *</label>
                <select name="nivel_torneo" value={formData.nivel_torneo} onChange={handleChange}>
                  <option value="club">Club</option>
                  <option value="club_no_oficial">Club No Oficial</option>
                  {rol !== 'admin_club' && <option value="club_oficial">Club Oficial</option>}
                  {rol !== 'admin_club' && <option value="nacional">Nacional</option>}
                  {rol !== 'admin_club' && <option value="internacional">Internacional</option>}
                  {rol !== 'admin_club' && <option value="mundial">Mundial</option>}
                  {tiposCustom.length > 0 && <option disabled>──────────</option>}
                  {tiposCustom.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
                {rol === 'admin_club' && (
                  <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Los niveles Oficial, Nacional, Internacional y Mundial requieren permisos de Admin Nacional o Super Admin.
                  </small>
                )}
              </div>

              {!esAdminClub && (
                <div className="form-group checkbox">
                  <input
                    type="checkbox"
                    name="es_multisede"
                    checked={formData.es_multisede}
                    onChange={handleChange}
                    id="multisede"
                  />
                  <label htmlFor="multisede">Multisede (varios países)</label>
                </div>
              )}

              {!formData.es_multisede && (
                <div className="form-group">
                  <label>Sede *</label>
                  {esAdminClub ? (
                    <>
                      <select
                        name="sede_id"
                        value={formData.sede_id}
                        disabled
                        required
                        style={{ opacity: 0.92, cursor: 'not-allowed' }}
                      >
                        {sedeSeleccionada ? (
                          <option value={String(sedeSeleccionada.id)}>
                            {sedeSeleccionada.nombre} — {sedeSeleccionada.ciudad || '—'}
                          </option>
                        ) : (
                          <option value={formData.sede_id || ''}>Cargando sede…</option>
                        )}
                      </select>
                      <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                        La sede corresponde a tu club y no se puede cambiar desde aquí.
                      </small>
                    </>
                  ) : (
                    <select name="sede_id" value={formData.sede_id} onChange={handleChange} required>
                      <option value="">-- Selecciona Sede --</option>
                      {sedes.map((sede) => (
                        <option key={sede.id} value={sede.id}>
                          {sede.nombre} - {sede.ciudad}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Tipo de torneo (Masculino / Femenino / Mixto) *</label>
                <select
                  name="tipo_competencia"
                  value={formData.tipo_competencia}
                  onChange={handleChange}
                  required aria-label="Tipo de torneo del torneo"
                >
                  {TORNEO_TIPO_COMPETENCIA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                  Quién puede inscribirse (Masculino, Femenino o Mixto). Distinto del formato (Round Robin, etc.).
                </small>
              </div>

              <div className="form-group">
                <label>Categoría de edad *</label>
                <select
                  name="categoria_edad"
                  value={formData.categoria_edad}
                  onChange={handleChange}
                  required aria-label="Categoría de edad del torneo"
                >
                  {TORNEO_CATEGORIA_EDAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Categoría *</label>
                <select name="categoria" value={formData.categoria} onChange={handleChange} required>
                  {TORNEO_CATEGORIA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Formato *</label>
                <select name="tipo_torneo" value={formData.tipo_torneo} onChange={handleChange}>
                  <option value="round_robin">Round Robin (todos vs todos)</option>
                  <option value="knockout">Knockout (eliminación directa)</option>
                  <option value="grupos_knockout">Grupos + Knockout</option>
                </select>
              </div>

              <div className="form-group">
                <label>Estado inicial del torneo</label>
                <select name="estado" value={formData.estado} onChange={handleChange}>
                  <option value="proximo">Próximo</option>
                  <option value="abierto">Inscripción abierta</option>
                  <option value="en_curso">En curso</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                  «Próximo» equivale a planificación; el servidor guarda el valor canónico. Puedes abrir inscripción al crear
                  o editarlo después en el panel.
                </small>
              </div>

              {esGruposKnockout && (
                <>
                  <div className="form-group">
                    <label>Equipos por grupo *</label>
                    <input
                      type="number"
                      name="equipos_por_grupo"
                      value={formData.equipos_por_grupo}
                      onChange={handleChange}
                      min={2}
                      placeholder="Ej: 4"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Clasificados por grupo *</label>
                    <input
                      type="number"
                      name="clasificados_por_grupo"
                      value={formData.clasificados_por_grupo}
                      onChange={handleChange}
                      min={1}
                      placeholder="Ej: 2"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Mejores terceros clasificados</label>
                    <input
                      type="number"
                      name="mejores_terceros_clasificados"
                      value={formData.mejores_terceros_clasificados}
                      onChange={handleChange}
                      min={0}
                      placeholder="0 = ninguno"
                    />
                    <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Cantidad de mejores terceros que pasan a la fase final (0 si no aplica).
                    </small>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Apertura automática de inscripción (opcional)</label>
                <input
                  type="datetime-local"
                  name="fecha_apertura_inscripcion"
                  value={formData.fecha_apertura_inscripcion}
                  onChange={handleChange}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                  Si lo completas, el sistema pasa el torneo a «Inscripción abierta» en esa fecha y hora (torneo en
                  planificación).
                </small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha Inicio *</label>
                  <input
                    type="date"
                    name="fecha_inicio"
                    value={formData.fecha_inicio}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Fin *</label>
                  <input
                    type="date"
                    name="fecha_fin"
                    value={formData.fecha_fin}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Cantidad de Equipos (opcional)</label>
                <input
                  type="number"
                  name="cantidad_equipos"
                  value={formData.cantidad_equipos}
                  onChange={handleChange}
                  placeholder="Ej: 8"
                  min="2"
                />
              </div>

              <div className="form-group">
                <label>Costo de inscripción por equipo (opcional)</label>
                <input
                  type="number"
                  name="costo_inscripcion"
                  value={formData.costo_inscripcion}
                  onChange={handleChange}
                  placeholder="0 = gratis"
                  min="0"
                  step="1"
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Monto total por equipo (ARS u otra moneda de la sede en Mercado Pago). Deja vacío o 0 si no hay costo.
                </small>
              </div>

              <div className="form-group">
                <label>Cupos máximos de equipos (opcional)</label>
                <input
                  type="number"
                  name="cupos_maximos"
                  value={formData.cupos_maximos}
                  onChange={handleChange}
                  placeholder="Ej: 16 — para mostrar cupos disponibles en el listado público"
                  min="1"
                  step="1"
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Si lo definís, en la lista de torneos se muestran los cupos libres según equipos con inscripción confirmada.
                </small>
              </div>

              <div className="form-group">
                <label>Horas antes del inicio para revelar equipos participantes</label>
                <input
                  type="number"
                  name="horas_revelar_equipos"
                  value={formData.horas_revelar_equipos}
                  onChange={handleChange}
                  placeholder="48"
                  min="0"
                  step="1"
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Hasta entonces, en la pestaña Equipos los jugadores ven un mensaje en lugar de la lista (los admins del torneo siempre ven los equipos). Puedes cambiar este valor desde el panel.
                </small>
              </div>

              {error && <div className="error-message">{error}</div>}
              {mensaje && <div className="success-message">{mensaje}</div>}

              <button type="submit" disabled={loading} className="btn-submit">
                {loading ? 'Creando...' : '✅ Crear Torneo'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
