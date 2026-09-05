import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { AdminJugadorSearchInput } from './AdminJugadoresSection';
import ConfirmModal from './ConfirmModal';
import {
  MEMBRESIA_DURACION_TIPOS,
  MEMBRESIA_ESTADOS,
  MEMBRESIA_MONEDAS,
  MEMBRESIA_ORIGENES,
  MEMBRESIAS_PAGE_SIZE,
  MEMBRESIAS_Q_MIN,
  MEMBRESIAS_SORT_OPTIONS,
  accionesDisponiblesParaEstado,
  asignarMembresia,
  cancelarMembresia,
  computeVencimientoFromPlan,
  createMembresiaPlan,
  emptyPlanForm,
  fetchAdminMembresias,
  fetchMembresiaPlanes,
  formatMembresiaFecha,
  formatMembresiaPrecio,
  normalizeMembresiasDirection,
  normalizeMembresiasSort,
  planToForm,
  renovarMembresia,
  resolveMembresiaJugadorLabel,
  suspenderMembresia,
  updateMembresiaPlan,
  validateAndBuildPlanPayload,
} from '../utils/membresiasAdminApi';

const PAGE_SIZE = MEMBRESIAS_PAGE_SIZE;
const SEARCH_DEBOUNCE_MS = 400;

function thStyle(extra = {}) {
  return {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 12,
    color: 'var(--bg-card)',
    background: 'var(--accent)',
    whiteSpace: 'nowrap',
    ...extra,
  };
}

function tdStyle(extra = {}) {
  return {
    padding: '9px 12px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
    verticalAlign: 'top',
    fontSize: 13,
    ...extra,
  };
}

function ScrollTable({ minWidth = 900, children }) {
  return (
    <div
      style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth, fontSize: 13 }}>
        {children}
      </table>
    </div>
  );
}

function estadoBadgeStyle(estado) {
  const e = String(estado || '').toLowerCase();
  const map = {
    activa: { bg: '#dcfce7', color: '#166534' },
    pendiente: { bg: '#fef9c3', color: '#854d0e' },
    suspendida: { bg: '#ffedd5', color: '#9a3412' },
    vencida: { bg: '#e5e7eb', color: '#374151' },
    cancelada: { bg: '#fee2e2', color: '#991b1b' },
  };
  return map[e] || { bg: 'var(--bg-page)', color: 'var(--text-primary)' };
}

/**
 * Membresías de jugadores por sede (distinto de Planes comerciales / PadCoins).
 */
export default function AdminMembresiasSection({
  apiBaseUrl,
  accessToken,
  isSuperAdmin = false,
  esAdminClub = false,
  clubSedeId = '',
  sedesOptions = [],
  sedeFlag = () => '',
}) {
  const { t } = useTranslation();
  const tr = useCallback(
    (key, fallback, params) => {
      const raw = t(`admin.membresias.${key}`, fallback, params || undefined);
      if (!params) return raw;
      return String(raw).replace(/\{\{(\w+)\}\}/g, (_, name) => (
        params[name] != null ? String(params[name]) : ''
      ));
    },
    [t],
  );

  const canUse = isSuperAdmin || esAdminClub;
  const fixedSedeId = esAdminClub ? String(clubSedeId || '') : '';

  const [subTab, setSubTab] = useState('planes');
  const [sedeId, setSedeId] = useState(() => fixedSedeId || '');
  const [planes, setPlanes] = useState([]);
  const [membresias, setMembresias] = useState([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [planFilter, setPlanFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [jugadorFilter, setJugadorFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [sort, setSort] = useState('created_at');
  const [direction, setDirection] = useState('desc');

  const membresiasSeqRef = useRef(0);
  const membresiasAbortRef = useRef(null);
  const initialMembresiasLoadedRef = useRef(false);

  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [planEditId, setPlanEditId] = useState(null);
  const [planForm, setPlanForm] = useState(() => emptyPlanForm(fixedSedeId));
  const [planFormError, setPlanFormError] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPlayer, setAssignPlayer] = useState(null);
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignInicio, setAssignInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignOrigen, setAssignOrigen] = useState('manual');
  const [assignNotas, setAssignNotas] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);

  const [detailRow, setDetailRow] = useState(null);

  const [confirmAction, setConfirmAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const inp = useMemo(
    () => ({
      padding: '9px 10px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      fontSize: 14,
      width: '100%',
      boxSizing: 'border-box',
      background: 'var(--bg-input, var(--bg-card))',
      color: 'var(--text-primary)',
    }),
    [],
  );

  const btnPrimary = {
    padding: '9px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };

  const btnGhost = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };

  useEffect(() => {
    if (!esAdminClub) return;
    setSedeId(String(clubSedeId || ''));
  }, [esAdminClub, clubSedeId]);

  const effectiveSedeId = esAdminClub && fixedSedeId ? fixedSedeId : String(sedeId || '');

  // Debounce búsqueda (300–500 ms); 1 carácter no se envía al Backend.
  useEffect(() => {
    const raw = String(jugadorFilter || '').trim().replace(/\s+/g, ' ');
    const t = window.setTimeout(() => {
      const next = raw.length >= MEMBRESIAS_Q_MIN ? raw : '';
      setSearchQuery((prev) => {
        if (prev === next) return prev;
        setPage(1);
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [jugadorFilter]);

  const loadPlanes = useCallback(async ({ signal } = {}) => {
    if (!canUse || !accessToken || !effectiveSedeId) {
      setPlanes([]);
      return;
    }
    const rows = await fetchMembresiaPlanes({
      apiBaseUrl,
      accessToken,
      sedeId: effectiveSedeId,
      includeInactive: true,
      signal,
    });
    setPlanes(rows);
  }, [accessToken, apiBaseUrl, canUse, effectiveSedeId]);

  const loadMembresiasPage = useCallback(async ({ soft = false } = {}) => {
    if (!canUse || !accessToken) return;
    if (!effectiveSedeId) {
      setMembresias([]);
      setTotal(0);
      setTotalPages(0);
      setHasNext(false);
      setHasPrevious(false);
      setError('');
      return;
    }

    try {
      membresiasAbortRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    membresiasAbortRef.current = ac;
    const seq = ++membresiasSeqRef.current;

    if (soft || initialMembresiasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const result = await fetchAdminMembresias({
        apiBaseUrl,
        accessToken,
        sedeId: effectiveSedeId,
        estado: estadoFilter || '',
        planId: planFilter || '',
        q: searchQuery || '',
        page,
        limit,
        sort,
        direction,
        signal: ac?.signal,
      });
      if (seq !== membresiasSeqRef.current) return;

      const pag = result.pagination;
      if (pag.page > 1 && pag.total_pages > 0 && pag.page > pag.total_pages) {
        setPage(pag.total_pages);
        return;
      }
      if (result.membresias.length === 0 && page > 1 && pag.total > 0 && pag.total_pages >= 1) {
        setPage(pag.total_pages);
        return;
      }

      setMembresias(result.membresias);
      setTotal(pag.total);
      setTotalPages(pag.total_pages);
      setHasNext(Boolean(pag.has_next));
      setHasPrevious(Boolean(pag.has_previous));
      initialMembresiasLoadedRef.current = true;
    } catch (err) {
      if (seq !== membresiasSeqRef.current) return;
      if (err?.name === 'AbortError') return;
      setError(err?.message || String(err));
      // Conservar datos previos.
    } finally {
      if (seq === membresiasSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    accessToken,
    apiBaseUrl,
    canUse,
    direction,
    effectiveSedeId,
    estadoFilter,
    limit,
    page,
    planFilter,
    searchQuery,
    sort,
  ]);

  // Carga planes al cambiar sede.
  useEffect(() => {
    if (!canUse || !accessToken || !effectiveSedeId) {
      setPlanes([]);
      return undefined;
    }
    let cancelled = false;
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    (async () => {
      try {
        setLoading(true);
        await loadPlanes({ signal: ac?.signal });
      } catch (err) {
        if (!cancelled && err?.name !== 'AbortError') {
          setError(err?.message || String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      try {
        ac?.abort();
      } catch {
        /* ignore */
      }
    };
  }, [accessToken, canUse, effectiveSedeId, loadPlanes]);

  // Listado paginado server-side.
  useEffect(() => {
    void loadMembresiasPage({ soft: initialMembresiasLoadedRef.current });
    return () => {
      try {
        membresiasAbortRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    };
  }, [loadMembresiasPage]);

  // Reset página al cambiar filtros de sede / estado / plan / orden (búsqueda ya resetea en debounce).
  useEffect(() => {
    setPage(1);
    initialMembresiasLoadedRef.current = false;
  }, [effectiveSedeId]);

  const onEstadoFilterChange = (value) => {
    setEstadoFilter(value);
    setPage(1);
  };
  const onPlanFilterChange = (value) => {
    setPlanFilter(value);
    setPage(1);
  };
  const onSortChange = (value) => {
    setSort(normalizeMembresiasSort(value));
    setPage(1);
  };
  const onDirectionChange = (value) => {
    setDirection(normalizeMembresiasDirection(value));
    setPage(1);
  };

  const refreshAll = useCallback(async () => {
    setOkMsg('');
    try {
      setLoading(true);
      await loadPlanes();
      await loadMembresiasPage({ soft: false });
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [loadMembresiasPage, loadPlanes]);

  const planesActivos = useMemo(() => planes.filter((p) => p.activo !== false), [planes]);

  const assignPlan = useMemo(
    () => planes.find((p) => String(p.id) === String(assignPlanId)) || null,
    [planes, assignPlanId],
  );

  const assignVencimientoPreview = useMemo(() => {
    if (!assignPlan || !assignInicio) return null;
    return computeVencimientoFromPlan(`${assignInicio}T00:00:00.000Z`, assignPlan);
  }, [assignPlan, assignInicio]);

  const hasActivaSameUser = useMemo(() => {
    if (!assignPlayer?.id && !assignPlayer?.user_id) return false;
    const uid = String(assignPlayer.id || assignPlayer.user_id);
    return membresias.some(
      (m) => String(m.user_id) === uid && String(m.estado) === 'activa',
    );
  }, [assignPlayer, membresias]);

  const sedeNombre = useCallback(
    (sid) => {
      const hit = (sedesOptions || []).find((s) => String(s.id) === String(sid));
      if (!hit) return sid ? `#${sid}` : '—';
      const flag = sedeFlag(hit);
      return `${flag ? `${flag} ` : ''}${hit.nombre || `#${sid}`}`;
    },
    [sedesOptions, sedeFlag],
  );

  const jugadorLabel = (m) => resolveMembresiaJugadorLabel(m);

  const openCreatePlan = () => {
    setPlanEditId(null);
    setPlanForm(emptyPlanForm(effectiveSedeId));
    setPlanFormError('');
    setPlanFormOpen(true);
  };

  const openEditPlan = (plan) => {
    setPlanEditId(plan.id);
    setPlanForm(planToForm(plan, effectiveSedeId));
    setPlanFormError('');
    setPlanFormOpen(true);
  };

  const planErrorMessage = (key) => {
    const map = {
      nameRequired: tr('errNameRequired', 'El nombre es obligatorio.'),
      sedeRequired: tr('errSedeRequired', 'Seleccioná una sede.'),
      precioInvalid: tr('errPrecio', 'El precio debe ser un número ≥ 0.'),
      duracionInvalid: tr('errDuracion', 'Duración inválida.'),
      duracionDiasInvalid: tr('errDuracionDias', 'Indicá días válidos (≥ 1) para duración personalizada.'),
      descuentoInvalid: tr('errDescuento', 'El descuento debe estar entre 0 y 100.'),
      reservasInvalid: tr('errReservas', 'Reservas incluidas: entero ≥ 0.'),
      prioridadInvalid: tr('errPrioridad', 'Prioridad (horas) inválida.'),
      cancelacionInvalid: tr('errCancelacion', 'Flexibilidad de cancelación inválida.'),
      cupoInvalid: tr('errCupo', 'Cupo debe ser un entero ≥ 1 o vacío.'),
    };
    return map[key] || tr('errGeneric', 'Revisá el formulario.');
  };

  const savePlan = async () => {
    if (planSaving) return;
    const mode = planEditId ? 'update' : 'create';
    const computedEnd = planForm.vigencia_desde
      ? computeVencimientoFromPlan(`${planForm.vigencia_desde}T00:00:00.000Z`, planForm)
      : null;
    const formWithSede = {
      ...planForm,
      sede_id: planForm.sede_id || effectiveSedeId,
      vigencia_hasta: computedEnd ? String(computedEnd).slice(0, 10) : '',
    };
    const built = validateAndBuildPlanPayload(formWithSede, { mode });
    if (!built.ok) {
      setPlanFormError(planErrorMessage(built.errorKey));
      return;
    }
    setPlanSaving(true);
    setPlanFormError('');
    setOkMsg('');
    try {
      if (planEditId) {
        await updateMembresiaPlan({
          apiBaseUrl,
          accessToken,
          planId: planEditId,
          body: built.body,
        });
        setOkMsg(tr('planUpdated', 'Plan actualizado.'));
      } else {
        await createMembresiaPlan({
          apiBaseUrl,
          accessToken,
          body: built.body,
        });
        setOkMsg(tr('planCreated', 'Plan creado.'));
      }
      setPlanFormOpen(false);
      await loadPlanes();
    } catch (err) {
      setPlanFormError(err?.message || String(err));
    } finally {
      setPlanSaving(false);
    }
  };

  const togglePlanActivo = async (plan) => {
    setConfirmAction({
      type: 'toggle_plan',
      plan,
      title: plan.activo === false
        ? tr('confirmActivatePlanTitle', 'Activar plan')
        : tr('confirmDeactivatePlanTitle', 'Desactivar plan'),
      message: plan.activo === false
        ? tr('confirmActivatePlanMsg', '¿Activar el plan "{{name}}"?', { name: plan.nombre })
        : tr('confirmDeactivatePlanMsg', '¿Desactivar el plan "{{name}}"? No se podrá asignar hasta reactivarlo.', { name: plan.nombre }),
    });
  };

  const openAssign = () => {
    setAssignPlayer(null);
    setAssignPlanId(planesActivos[0]?.id != null ? String(planesActivos[0].id) : '');
    setAssignInicio(new Date().toISOString().slice(0, 10));
    setAssignOrigen('manual');
    setAssignNotas('');
    setAssignError('');
    setAssignOpen(true);
  };

  const requestAssign = () => {
    setAssignError('');
    if (!assignPlayer?.id && !assignPlayer?.user_id) {
      setAssignError(tr('errPlayerRequired', 'Seleccioná un jugador registrado.'));
      return;
    }
    if (!assignPlanId) {
      setAssignError(tr('errPlanRequired', 'Seleccioná un plan.'));
      return;
    }
    if (!assignInicio) {
      setAssignError(tr('errInicioRequired', 'Indicá fecha de inicio.'));
      return;
    }
    setAssignConfirmOpen(true);
  };

  const executeAssign = async () => {
    if (assignBusy) return;
    setAssignBusy(true);
    setAssignError('');
    try {
      const uid = String(assignPlayer.id || assignPlayer.user_id);
      const body = {
        sede_id: Number(effectiveSedeId),
        plan_id: Number(assignPlanId),
        user_id: uid,
        email: assignPlayer.email || null,
        origen: assignOrigen,
        inicio: `${assignInicio}T00:00:00.000Z`,
        vencimiento: assignVencimientoPreview || undefined,
        notas: assignNotas.trim() || null,
      };
      await asignarMembresia({ apiBaseUrl, accessToken, body });
      setAssignConfirmOpen(false);
      setAssignOpen(false);
      setOkMsg(tr('assignOk', 'Membresía asignada.'));
      await loadMembresiasPage({ soft: true });
    } catch (err) {
      setAssignConfirmOpen(false);
      setAssignError(err?.message || String(err));
    } finally {
      setAssignBusy(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction || actionBusy) return;
    const actionType = confirmAction.type;
    setActionBusy(true);
    setError('');
    setOkMsg('');
    try {
      if (actionType === 'toggle_plan') {
        await updateMembresiaPlan({
          apiBaseUrl,
          accessToken,
          planId: confirmAction.plan.id,
          body: { activo: confirmAction.plan.activo === false },
        });
        setOkMsg(
          confirmAction.plan.activo === false
            ? tr('planActivated', 'Plan activado.')
            : tr('planDeactivated', 'Plan desactivado.'),
        );
      } else if (actionType === 'renovar') {
        await renovarMembresia({ apiBaseUrl, accessToken, id: confirmAction.row.id });
        setOkMsg(tr('renewedOk', 'Membresía renovada.'));
      } else if (actionType === 'suspender') {
        await suspenderMembresia({ apiBaseUrl, accessToken, id: confirmAction.row.id });
        setOkMsg(tr('suspendedOk', 'Membresía suspendida.'));
      } else if (actionType === 'cancelar') {
        await cancelarMembresia({ apiBaseUrl, accessToken, id: confirmAction.row.id });
        setOkMsg(tr('cancelledOk', 'Membresía cancelada.'));
      }
      setConfirmAction(null);
      setDetailRow(null);
      if (actionType === 'toggle_plan') {
        await loadPlanes();
      } else {
        await loadMembresiasPage({ soft: true });
      }
    } catch (err) {
      setError(err?.message || String(err));
      setConfirmAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  const askAction = (type, row) => {
    const titles = {
      renovar: tr('confirmRenewTitle', 'Renovar membresía'),
      suspender: tr('confirmSuspendTitle', 'Suspender membresía'),
      cancelar: tr('confirmCancelTitle', 'Cancelar membresía'),
    };
    const msgs = {
      renovar: tr('confirmRenewMsg'),
      suspender: tr('confirmSuspendMsg', 'El jugador dejará de recibir beneficios hasta una nueva asignación. ¿Suspender?'),
      cancelar: tr('confirmCancelMsg', 'La membresía quedará cancelada (estado final). Para reactivar, asigná una nueva. ¿Cancelar?'),
    };
    setConfirmAction({ type, row, title: titles[type], message: msgs[type] });
  };

  if (!canUse) {
    return (
      <div className="section">
        <p style={{ color: 'var(--text-secondary)' }}>{tr('forbiddenRole', 'No tenés permiso para gestionar membresías.')}</p>
      </div>
    );
  }

  return (
    <div className="section" data-admin-membresias>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>{tr('title', 'Membresías')}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.45, maxWidth: 640 }}>
            {tr('subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          style={btnGhost}
          disabled={loading || refreshing}
        >
          {loading || refreshing ? tr('loading', 'Cargando…') : tr('refresh', 'Actualizar')}
        </button>
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg-page)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.45,
          marginBottom: 16,
        }}
      >
        {tr('billingNote')}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {isSuperAdmin ? (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
            {tr('sedeLabel', 'Sede')}
            <select
              value={effectiveSedeId}
              onChange={(e) => setSedeId(e.target.value)}
              style={inp}
            >
              <option value="">{tr('sedeSelect', 'Seleccioná una sede')}</option>
              {(sedesOptions || []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {sedeFlag(s) ? `${sedeFlag(s)} ` : ''}
                  {s.nombre || s.id}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr('sedeLabel', 'Sede')}</div>
            <div style={{ color: 'var(--text-primary)' }}>{sedeNombre(effectiveSedeId)}</div>
          </div>
        )}
      </div>

      {!effectiveSedeId ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {tr('needSede', 'Seleccioná una sede para ver planes y membresías.')}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { id: 'planes', label: tr('tabPlanes', 'Planes') },
              { id: 'asignadas', label: tr('tabAsignadas', 'Membresías asignadas') },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                style={{
                  ...btnGhost,
                  background: subTab === tab.id ? 'var(--accent)' : 'var(--bg-card)',
                  color: subTab === tab.id ? '#fff' : 'var(--text-primary)',
                  borderColor: subTab === tab.id ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
              {error}{' '}
              <button
                type="button"
                style={{ ...btnGhost, padding: '2px 8px', fontSize: 12 }}
                onClick={() => void loadMembresiasPage({ soft: true })}
                disabled={refreshing || loading}
              >
                {tr('retry', 'Reintentar')}
              </button>
            </p>
          ) : null}
          {okMsg ? (
            <p style={{ color: '#166534', fontWeight: 600, fontSize: 13 }}>{okMsg}</p>
          ) : null}

          {loading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{tr('loading', 'Cargando…')}</p>
          ) : null}

          {subTab === 'planes' && !loading ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={btnPrimary} onClick={openCreatePlan}>
                  + {tr('newPlan', 'Nuevo plan')}
                </button>
              </div>
              {planes.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  {tr('emptyPlanes', 'No hay planes de membresía para esta sede.')}
                </p>
              ) : (
                <ScrollTable minWidth={980}>
                  <thead>
                    <tr>
                      <th style={thStyle()}>{tr('colNombre', 'Nombre')}</th>
                      <th style={thStyle()}>{tr('colDescripcion', 'Descripción')}</th>
                      <th style={thStyle()}>{tr('colPrecio', 'Precio')}</th>
                      <th style={thStyle()}>{tr('colDuracion', 'Duración')}</th>
                      <th style={thStyle()}>{tr('colActivo', 'Activo')}</th>
                      <th style={thStyle()}>{tr('colCupo', 'Cupo')}</th>
                      <th style={thStyle()}>{tr('colVigencia', 'Vigencia')}</th>
                      <th style={thStyle()}>{tr('colActivos', 'Miembros activos')}</th>
                      <th style={thStyle()}>{tr('colBeneficios', 'Beneficios')}</th>
                      <th style={thStyle()}>{tr('colAcciones', 'Acciones')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planes.map((p) => {
                      const b = p.beneficios || {};
                      const durLabel =
                        MEMBRESIA_DURACION_TIPOS.find((d) => d.id === p.duracion_tipo)?.label ||
                        p.duracion_tipo;
                      const dur =
                        p.duracion_tipo === 'dias'
                          ? `${p.duracion_dias || '—'} ${tr('days', 'días')}`
                          : durLabel;
                      return (
                        <tr key={p.id}>
                          <td style={tdStyle({ fontWeight: 700 })}>{p.nombre}</td>
                          <td style={tdStyle({ maxWidth: 180, whiteSpace: 'normal' })}>
                            {p.descripcion || '—'}
                          </td>
                          <td style={tdStyle({ whiteSpace: 'nowrap' })}>
                            {formatMembresiaPrecio(p.precio, p.moneda)}
                          </td>
                          <td style={tdStyle()}>{dur}</td>
                          <td style={tdStyle()}>
                            {p.activo !== false ? tr('yes', 'Sí') : tr('no', 'No')}
                          </td>
                          <td style={tdStyle()}>{p.cupo != null ? p.cupo : '—'}</td>
                          <td style={tdStyle({ whiteSpace: 'nowrap' })}>
                            {formatMembresiaFecha(p.vigencia_desde)} → {formatMembresiaFecha(p.vigencia_hasta)}
                          </td>
                          <td style={tdStyle()}>—</td>
                          <td style={tdStyle({ whiteSpace: 'normal', minWidth: 140 })}>
                            <div>{tr('benefitDiscount', 'Descuento')}: {b.descuento_porcentual ?? 0}%</div>
                            <div>
                              {tr('benefitReservas', 'Reservas incl.')}: {b.reservas_incluidas_por_periodo ?? 0}
                            </div>
                            {(b.prioridad_horas > 0 || b.cancelacion_horas_extra > 0) ? (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                {tr('benefitInfoOnly', 'Prioridad / cancelación: informativos')}
                              </div>
                            ) : null}
                          </td>
                          <td style={tdStyle({ whiteSpace: 'nowrap' })}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button type="button" style={btnGhost} onClick={() => openEditPlan(p)}>
                                {tr('edit', 'Editar')}
                              </button>
                              <button type="button" style={btnGhost} onClick={() => void togglePlanActivo(p)}>
                                {p.activo === false ? tr('activate', 'Activar') : tr('deactivate', 'Desactivar')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </ScrollTable>
              )}
            </div>
          ) : null}

          {subTab === 'asignadas' ? (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  {tr('filterPlan', 'Plan')}
                  <select
                    value={planFilter}
                    onChange={(e) => onPlanFilterChange(e.target.value)}
                    style={inp}
                  >
                    <option value="">{tr('all', 'Todos')}</option>
                    {planes.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.nombre}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  {tr('filterEstado', 'Estado')}
                  <select
                    value={estadoFilter}
                    onChange={(e) => onEstadoFilterChange(e.target.value)}
                    style={inp}
                  >
                    {MEMBRESIA_ESTADOS.map((e) => (
                      <option key={e.id || 'all'} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  {tr('filterJugador', 'Jugador')}
                  <input
                    value={jugadorFilter}
                    onChange={(e) => setJugadorFilter(e.target.value)}
                    placeholder={tr('filterJugadorPh', 'Nombre, @usuario, email…')}
                    style={inp}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  {tr('sortLabel', 'Orden')}
                  <select value={sort} onChange={(e) => onSortChange(e.target.value)} style={inp}>
                    {MEMBRESIAS_SORT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  {tr('directionLabel', 'Dirección')}
                  <select
                    value={direction}
                    onChange={(e) => onDirectionChange(e.target.value)}
                    style={inp}
                  >
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                </label>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" style={btnPrimary} onClick={openAssign} disabled={!planesActivos.length}>
                    + {tr('assign', 'Asignar membresía')}
                  </button>
                </div>
              </div>

              {refreshing ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 8px' }}>
                  {tr('refreshing', 'Actualizando…')}
                </p>
              ) : null}

              {membresias.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  {tr('emptyMembresias', 'No hay membresías con estos filtros.')}
                </p>
              ) : (
                <>
                  <ScrollTable minWidth={1040}>
                    <thead>
                      <tr>
                        <th style={thStyle()}>{tr('colJugador', 'Jugador')}</th>
                        <th style={thStyle()}>{tr('colSede', 'Sede')}</th>
                        <th style={thStyle()}>{tr('colPlan', 'Plan')}</th>
                        <th style={thStyle()}>{tr('colEstado', 'Estado')}</th>
                        <th style={thStyle()}>{tr('colOrigen', 'Origen')}</th>
                        <th style={thStyle()}>{tr('colInicio', 'Inicio')}</th>
                        <th style={thStyle()}>{tr('colVencimiento', 'Vencimiento')}</th>
                        <th style={thStyle()}>{tr('colRenovacion', 'Renovación')}</th>
                        <th style={thStyle()}>{tr('colNotas', 'Notas')}</th>
                        <th style={thStyle()}>{tr('colAcciones', 'Acciones')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membresias.map((m) => {
                        const actions = accionesDisponiblesParaEstado(m.estado);
                        const badge = estadoBadgeStyle(m.estado);
                        return (
                          <tr key={m.id}>
                            <td style={tdStyle({ maxWidth: 200, whiteSpace: 'normal' })}>{jugadorLabel(m)}</td>
                            <td style={tdStyle()}>{sedeNombre(m.sede_id)}</td>
                            <td style={tdStyle()}>{m.plan?.nombre || `#${m.plan_id}`}</td>
                            <td style={tdStyle()}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: badge.bg,
                                  color: badge.color,
                                  textTransform: 'capitalize',
                                }}
                              >
                                {m.estado}
                              </span>
                            </td>
                            <td style={tdStyle({ textTransform: 'capitalize' })}>{m.origen || '—'}</td>
                            <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatMembresiaFecha(m.inicio)}</td>
                            <td style={tdStyle({ whiteSpace: 'nowrap' })}>{formatMembresiaFecha(m.vencimiento)}</td>
                            <td style={tdStyle()}>
                              {m.renovacion_automatica ? tr('yes', 'Sí') : tr('no', 'No')}
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {tr('autoRenewInfo', '(sin cobro aún)')}
                              </div>
                            </td>
                            <td style={tdStyle({ maxWidth: 140, whiteSpace: 'normal' })}>{m.notas || '—'}</td>
                            <td style={tdStyle({ whiteSpace: 'nowrap' })}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button type="button" style={btnGhost} onClick={() => setDetailRow(m)}>
                                  {tr('detail', 'Detalle')}
                                </button>
                                {actions.includes('renovar') ? (
                                  <button type="button" style={btnGhost} onClick={() => askAction('renovar', m)}>
                                    {tr('renew', 'Renovar')}
                                  </button>
                                ) : null}
                                {actions.includes('suspender') ? (
                                  <button type="button" style={btnGhost} onClick={() => askAction('suspender', m)}>
                                    {tr('suspend', 'Suspender')}
                                  </button>
                                ) : null}
                                {actions.includes('cancelar') ? (
                                  <button type="button" style={btnGhost} onClick={() => askAction('cancelar', m)}>
                                    {tr('cancel', 'Cancelar')}
                                  </button>
                                ) : null}
                                {actions.length === 0 ? (
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {tr('noActions', 'Sin acciones — asigná una nueva')}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </ScrollTable>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      marginTop: 12,
                      flexWrap: 'wrap',
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {tr('pageOf', 'Página {{page}} / {{total}} ({{count}})', {
                        page: totalPages === 0 ? 0 : page,
                        total: totalPages,
                        count: total,
                      })}
                    </span>
                    <button
                      type="button"
                      style={btnGhost}
                      disabled={!hasPrevious || refreshing}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {tr('prev', 'Anterior')}
                    </button>
                    <button
                      type="button"
                      style={btnGhost}
                      disabled={!hasNext || refreshing}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {tr('next', 'Siguiente')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* Plan form modal */}
      {planFormOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99990,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => (!planSaving ? setPlanFormOpen(false) : null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 18,
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary, #f8fafc)', WebkitTextFillColor: 'var(--text-primary, #f8fafc)' }}>
              {planEditId ? tr('editPlan', 'Editar plan') : tr('newPlan', 'Nuevo plan')}
            </h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {tr('fieldNombre', 'Nombre')}
                <input
                  style={inp}
                  value={planForm.nombre}
                  onChange={(e) => setPlanForm((p) => ({ ...p, nombre: e.target.value }))}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {tr('fieldDescripcion', 'Descripción')}
                <textarea
                  style={{ ...inp, minHeight: 64, resize: 'vertical' }}
                  value={planForm.descripcion}
                  onChange={(e) => setPlanForm((p) => ({ ...p, descripcion: e.target.value }))}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {tr('fieldPrecio', 'Precio')}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    style={inp}
                    value={planForm.precio}
                    onChange={(e) => setPlanForm((p) => ({ ...p, precio: e.target.value }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {tr('fieldMoneda', 'Moneda')}
                  <select
                    style={inp}
                    value={planForm.moneda}
                    onChange={(e) => setPlanForm((p) => ({ ...p, moneda: e.target.value }))}
                  >
                    {MEMBRESIA_MONEDAS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {tr('fieldDuracion', 'Duración')}
                  <select
                    style={inp}
                    value={planForm.duracion_tipo}
                    onChange={(e) => setPlanForm((p) => ({ ...p, duracion_tipo: e.target.value }))}
                  >
                    {MEMBRESIA_DURACION_TIPOS.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </label>
                {planForm.duracion_tipo === 'dias' ? (
                  <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {tr('fieldDias', 'Días')}
                    <input
                      type="number"
                      min="1"
                      style={inp}
                      value={planForm.duracion_dias}
                      onChange={(e) => setPlanForm((p) => ({ ...p, duracion_dias: e.target.value }))}
                    />
                  </label>
                ) : (
                  <div />
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={planForm.activo !== false}
                    onChange={(e) => setPlanForm((p) => ({ ...p, activo: e.target.checked }))}
                  />
                  {tr('fieldActivo', 'Activo')}
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {tr('fieldCupo', 'Cupo (opcional)')}
                  <input
                    type="number"
                    min="1"
                    style={inp}
                    value={planForm.cupo}
                    onChange={(e) => setPlanForm((p) => ({ ...p, cupo: e.target.value }))}
                    placeholder="—"
                  />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {tr('fieldVigenciaDesde', 'Vigencia desde')}
                  <input
                    type="date"
                    style={inp}
                    value={planForm.vigencia_desde}
                    onChange={(e) => setPlanForm((p) => ({ ...p, vigencia_desde: e.target.value }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {tr('fieldVigenciaHasta', 'Valid until (calculated automatically)')}
                  <input
                    type="date"
                    style={inp}
                    value={planForm.vigencia_desde
                      ? String(computeVencimientoFromPlan(`${planForm.vigencia_desde}T00:00:00.000Z`, planForm) || '').slice(0, 10)
                      : ''}
                    readOnly
                    aria-readonly="true"
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                    {tr('fieldVigenciaHastaHint', 'Calculated from the start date and selected duration.')}
                  </span>
                </label>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(planForm.renovacion_automatica)}
                  onChange={(e) => setPlanForm((p) => ({ ...p, renovacion_automatica: e.target.checked }))}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <strong>{tr('fieldRenovAuto', 'Renovación automática')}</strong>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12 }}>
                    {tr('fieldRenovAutoHint')}
                  </span>
                </span>
              </label>

              <fieldset style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, margin: 0 }}>
                <legend style={{ fontWeight: 700, fontSize: 13, padding: '0 6px' }}>
                  {tr('benefitsTitle', 'Beneficios')}
                </legend>
                <div style={{ display: 'grid', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {tr('fieldDescuento', 'Descuento % (aplicado en reservas)')}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      style={inp}
                      value={planForm.descuento_porcentual}
                      onChange={(e) => setPlanForm((p) => ({ ...p, descuento_porcentual: e.target.value }))}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {tr('fieldReservasIncl', 'Reservas incluidas por período (aplicadas)')}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      style={inp}
                      value={planForm.reservas_incluidas_por_periodo}
                      onChange={(e) => setPlanForm((p) => ({ ...p, reservas_incluidas_por_periodo: e.target.value }))}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {tr('fieldPrioridad', 'Prioridad de reserva (horas, informativo)')}
                    <input
                      type="number"
                      min="0"
                      style={inp}
                      value={planForm.prioridad_horas}
                      onChange={(e) => setPlanForm((p) => ({ ...p, prioridad_horas: e.target.value }))}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {tr('fieldCancelFlex', 'Flexibilidad de cancelación (horas, informativo)')}
                    <input
                      type="number"
                      min="0"
                      style={inp}
                      value={planForm.cancelacion_horas_extra}
                      onChange={(e) => setPlanForm((p) => ({ ...p, cancelacion_horas_extra: e.target.value }))}
                    />
                  </label>
                </div>
              </fieldset>

              {planFormError ? (
                <p role="alert" style={{ color: 'var(--accent)', margin: 0, fontSize: 13 }}>{planFormError}</p>
              ) : null}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" style={btnGhost} disabled={planSaving} onClick={() => setPlanFormOpen(false)}>
                  {tr('close', 'Cerrar')}
                </button>
                <button type="button" style={btnPrimary} disabled={planSaving} onClick={() => void savePlan()}>
                  {planSaving ? tr('saving', 'Guardando…') : tr('save', 'Guardar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Assign modal */}
      {assignOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99990,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => (!assignBusy ? setAssignOpen(false) : null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 18,
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 12px' }}>{tr('assign', 'Asignar membresía')}</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {tr('fieldJugador', 'Jugador')}
                </div>
                <AdminJugadorSearchInput
                  apiBaseUrl={apiBaseUrl}
                  accessToken={accessToken}
                  sedeId={effectiveSedeId}
                  selectedPlayer={assignPlayer}
                  onSelectPlayer={setAssignPlayer}
                  onClearPlayer={() => setAssignPlayer(null)}
                  onNombreChange={() => {}}
                />
              </div>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {tr('fieldPlan', 'Plan')}
                <select
                  style={inp}
                  value={assignPlanId}
                  onChange={(e) => setAssignPlanId(e.target.value)}
                >
                  <option value="">{tr('selectPlan', 'Seleccioná un plan')}</option>
                  {planesActivos.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nombre} — {formatMembresiaPrecio(p.precio, p.moneda)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {tr('fieldInicio', 'Fecha de inicio')}
                <input
                  type="date"
                  style={inp}
                  value={assignInicio}
                  onChange={(e) => setAssignInicio(e.target.value)}
                />
              </label>
              <div style={{ fontSize: 13 }}>
                <strong>{tr('fieldVencimiento', 'Vencimiento')}</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                  {assignVencimientoPreview
                    ? formatMembresiaFecha(assignVencimientoPreview)
                    : tr('vencimientoHint', 'Se calcula según la duración del plan.')}
                </div>
              </div>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {tr('fieldOrigen', 'Origen')}
                <select
                  style={inp}
                  value={assignOrigen}
                  onChange={(e) => setAssignOrigen(e.target.value)}
                >
                  {MEMBRESIA_ORIGENES.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {tr('fieldNotas', 'Notas (opcional)')}
                <textarea
                  style={{ ...inp, minHeight: 60, resize: 'vertical' }}
                  value={assignNotas}
                  onChange={(e) => setAssignNotas(e.target.value)}
                />
              </label>
              {hasActivaSameUser ? (
                <p style={{ margin: 0, fontSize: 12, color: '#9a3412', lineHeight: 1.45 }}>
                  {tr('replaceWarning')}
                </p>
              ) : null}
              {assignError ? (
                <p role="alert" style={{ color: 'var(--accent)', margin: 0, fontSize: 13 }}>{assignError}</p>
              ) : null}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" style={btnGhost} disabled={assignBusy} onClick={() => setAssignOpen(false)}>
                  {tr('close', 'Cerrar')}
                </button>
                <button type="button" style={btnPrimary} disabled={assignBusy} onClick={requestAssign}>
                  {tr('continue', 'Continuar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Detail drawer */}
      {detailRow ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99980,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setDetailRow(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              height: '100%',
              background: 'var(--bg-card)',
              borderLeft: '1px solid var(--border)',
              padding: 18,
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ marginTop: 0 }}>{tr('detailTitle', 'Detalle de membresía')}</h3>
            <dl style={{ display: 'grid', gap: 10, margin: '0 0 16px', fontSize: 13 }}>
              <div>
                <dt style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{tr('colJugador', 'Jugador')}</dt>
                <dd style={{ margin: '2px 0 0' }}>{jugadorLabel(detailRow)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{tr('colPlan', 'Plan')}</dt>
                <dd style={{ margin: '2px 0 0' }}>{detailRow.plan?.nombre || detailRow.plan_id}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{tr('colEstado', 'Estado')}</dt>
                <dd style={{ margin: '2px 0 0', textTransform: 'capitalize' }}>{detailRow.estado}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{tr('colInicio', 'Inicio')}</dt>
                <dd style={{ margin: '2px 0 0' }}>{formatMembresiaFecha(detailRow.inicio)}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{tr('colVencimiento', 'Vencimiento')}</dt>
                <dd style={{ margin: '2px 0 0' }}>{formatMembresiaFecha(detailRow.vencimiento)}</dd>
              </div>
            </dl>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{tr('benefitsApplied', 'Beneficios')}</h4>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
              <li>
                {tr('benefitDiscount', 'Descuento')}: {detailRow.plan?.beneficios?.descuento_porcentual ?? 0}%
                {' '}({tr('appliedAuto', 'se aplica automáticamente')})
              </li>
              <li>
                {tr('benefitReservas', 'Reservas incl.')}: {detailRow.plan?.beneficios?.reservas_incluidas_por_periodo ?? 0}
                {' '}({tr('appliedAuto', 'se aplica automáticamente')})
              </li>
              <li>
                {tr('benefitPrioridad', 'Prioridad')}: {detailRow.plan?.beneficios?.prioridad_horas ?? 0} h
                {' '}({tr('infoOnly', 'informativo')})
              </li>
              <li>
                {tr('benefitCancel', 'Cancelación extra')}: {detailRow.plan?.beneficios?.cancelacion_horas_extra ?? 0} h
                {' '}({tr('infoOnly', 'informativo')})
              </li>
            </ul>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {tr('billingNoteShort')}
            </p>
            <button type="button" style={{ ...btnGhost, marginTop: 12 }} onClick={() => setDetailRow(null)}>
              {tr('close', 'Cerrar')}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        busy={actionBusy}
        confirmDanger={confirmAction?.type === 'cancelar' || confirmAction?.type === 'suspender'}
        onConfirm={() => void runConfirmedAction()}
        onDismiss={() => (!actionBusy ? setConfirmAction(null) : null)}
      />

      <ConfirmModal
        open={assignConfirmOpen}
        title={tr('confirmAssignTitle', 'Confirmar asignación')}
        message={
          hasActivaSameUser
            ? tr('confirmAssignReplace')
            : tr('confirmAssignMsg', '¿Asignar esta membresía al jugador seleccionado?')
        }
        busy={assignBusy}
        onConfirm={() => void executeAssign()}
        onDismiss={() => (!assignBusy ? setAssignConfirmOpen(false) : null)}
      />
    </div>
  );
}
