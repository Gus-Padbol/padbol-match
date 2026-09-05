import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import SedeSearchInput from '../components/SedeSearchInput';
import ConfirmModal from '../components/ConfirmModal';
import {
  hubContentPaddingTopCss,
  hubMainPaddingBottomCss,
} from '../constants/hubLayout';
import '../styles/TorneoCrear.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
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
import TorneoPuntosDistribucionModal from '../components/torneo/TorneoPuntosDistribucionModal';
import {
  TORNEO_DEPORTE_PADBOL,
  TORNEO_FORMATO_DOBLES,
  TORNEO_DEPORTE_OPTIONS,
  TORNEO_FORMATO_SINGLES_DOBLES_OPTIONS,
  torneoDeportePermiteSinglesDobles,
  formatoEquipoDefaultParaDeporte,
  formatoEquipoPayloadParaApi,
  normalizeTorneoDeporte,
} from '../utils/torneoDeporteFormato';
import { useSafeTranslation } from '../i18n/tSafe';

function formatSedeTorneoOption(sede) {
  const nombre = String(sede?.nombre || '').trim();
  const ciudad = String(sede?.ciudad || '').trim();
  return ciudad ? `${nombre} - ${ciudad}` : nombre;
}

const EMPTY_TORNEO_FORM = () => ({
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
  inscripcion_monto: '',
  inscripcion_moneda: 'ARS',
  premios_descripcion: '',
  puntos_total: '',
  cupos_maximos: '',
  horas_revelar_equipos: '48',
  estado: 'proximo',
  es_multisede: false,
  equipos_por_grupo: '',
  clasificados_por_grupo: '',
  mejores_terceros_clasificados: '',
  fecha_apertura_inscripcion: '',
  deporte: TORNEO_DEPORTE_PADBOL,
  formato_equipo: TORNEO_FORMATO_DOBLES,
});

const TorneoCrear = forwardRef(function TorneoCrear({
  apiBaseUrl = 'https://padbol-backend.onrender.com',
  rol: rolProp = null,
  /** Dentro del panel /admin: sin AppHeader ni BottomNav. */
  embedded = false,
  onClose,
  onCreated,
  onDirtyChange,
}, ref) {
  const { t } = useSafeTranslation();
  const [sedes, setSedes] = useState([]);
  const [tiposCustom, setTiposCustom] = useState([]);
  const [formData, setFormData] = useState(() => EMPTY_TORNEO_FORM());
  const [baseline, setBaseline] = useState(() => EMPTY_TORNEO_FORM());
  const [abandonOpen, setAbandonOpen] = useState(false);
  const pendingLeaveRef = useRef(null);
  const isDirtyRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [puntosModalOpen, setPuntosModalOpen] = useState(false);

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol: rolFromHook, sedeId } = useUserRole(currentCliente);
  const rol = rolProp || rolFromHook;
  const esAdminClub = rol === 'admin_club';

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline),
    [formData, baseline],
  );

  useEffect(() => {
    isDirtyRef.current = isDirty;
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/sedes`)
      .then((res) => res.json())
      .then((data) => setSedes(data || []))
      .catch(() => setError(t('torneos.create.loadVenuesError')));

    try {
      const cfg = JSON.parse(localStorage.getItem('config_puntos') || '{}');
      setTiposCustom(cfg.tipos_custom || []);
    } catch {
      /* ignore */
    }
  }, [apiBaseUrl, t]);

  useEffect(() => {
    if (!esAdminClub || sedeId == null || sedeId === '') return;
    const idStr = String(sedeId);
    // Misma mutación en form y baseline: auto-sede no marca dirty ni borra edits del usuario.
    setFormData((prev) => {
      if (prev.sede_id === idStr && prev.es_multisede === false) return prev;
      return { ...prev, sede_id: idStr, es_multisede: false };
    });
    setBaseline((prev) => {
      if (prev.sede_id === idStr && prev.es_multisede === false) return prev;
      return { ...prev, sede_id: idStr, es_multisede: false };
    });
  }, [esAdminClub, sedeId]);

  const resetFormClean = useCallback(() => {
    const next = esAdminClub && sedeId != null && sedeId !== ''
      ? { ...EMPTY_TORNEO_FORM(), sede_id: String(sedeId), es_multisede: false }
      : EMPTY_TORNEO_FORM();
    setFormData(next);
    setBaseline(next);
    setMensaje('');
    setError('');
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [esAdminClub, onDirtyChange, sedeId]);

  const requestLeave = useCallback((onAllowed) => {
    if (!isDirtyRef.current) {
      onAllowed?.();
      return;
    }
    pendingLeaveRef.current = onAllowed;
    setAbandonOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({
    tryLeave: requestLeave,
    isDirty: () => isDirtyRef.current,
    resetClean: resetFormClean,
  }), [requestLeave, resetFormClean]);

  useEffect(() => {
    if (!embedded) return undefined;
    const onBeforeUnload = (ev) => {
      if (!isDirtyRef.current) return;
      ev.preventDefault();
      ev.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [embedded]);

  useEffect(() => {
    if (!embedded) return undefined;
    window.history.pushState({ padbolTorneoCrear: true }, '');
    const onPopState = () => {
      if (!isDirtyRef.current) {
        onClose?.();
        return;
      }
      window.history.pushState({ padbolTorneoCrear: true }, '');
      requestLeave(() => {
        resetFormClean();
        onClose?.();
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [embedded, onClose, requestLeave, resetFormClean]);

  const sedeSeleccionada = useMemo(
    () => sedes.find((s) => String(s.id) === String(formData.sede_id)),
    [sedes, formData.sede_id]
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (esAdminClub && name === 'es_multisede') return;
    if (esAdminClub && name === 'sede_id') return;
    if (name === 'deporte') {
      setFormData((prev) => ({
        ...prev,
        deporte: value,
        formato_equipo: formatoEquipoDefaultParaDeporte(value),
      }));
      return;
    }
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
      setError(t('torneos.create.requiredFieldsError'));
      setLoading(false);
      return;
    }
    if (!String(formData.categoria || '').trim()) {
      setError(t('torneos.create.selectCategoryError'));
      setLoading(false);
      return;
    }

    if (!String(formData.deporte || '').trim()) {
      setError(t('torneos.create.selectSportError'));
      setLoading(false);
      return;
    }

    if (!formData.es_multisede && !formData.sede_id) {
      setError(t('torneos.create.selectVenueError'));
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
      deporte: normalizeTorneoDeporte(formData.deporte),
      formato_equipo: formatoEquipoPayloadParaApi(formData.deporte, formData.formato_equipo),
    };

    const rawInscripcionMonto = String(formData.inscripcion_monto ?? '').trim();
    if (rawInscripcionMonto !== '') {
      const c = parseFloat(rawInscripcionMonto.replace(',', '.'));
      const monto = Number.isFinite(c) && c >= 0 ? c : 0;
      payload.inscripcion_monto = monto;
      payload.inscripcion_moneda = ['ARS', 'USD', 'EUR'].includes(formData.inscripcion_moneda)
        ? formData.inscripcion_moneda
        : 'ARS';
      payload.costo_inscripcion = monto;
    } else {
      payload.inscripcion_monto = null;
      payload.inscripcion_moneda = null;
      payload.costo_inscripcion = 0;
    }

    const premios = String(formData.premios_descripcion ?? '').trim();
    payload.premios_descripcion = premios || null;

    const rawPuntosTotal = String(formData.puntos_total ?? '').trim();
    if (rawPuntosTotal !== '') {
      const pts = parseInt(rawPuntosTotal, 10);
      payload.puntos_total = Number.isFinite(pts) && pts >= 0 ? pts : null;
    } else {
      payload.puntos_total = null;
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
        setError(t('torneos.create.teamsPerGroupError'));
        setLoading(false);
        return;
      }
      if (!Number.isFinite(cp) || cp < 1) {
        setError(t('torneos.create.qualifiersPerGroupError'));
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
        setError(t('torneos.create.autoOpenDateError'));
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
        setMensaje(t('torneos.create.createdSuccess'));
        resetFormClean();
        const nuevoId = result?.[0]?.id;
        if (embedded) {
          if (nuevoId != null) onCreated?.(nuevoId);
          window.setTimeout(() => {
            onClose?.();
          }, 900);
        } else {
          setTimeout(() => {
            navigate(`/torneo/${result[0].id}`);
          }, 1500);
        }
      } else {
        setError(result.error || t('torneos.create.createError'));
      }
    } catch (err) {
      setError(t('torneos.create.errorWithDetail', { error: err.message }));
    } finally {
      setLoading(false);
    }
  };
  const esGruposKnockout = formData.tipo_torneo === 'grupos_knockout';

  const formulario = (
    <div className={embedded ? 'torneo-crear-container torneo-crear-container--embedded' : 'torneo-crear-container'}>
      <div className="torneo-crear-card">
        {embedded && onClose ? (
          <button
            type="button"
            onClick={() => requestLeave(() => {
              resetFormClean();
              onClose?.();
            })}
            style={{
              marginBottom: '16px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ← {t('torneos.create.backToTournaments')}
          </button>
        ) : null}
        <h1>🏆 {t('torneos.create.title')}</h1>
        <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('torneos.create.nameLabel')} *</label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder={t('torneos.create.namePlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('torneos.create.sportLabel')} *</label>
                <select name="deporte" value={formData.deporte} onChange={handleChange} required>
                  {TORNEO_DEPORTE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(`torneo.deporte.${o.value}`, { defaultValue: o.label })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.teamFormatLabel')} *</label>
                {torneoDeportePermiteSinglesDobles(formData.deporte) ? (
                  <select name="formato_equipo" value={formData.formato_equipo} onChange={handleChange} required>
                    {TORNEO_FORMATO_SINGLES_DOBLES_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(`torneos.create.teamFormat.${o.value}`, { defaultValue: o.label })}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select name="formato_equipo" value={TORNEO_FORMATO_DOBLES} disabled style={{ opacity: 0.92, cursor: 'not-allowed' }}>
                    <option value={TORNEO_FORMATO_DOBLES}>{t('torneos.create.teamFormat.dobles')}</option>
                  </select>
                )}
                <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {t('torneos.create.teamFormatHint')}
                </small>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.levelLabel')} *</label>
                <select name="nivel_torneo" value={formData.nivel_torneo} onChange={handleChange}>
                  <option value="club">{t('admin.tournamentLabels.level.club')}</option>
                  <option value="club_no_oficial">{t('admin.tournamentLabels.level.club_no_oficial')}</option>
                  {rol !== 'admin_club' && <option value="club_oficial">{t('admin.tournamentLabels.level.club_oficial')}</option>}
                  {rol !== 'admin_club' && <option value="nacional">{t('admin.tournamentLabels.level.nacional')}</option>}
                  {rol !== 'admin_club' && <option value="internacional">{t('admin.tournamentLabels.level.internacional')}</option>}
                  {rol !== 'admin_club' && <option value="mundial">{t('admin.tournamentLabels.level.mundial')}</option>}
                  {tiposCustom.length > 0 && <option disabled>──────────</option>}
                  {tiposCustom.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
                {rol === 'admin_club' && (
                  <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {t('torneos.create.restrictedLevelsHint')}
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
                  <label htmlFor="multisede">{t('torneos.create.multiVenueLabel')}</label>
                </div>
              )}

              {!formData.es_multisede && (
                <div className="form-group">
                  <label>{t('torneos.create.venueLabel')} *</label>
                  {esAdminClub ? (
                    <>
                      <SedeSearchInput
                        sedes={sedes}
                        valueId={formData.sede_id}
                        onChangeId={() => {}}
                        disabled
                        formatLabel={formatSedeTorneoOption}
                        inputStyle={{ opacity: 0.92, cursor: 'not-allowed' }}
                      />
                      {!sedeSeleccionada ? (
                        <small style={{ color: '#888', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                          {t('torneos.create.loadingVenue')}
                        </small>
                      ) : null}
                      <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                        {t('torneos.create.fixedVenueHint')}
                      </small>
                    </>
                  ) : (
                    <SedeSearchInput
                      sedes={sedes}
                      valueId={formData.sede_id}
                      onChangeId={(id) => setFormData((prev) => ({ ...prev, sede_id: id }))}
                      formatLabel={formatSedeTorneoOption}
                    />
                  )}
                </div>
              )}

              <div className="form-group">
                <label>{t('torneos.create.competitionTypeLabel')} *</label>
                <select
                  name="tipo_competencia"
                  value={formData.tipo_competencia}
                  onChange={handleChange}
                  required aria-label={t('torneos.create.competitionTypeAria')}
                >
                  {TORNEO_TIPO_COMPETENCIA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(`torneos.vista.genero.${o.value}`, { defaultValue: o.label })}</option>
                  ))}
                </select>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                  {t('torneos.create.competitionTypeHint')}
                </small>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.ageCategoryLabel')} *</label>
                <select
                  name="categoria_edad"
                  value={formData.categoria_edad}
                  onChange={handleChange}
                  required aria-label={t('torneos.create.ageCategoryAria')}
                >
                  {TORNEO_CATEGORIA_EDAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(`torneos.vista.categoriaEdad.${o.value}`, { defaultValue: o.label })}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.categoryLabel')} *</label>
                <select name="categoria" value={formData.categoria} onChange={handleChange} required>
                  {TORNEO_CATEGORIA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(`torneos.vista.categoriaNivel.${o.value}`, { defaultValue: o.label })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.fixtureFormatLabel')} *</label>
                <select name="tipo_torneo" value={formData.tipo_torneo} onChange={handleChange}>
                  <option value="round_robin">{t('torneos.tipo.round_robin')}</option>
                  <option value="knockout">{t('torneos.tipo.knockout')}</option>
                  <option value="grupos_knockout">{t('torneos.tipo.grupos_knockout')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.initialStatusLabel')}</label>
                <select name="estado" value={formData.estado} onChange={handleChange}>
                  <option value="proximo">{t('torneos.vista.estado.proximo')}</option>
                  <option value="abierto">{t('torneos.vista.estado.abierto')}</option>
                  <option value="en_curso">{t('torneos.vista.estado.en_curso')}</option>
                  <option value="finalizado">{t('torneos.vista.estado.finalizado')}</option>
                  <option value="cancelado">{t('torneos.vista.estado.cancelado')}</option>
                </select>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                  {t('torneos.create.initialStatusHint')}
                </small>
              </div>

              {esGruposKnockout && (
                <>
                  <div className="form-group">
                    <label>{t('torneos.create.teamsPerGroupLabel')} *</label>
                    <input
                      type="number"
                      name="equipos_por_grupo"
                      value={formData.equipos_por_grupo}
                      onChange={handleChange}
                      min={2}
                      placeholder="4"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('torneos.create.qualifiersPerGroupLabel')} *</label>
                    <input
                      type="number"
                      name="clasificados_por_grupo"
                      value={formData.clasificados_por_grupo}
                      onChange={handleChange}
                      min={1}
                      placeholder="2"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('torneos.create.bestThirdsLabel')}</label>
                    <input
                      type="number"
                      name="mejores_terceros_clasificados"
                      value={formData.mejores_terceros_clasificados}
                      onChange={handleChange}
                      min={0}
                      placeholder={t('torneos.create.nonePlaceholder')}
                    />
                    <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      {t('torneos.create.bestThirdsHint')}
                    </small>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>{t('torneos.create.autoOpenLabel')}</label>
                <input
                  type="datetime-local"
                  name="fecha_apertura_inscripcion"
                  value={formData.fecha_apertura_inscripcion}
                  onChange={handleChange}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                  {t('torneos.create.autoOpenHint')}
                </small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('torneos.create.startDateLabel')} *</label>
                  <input
                    type="date"
                    name="fecha_inicio"
                    value={formData.fecha_inicio}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('torneos.create.endDateLabel')} *</label>
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
                <label>{t('torneos.create.teamCountLabel')}</label>
                <input
                  type="number"
                  name="cantidad_equipos"
                  value={formData.cantidad_equipos}
                  onChange={handleChange}
                  placeholder="8"
                  min="2"
                />
              </div>

              <div className="form-group">
                <label>{t('torneos.create.registrationFeeLabel')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: '8px' }}>
                  <input
                    type="number"
                    name="inscripcion_monto"
                    value={formData.inscripcion_monto}
                    onChange={handleChange}
                    placeholder={t('torneos.create.freePlaceholder')}
                    min="0"
                    step="1"
                  />
                  <select
                    name="inscripcion_moneda"
                    value={formData.inscripcion_moneda}
                    onChange={handleChange}
                    aria-label={t('torneos.create.registrationCurrencyAria')}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {t('torneos.create.registrationFeeHint')}
                </small>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.prizesLabel')}</label>
                <textarea
                  name="premios_descripcion"
                  value={formData.premios_descripcion}
                  onChange={handleChange}
                  placeholder={t('torneos.create.prizesPlaceholder')}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label>{t('torneos.create.pointsLabel')}</label>
                <input
                  type="number"
                  name="puntos_total"
                  value={formData.puntos_total}
                  onChange={handleChange}
                  placeholder="1000"
                  min="0"
                  step="1"
                />
                {String(formData.puntos_total || '').trim() ? (
                  <button
                    type="button"
                    onClick={() => setPuntosModalOpen(true)}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#E11B22',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t('torneos.create.viewDistribution')}
                  </button>
                ) : null}
              </div>

              <div className="form-group">
                <label>{t('torneos.create.maxTeamsLabel')}</label>
                <input
                  type="number"
                  name="cupos_maximos"
                  value={formData.cupos_maximos}
                  onChange={handleChange}
                  placeholder={t('torneos.create.maxTeamsPlaceholder')}
                  min="1"
                  step="1"
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {t('torneos.create.maxTeamsHint')}
                </small>
              </div>

              <div className="form-group">
                <label>{t('torneos.create.revealHoursLabel')}</label>
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
                  {t('torneos.create.revealHoursHint')}
                </small>
              </div>

              {error && <div className="error-message">{error}</div>}
              {mensaje && <div className="success-message">{mensaje}</div>}

              <button type="submit" disabled={loading} className="btn-submit">
                {loading ? t('torneos.create.creating') : t('torneos.create.submit')}
              </button>
        </form>
      </div>
    </div>
  );

  const puntosModal = (
    <TorneoPuntosDistribucionModal
      open={puntosModalOpen}
      onClose={() => setPuntosModalOpen(false)}
      torneo={formData}
    />
  );

  const abandonModal = (
    <ConfirmModal
      open={abandonOpen}
      title={t('admin.torneosSection.abandonCreateTitle')}
      message={t('admin.torneosSection.abandonCreateMessage')}
      dismissLabel={t('admin.torneosSection.continueEditing')}
      confirmLabel={t('admin.torneosSection.discardCreate')}
      confirmDanger
      onDismiss={() => {
        setAbandonOpen(false);
        pendingLeaveRef.current = null;
      }}
      onConfirm={() => {
        const next = pendingLeaveRef.current;
        pendingLeaveRef.current = null;
        setAbandonOpen(false);
        resetFormClean();
        next?.();
      }}
    />
  );

  if (embedded) {
    return (
      <>
        {formulario}
        {puntosModal}
        {abandonModal}
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title={t('torneos.create.header')} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
          paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        }}
      >
        {formulario}
      </div>
      <BottomNav />
      {puntosModal}
      {abandonModal}
    </div>
  );
});

export default TorneoCrear;
