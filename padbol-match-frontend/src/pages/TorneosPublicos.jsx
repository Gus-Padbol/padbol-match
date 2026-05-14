import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import HubSponsorsTicker from '../components/HubSponsorsTicker';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { useHubSponsors } from '../hooks/useHubSponsors';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import {
  formatNivelTorneo,
  formatTipoTorneo,
  formatGeneroCompetenciaTorneo,
  formatCategoriaEdadTorneo,
  torneoTipoCompetenciaDb,
} from '../utils/torneoFormatters';
import { compareTorneosPublico } from '../utils/torneoOrdenPublico';
import { badgeTorneoEstadoPublico } from '../utils/torneoEstadoPublico';
import {
  FILTROS_ESTADO_TORNEO_PILLS,
  torneoPasaFiltroEstadoVista,
  esEstadoFinalizadoTorneo,
} from '../utils/torneoEstadoFiltroPills';
import { torneoFechaInicioEsPasadaCalendario } from '../utils/torneoFechaInicioArt';
import { getDistanceKm } from '../utils/sedeCardUi';
import { IconGeroFiltros, IconGeroUbicacion } from '../components/icons/GeroIcons';
import {
  etiquetaDeporteTorneo,
  normalizeTorneoDeporte,
  TORNEO_DEPORTE_PADBOL,
  TORNEO_DEPORTE_OPTIONS,
  etiquetaFormatoEquipoResuelto,
} from '../utils/torneoDeporteFormato';

function formatoEquipoLineaTorneoPublico(t) {
  return etiquetaFormatoEquipoResuelto(t);
}

const FILTROS_DEPORTE_TORNEO_PUBLICO = [
  { id: 'todos', label: 'Todos' },
  ...TORNEO_DEPORTE_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
];

function closestSedeId(userPos, sedesList) {
  let bestId = null;
  let bestKm = Infinity;
  for (const s of sedesList) {
    if (s.latitud == null || s.longitud == null) continue;
    const km = getDistanceKm(userPos.lat, userPos.lon, s.latitud, s.longitud);
    if (km < bestKm) {
      bestKm = km;
      bestId = s.id;
    }
  }
  return bestId;
}

function formatFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${y}`;
}

function Row({ icon, label }) {
  const iconIsEl = React.isValidElement(icon);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
      <span
        style={{
          flexShrink: 0,
          width: iconIsEl ? 20 : 18,
          minHeight: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: 'inherit',
        }}
      >
        {icon}
      </span>
      <span style={{ lineHeight: 1.4 }}>{label}</span>
    </div>
  );
}

function normalizeSearchText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function badgeEstadoTorneoListado(t) {
  if (torneoFechaInicioEsPasadaCalendario(t?.fecha_inicio) || esEstadoFinalizadoTorneo(t?.estado)) {
    return { label: 'Finalizado', bg: '#dc2626', color: '#fff' };
  }
  const b = badgeTorneoEstadoPublico(t.estado);
  if (b) return b;
  return {
    label: t.estado ? String(t.estado) : 'Sin estado',
    bg: '#94a3b8',
    color: '#fff',
  };
}

export default function TorneosPublicos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { sedeId: hubSedeId, pais: hubPaisUsuario } = useUserRole(currentCliente);
  const { tickerSponsors } = useHubSponsors({
    sedeId: hubSedeId != null && Number.isFinite(Number(hubSedeId)) ? Number(hubSedeId) : null,
    pais: String(hubPaisUsuario || '').trim(),
    enabled: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const nearMode = searchParams.get('context') === 'near';

  const sedeFiltroId = useMemo(() => {
    const r = searchParams.get('sedeId');
    if (r == null || String(r).trim() === '') return null;
    const n = parseInt(String(r).trim(), 10);
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const handleTorneosAppBack = useCallback(() => {
    if (sedeFiltroId != null) {
      navigate(`/sede/${sedeFiltroId}`, { replace: true });
      return;
    }
    navigate(-1);
  }, [navigate, sedeFiltroId]);

  const irACambiarSede = () => {
    localStorage.removeItem('ultima_sede');
    localStorage.removeItem('ultima_sede_nombre');
    localStorage.removeItem('ultima_sede_ciudad');
    localStorage.removeItem('ultima_sede_pais');
    navigate('/sedes?from=explorar');
  };

  const [torneos, setTorneos] = useState([]);
  const [sedesMap, setSedesMap] = useState({});
  const [sedesList, setSedesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  const [userPos, setUserPos] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [torneoSearchQuery, setTorneoSearchQuery] = useState('');
  const torneoSearchInputRef = useRef(null);
  const [filtroEstadoTorneo, setFiltroEstadoTorneo] = useState('todos');
  /** Deriva del query `?deporte=` (hub y enlaces compartibles). */
  const filtroDeporteTorneo = useMemo(() => {
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    if (!d || d === 'todos') return 'todos';
    return FILTROS_DEPORTE_TORNEO_PUBLICO.some((x) => x.id === d) ? d : 'todos';
  }, [searchParams]);

  const setDeporteFiltroEnUrl = useCallback(
    (id) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!id || id === 'todos') next.delete('deporte');
          else next.set('deporte', id);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  /** Conteo de equipos con inscripción confirmada por torneo_id (para cupos disponibles en card). */
  const [equiposConfirmadosPorTorneoId, setEquiposConfirmadosPorTorneoId] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);

    const [{ data: torneosData, error: torneosError }, { data: sedesData, error: sedesError }] =
      await Promise.all([
        supabase.from('torneos').select('*').order('fecha_inicio', { ascending: false }),
        supabase.from('sedes').select('id,nombre,ciudad,pais,latitud,longitud'),
      ]);

    if (torneosError) {
      console.error('Error cargando torneos:', torneosError);
      setTorneos([]);
    } else {
      setTorneos(torneosData || []);
    }

    if (sedesError) {
      console.error('Error cargando sedes:', sedesError);
      setSedesMap({});
      setSedesList([]);
    } else {
      const map = {};
      (sedesData || []).forEach((s) => {
        map[String(s.id)] = s;
      });
      setSedesMap(map);
      setSedesList(sedesData || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Array.isArray(torneos) || torneos.length === 0) {
        setEquiposConfirmadosPorTorneoId({});
        return;
      }
      const ids = [...new Set(torneos.map((t) => t.id).filter((id) => id != null))];
      const { data, error } = await supabase
        .from('equipos')
        .select('torneo_id, inscripcion_estado')
        .in('torneo_id', ids);
      if (cancelled) return;
      if (error) {
        console.error('TorneosPublicos cupos equipos:', error);
        setEquiposConfirmadosPorTorneoId({});
        return;
      }
      const m = {};
      for (const row of data || []) {
        const tid = row.torneo_id;
        if (tid == null) continue;
        if (String(row.inscripcion_estado || '').toLowerCase() !== 'confirmado') continue;
        m[tid] = (m[tid] || 0) + 1;
      }
      setEquiposConfirmadosPorTorneoId(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [torneos]);

  useEffect(() => {
    if (!nearMode) {
      setGeoStatus('idle');
      setUserPos(null);
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
      { timeout: 10000 }
    );
  }, [nearMode]);

  const { focusSedeId, contextLine, filterActive } = useMemo(() => {
    if (!nearMode) {
      return { focusSedeId: null, contextLine: '', filterActive: false };
    }
    if (geoStatus === 'idle' || geoStatus === 'pending') {
      return {
        focusSedeId: null,
        contextLine:
          'Detectando ubicación… Si no es posible, usaremos tu última sede guardada o mostraremos todos.',
        filterActive: false,
      };
    }

    let sid = null;
    let line = '';

    if (geoStatus === 'granted' && userPos && sedesList.length) {
      const closest = closestSedeId(userPos, sedesList);
      if (closest != null) {
        sid = closest;
        const s = sedesMap[String(closest)];
        line = s
          ? `Según tu ubicación: ${[s.nombre, s.ciudad].filter(Boolean).join(' · ')}`
          : 'Según tu ubicación';
      }
    }

    if (!sid && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('ultima_sede')?.trim();
      if (raw) {
        const n = Number(raw);
        if (!Number.isNaN(n)) {
          sid = n;
          const nombre =
            localStorage.getItem('ultima_sede_nombre')?.trim() ||
            sedesMap[String(n)]?.nombre ||
            'Tu última sede';
          const s = sedesMap[String(n)];
          const lugar = s ? [s.ciudad, s.pais].filter(Boolean).join(', ') : '';
          const tail = lugar ? `${nombre} (${lugar})` : nombre;
          line = `Última sede: ${tail}`;
        }
      }
    }

    if (!sid) {
      line = 'No pudimos situarte ni leer una sede guardada. Mostrando todos los torneos.';
    }

    return { focusSedeId: sid, contextLine: line, filterActive: Boolean(sid) };
  }, [nearMode, geoStatus, userPos, sedesList, sedesMap]);

  const displayedTorneos = useMemo(() => {
    if (sedeFiltroId != null) {
      return torneos.filter((t) => Number(t.sede_id) === Number(sedeFiltroId));
    }
    if (!nearMode || !filterActive || focusSedeId == null) return torneos;
    return torneos.filter((t) => Number(t.sede_id) === Number(focusSedeId));
  }, [sedeFiltroId, nearMode, filterActive, focusSedeId, torneos]);

  const torneosTrasFiltroDeporte = useMemo(() => {
    if (filtroDeporteTorneo === 'todos') return displayedTorneos;
    return displayedTorneos.filter((t) => normalizeTorneoDeporte(t.deporte) === filtroDeporteTorneo);
  }, [displayedTorneos, filtroDeporteTorneo]);

  const torneosTrasFiltroEstado = useMemo(
    () => torneosTrasFiltroDeporte.filter((t) => torneoPasaFiltroEstadoVista(t, filtroEstadoTorneo)),
    [torneosTrasFiltroDeporte, filtroEstadoTorneo]
  );

  const torneosPorBusqueda = useMemo(() => {
    const q = normalizeSearchText(torneoSearchQuery);
    if (!q) return torneosTrasFiltroEstado;
    return torneosTrasFiltroEstado.filter((t) => {
      const sede = sedesMap[String(t.sede_id)];
      const blob = normalizeSearchText(
        [t.nombre, sede?.nombre, sede?.ciudad, sede?.pais].filter(Boolean).join(' ')
      );
      return blob.includes(q);
    });
  }, [torneosTrasFiltroEstado, torneoSearchQuery, sedesMap]);

  const sedeFiltroNombre = useMemo(() => {
    if (sedeFiltroId == null) return null;
    return sedesMap[String(sedeFiltroId)]?.nombre || null;
  }, [sedeFiltroId, sedesMap]);

  const torneosOrdenados = useMemo(() => [...torneosPorBusqueda].sort(compareTorneosPublico), [torneosPorBusqueda]);

  const listaTorneos = useMemo(() => {
    if (loading) {
      return <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Cargando...</p>;
    }
    if (torneos.length === 0) {
      return (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '18px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          }}
        >
          No hay torneos disponibles.
        </div>
      );
    }
    if (displayedTorneos.length === 0) {
      return (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '18px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          }}
        >
          {(nearMode && filterActive) || sedeFiltroId != null
            ? 'No hay torneos en esta sede por ahora.'
            : 'No hay torneos disponibles.'}
          {(nearMode && filterActive) || sedeFiltroId != null ? (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => navigate('/torneos')}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#E11B22',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ver todos los torneos
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    if (displayedTorneos.length > 0 && torneosTrasFiltroDeporte.length === 0) {
      return (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '18px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          }}
        >
          No hay torneos de este deporte con los filtros actuales.
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setDeporteFiltroEnUrl('todos')}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: '#E11B22',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ver todos los deportes
            </button>
          </div>
        </div>
      );
    }
    if (torneosTrasFiltroDeporte.length > 0 && torneosTrasFiltroEstado.length === 0) {
      return (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '18px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          }}
        >
          No hay torneos con el estado seleccionado.
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setFiltroEstadoTorneo('todos')}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: '#E11B22',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ver todos los estados
            </button>
          </div>
        </div>
      );
    }
    if (displayedTorneos.length > 0 && torneosPorBusqueda.length === 0) {
      return (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '18px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          }}
        >
          No encontramos torneos con ese criterio
        </div>
      );
    }
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '14px',
        }}
      >
        {torneosOrdenados.map((t) => {
          const sede = sedesMap[String(t.sede_id)];
          const badge = badgeEstadoTorneoListado(t);

          return (
            <div
              key={t.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      fontWeight: 700,
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {sede?.nombre || 'Club / sede'}
                  </div>

                  <h3 style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.2 }}>{t.nombre || 'Sin nombre'}</h3>
                  {normalizeTorneoDeporte(t.deporte) !== TORNEO_DEPORTE_PADBOL ? (
                    <div style={{ marginTop: '8px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: 'rgba(139, 92, 246, 0.2)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {etiquetaDeporteTorneo(t.deporte)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: badge.bg,
                    color: badge.color,
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badge.label}
                </span>
              </div>

              <div
                style={{
                  marginTop: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                <Row icon={<IconGeroUbicacion size={14} />} label={sede?.nombre || 'Sede no encontrada'} />
                <Row
                  icon="🗺️"
                  label={
                    <>
                      {sede?.ciudad || '—'}
                      {sede?.pais ? `, ${sede.pais}` : ''}
                    </>
                  }
                />
                <Row icon="📅" label={formatFecha(t.fecha_inicio)} />
                <Row icon="🎾" label={formatoEquipoLineaTorneoPublico(t)} />
                <Row icon="🏆" label={formatTipoTorneo(t.tipo_torneo)} />
                <Row icon="⭐" label={formatNivelTorneo(t.nivel_torneo)} />
                <Row icon="⚧" label={`Tipo de torneo: ${formatGeneroCompetenciaTorneo(torneoTipoCompetenciaDb(t))}`} />
                <Row icon="🎂" label={`Edad: ${formatCategoriaEdadTorneo(t.categoria_edad)}`} />
                {(() => {
                  const max =
                    t.cupos_maximos != null && String(t.cupos_maximos).trim() !== ''
                      ? Number(t.cupos_maximos)
                      : NaN;
                  if (!Number.isFinite(max) || max <= 0) return null;
                  const conf = equiposConfirmadosPorTorneoId[t.id] ?? 0;
                  const disp = Math.max(0, max - conf);
                  return <Row icon="🎫" label={`${disp} cupos disponibles`} />;
                })()}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/torneo/${t.id}`)}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#E11B22',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ver torneo
              </button>
            </div>
          );
        })}
      </div>
    );
  }, [
    loading,
    torneos.length,
    displayedTorneos.length,
    torneosTrasFiltroDeporte.length,
    torneosTrasFiltroEstado.length,
    torneosPorBusqueda.length,
    torneosOrdenados,
    nearMode,
    filterActive,
    sedeFiltroId,
    isMobile,
    sedesMap,
    navigate,
    equiposConfirmadosPorTorneoId,
  ]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        padding: `${hubContentPaddingTopCss(location.pathname)} 0 ${HUB_CONTENT_PADDING_BOTTOM_PX}px 0`,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <AppHeader title="Torneos" onBack={handleTorneosAppBack} />

      <div
        style={{
          ...hubInstagramColumnWrapStyle,
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '14px 16px',
            marginBottom: '10px',
            color: 'var(--text-primary)',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-primary)' }}>
            {sedeFiltroNombre ? `Torneos · ${sedeFiltroNombre}` : nearMode ? 'Torneos cerca de ti' : 'Torneos disponibles'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: nearMode || sedeFiltroId != null ? '10px' : 0, lineHeight: 1.45 }}>
            {sedeFiltroId != null
              ? 'Solo se listan torneos de esta sede.'
              : nearMode
                ? 'Priorizamos torneos de la sede más cercana a tu ubicación o de tu última sede.'
                : 'Elige un torneo para ver sus detalles, inscribirte y formar o unirte a un equipo.'}
          </div>
          {nearMode && contextLine ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{contextLine}</div>
          ) : null}
          {nearMode ? (
            <button
              type="button"
              onClick={irACambiarSede}
              style={{
                marginTop: '12px',
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'block',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                background: 'var(--pm-color-muted-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '320px',
              }}
            >
              Cambiar ciudad / sede
            </button>
          ) : null}
          {sedeFiltroId != null && !nearMode ? (
            <button
              type="button"
              onClick={() => navigate('/torneos')}
              style={{
                marginTop: '12px',
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'block',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                background: 'var(--pm-color-muted-bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '320px',
              }}
            >
              Ver todos los torneos
            </button>
          ) : null}
        </div>

        {!loading && torneos.length > 0 ? (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  letterSpacing: '0.02em',
                }}
              >
                Deporte
              </div>
              <div
                role="group"
                aria-label="Deporte del torneo"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'nowrap',
                  gap: '8px',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  paddingBottom: '4px',
                }}
              >
                {FILTROS_DEPORTE_TORNEO_PUBLICO.map(({ id, label }) => {
                  const active = filtroDeporteTorneo === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDeporteFiltroEnUrl(id)}
                      style={{
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        padding: '8px 14px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: active ? 'var(--accent)' : 'var(--pm-color-muted-bg)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        boxShadow: active ? '0 2px 10px rgba(225, 27, 34, 0.25)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  letterSpacing: '0.02em',
                }}
              >
                Estado del torneo
              </div>
              <div
                role="group"
                aria-label="Estado del torneo"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'nowrap',
                  gap: '8px',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  paddingBottom: '4px',
                }}
              >
                {FILTROS_ESTADO_TORNEO_PILLS.map(({ id, label }) => {
                  const active = filtroEstadoTorneo === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFiltroEstadoTorneo(id)}
                      style={{
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        padding: '8px 14px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: active ? 'var(--accent)' : 'var(--pm-color-muted-bg)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        boxShadow: active ? '0 2px 10px rgba(225, 27, 34, 0.25)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none',
                  opacity: 0.92,
                }}
                aria-hidden
              >
                <IconGeroFiltros size={18} />
              </span>
              <input
                ref={torneoSearchInputRef}
                type="search"
                autoComplete="off"
                value={torneoSearchQuery}
                onChange={(e) => setTorneoSearchQuery(e.target.value)}
                placeholder="Buscar torneo, club, ciudad o país..."
                aria-label="Buscar torneos"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 40px 11px 40px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
                }}
              />
              {torneoSearchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setTorneoSearchQuery('');
                    torneoSearchInputRef.current?.focus();
                  }}
                  aria-label="Limpiar búsqueda"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    border: 'none',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.08)',
                    color: 'var(--text-secondary)',
                    fontSize: '18px',
                    lineHeight: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={{ marginBottom: '14px' }}>
          <HubSponsorsTicker sponsors={tickerSponsors} />
        </div>

        {listaTorneos}
      </div>
      <BottomNav />
    </div>
  );
}
