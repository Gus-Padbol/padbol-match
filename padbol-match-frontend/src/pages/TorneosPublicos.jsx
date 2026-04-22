import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#444' }}>
      <span style={{ flexShrink: 0, width: '18px', textAlign: 'center' }}>{icon}</span>
      <span style={{ lineHeight: 1.4 }}>{label}</span>
    </div>
  );
}

const estadoStyle = {
  abierto: { label: 'Abierto', bg: '#dcfce7', color: '#166534' },
  en_curso: { label: 'En curso', bg: '#fef3c7', color: '#92400e' },
  finalizado: { label: 'Finalizado', bg: '#fee2e2', color: '#991b1b' },
  cancelado: { label: 'Cancelado', bg: '#e5e7eb', color: '#374151' },
  planificacion: { label: 'Planificación', bg: '#e5e7eb', color: '#374151' },
};

const ORDEN_ESTADO_TORNEO = {
  en_curso: 1,
  inscripcion_abierta: 1,
  abierto: 1,
  planificacion: 2,
  finalizado: 3,
  cancelado: 4,
};

export default function TorneosPublicos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nearMode = searchParams.get('context') === 'near';

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

  const loadData = useCallback(async () => {
    setLoading(true);

    const [{ data: torneosData, error: torneosError }, { data: sedesData, error: sedesError }] =
      await Promise.all([
        supabase.from('torneos').select('*').order('fecha_inicio', { ascending: true }),
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
    if (!nearMode || !filterActive || focusSedeId == null) return torneos;
    return torneos.filter((t) => Number(t.sede_id) === Number(focusSedeId));
  }, [nearMode, filterActive, focusSedeId, torneos]);

  const torneosOrdenados = useMemo(() => {
    const rank = (estado) => ORDEN_ESTADO_TORNEO[String(estado || '').toLowerCase()] ?? 99;
    return [...displayedTorneos].sort((a, b) => {
      const d = rank(a.estado) - rank(b.estado);
      if (d !== 0) return d;
      const fa = String(a.fecha_inicio || '');
      const fb = String(b.fecha_inicio || '');
      return fa.localeCompare(fb);
    });
  }, [displayedTorneos]);

  const listaTorneos = useMemo(() => {
    if (loading) {
      return <p style={{ color: 'white', textAlign: 'center' }}>Cargando...</p>;
    }
    if (torneos.length === 0) {
      return (
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '18px',
            color: '#4b5563',
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
            background: 'white',
            borderRadius: '16px',
            padding: '18px',
            color: '#4b5563',
            textAlign: 'center',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          }}
        >
          {nearMode && filterActive ? 'No hay torneos en esta sede por ahora.' : 'No hay torneos disponibles.'}
          {nearMode && filterActive ? (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => navigate('/torneos')}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
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
          const badge = estadoStyle[t.estado] || {
            label: t.estado || 'Sin estado',
            bg: '#e5e7eb',
            color: '#374151',
          };

          return (
            <div
              key={t.id}
              style={{
                background: 'white',
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
                      color: '#6b7280',
                      fontWeight: 700,
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {sede?.nombre || 'Club / sede'}
                  </div>

                  <h3 style={{ margin: 0, color: '#111827', lineHeight: 1.2 }}>{t.nombre || 'Sin nombre'}</h3>
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
                  color: '#4b5563',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                <Row icon="📍" label={sede?.nombre || 'Sede no encontrada'} />
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
                <Row icon="🏆" label={t.tipo_torneo || '—'} />
                <Row icon="⭐" label={t.nivel_torneo || '—'} />
              </div>

              <button
                type="button"
                onClick={() => navigate(`/torneo/${t.id}/equipos`)}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
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
    torneosOrdenados,
    nearMode,
    filterActive,
    isMobile,
    sedesMap,
    navigate,
  ]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        padding: '64px 12px 80px 12px',
      }}
    >
      <AppHeader title="Torneos" />

      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '14px 16px',
            marginBottom: '10px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>
            {nearMode ? 'Torneos cerca de ti' : 'Torneos disponibles'}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.92, marginBottom: nearMode ? '10px' : 0 }}>
            {nearMode
              ? 'Priorizamos torneos de la sede más cercana a tu ubicación o de tu última sede.'
              : 'Elige un torneo para ver sus detalles, inscribirte y formar o unirte a un equipo.'}
          </div>
          {nearMode && contextLine ? (
            <div style={{ fontSize: '13px', opacity: 0.88, lineHeight: 1.45 }}>{contextLine}</div>
          ) : null}
          {nearMode ? (
            <button
              type="button"
              onClick={irACambiarSede}
              style={{
                marginTop: '12px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#1e1b4b',
                background: 'rgba(255,255,255,0.92)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '320px',
              }}
            >
              Cambiar ciudad / sede
            </button>
          ) : null}
        </div>

        {listaTorneos}
      </div>
      <BottomNav />
    </div>
  );
}
