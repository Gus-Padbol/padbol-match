import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { fetchSedeFavoritaId } from '../utils/sedeFavorita';
function formatHorario(apertura, cierre) {
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  if (apertura) return `Desde ${apertura}`;
  if (cierre)   return `Hasta ${cierre}`;
  return null;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatKm(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export default function SedesPublicas() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from'); // 'reserva' | 'explorar' | null
  const skipFavoriteRedirect =
    searchParams.get('ver_todas') === '1' || from === 'explorar';

  /** Volver a Reservar con replace para no encadenar Reservar ↔ Sedes en el historial. */
  const volverFlujoReserva =
    from === 'reserva' ||
    (searchParams.get('ver_todas') === '1' && from !== 'explorar');

  const handleSedesAppBack = useCallback(() => {
    if (volverFlujoReserva) {
      navigate('/reservar', { replace: true });
      return;
    }
    navigate(-1);
  }, [navigate, volverFlujoReserva]);

  const { session, loading: authLoading } = useAuth();
  const favoriteRunGenRef = useRef(0);

  const [sedes,       setSedes]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [userPos,     setUserPos]     = useState(null);   // { lat, lon }
  /** pending | granted | denied | skipped (catálogo: no pedir ubicación) */
  const [geoStatus,   setGeoStatus]   = useState('pending');

  // Load sedes (include lat/lon for distance sorting)
  useEffect(() => {
    const fetchSedesWithTimeout = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sedes fetch timeout')), 5000)
        );

        const result = await Promise.race([
          supabase
            .from('sedes')
            .select('id, nombre, ciudad, pais, logo_url, horario_apertura, horario_cierre, descripcion, latitud, longitud')
            .order('nombre', { ascending: true }),
          timeoutPromise
        ]);

        setSedes(result.data || []);
      } catch (err) {
        console.error('[SedesPublicas] Error loading sedes:', err.message);
        // Show empty list instead of hanging
        setSedes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSedesWithTimeout();
  }, []);

  // Usuario con historial: ir directo a la sede más usada (salvo ?ver_todas=1 o catálogo explorar).
  useEffect(() => {
    if (skipFavoriteRedirect || loading || authLoading) return;
    if (!session?.user) return;
    const email = String(session.user.email || '').trim().toLowerCase();
    if (!email) return;

    const gen = ++favoriteRunGenRef.current;
    let cancelled = false;

    (async () => {
      const id = await fetchSedeFavoritaId(email, sedes);
      if (cancelled || gen !== favoriteRunGenRef.current) return;
      if (id) navigate(`/sede/${id}`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [skipFavoriteRedirect, loading, authLoading, session?.user?.id, session?.user?.email, sedes, navigate]);

  // Catálogo: no solicitar ubicación. Reserva / sin query: intentar geolocalización para orden cercano.
  useEffect(() => {
    if (from === 'explorar') {
      setGeoStatus('skipped');
      setUserPos(null);
      return;
    }
    setGeoStatus('pending');
    setUserPos(null);
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
      { timeout: 8000 }
    );
  }, [from]);

  // Attach distance to each sede, sort if geolocation available
  const sedesWithDist = sedes.map(s => {
    if (geoStatus === 'granted' && userPos && s.latitud != null && s.longitud != null) {
      return { ...s, distKm: getDistanceKm(userPos.lat, userPos.lon, s.latitud, s.longitud) };
    }
    return { ...s, distKm: null };
  });

  const sortByDistance = from !== 'explorar' && geoStatus === 'granted';
  const sorted = sortByDistance
    ? [...sedesWithDist].sort((a, b) => {
        if (a.distKm == null && b.distKm == null) return 0;
        if (a.distKm == null) return 1;
        if (b.distKm == null) return -1;
        return a.distKm - b.distKm;
      })
    : [...sedesWithDist].sort((a, b) =>
        (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' })
      );

  const pageTitle =
    from === 'reserva'
      ? '⚡ Reserva tu cancha'
      : from === 'explorar'
        ? '🗺️ Explorar sedes'
        : '🏟️ Canchas de Padbol cerca tuyo';

  const filtered = sorted.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.nombre || '').toLowerCase().includes(q) ||
      (s.ciudad || '').toLowerCase().includes(q) ||
      (s.pais   || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', paddingTop: hubContentPaddingTopCss(location.pathname), paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px` }}>

      <AppHeader title="Sedes" onBack={volverFlujoReserva ? handleSedesAppBack : undefined} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 20px 0' }}>

        {/* Title + search + geo status */}
        <div style={{ marginBottom: '28px' }}>
          <img
            src="/logo-padbol-match.png"
            alt="Padbol Match"
            style={{
              ...padbolLogoImgStyle,
              marginBottom: '16px',
            }}
          />
          <h2 style={{ color: 'white', fontWeight: 900, fontSize: 'clamp(1.3rem, 4vw, 2rem)', margin: '0 0 16px', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            {pageTitle}
          </h2>

          {/* Geo status pill */}
          {geoStatus !== 'pending' && geoStatus !== 'skipped' && (
            <div style={{ marginBottom: '16px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                background: geoStatus === 'granted' ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.15)',
                color: geoStatus === 'granted' ? '#86efac' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${geoStatus === 'granted' ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.25)'}`,
              }}>
                {geoStatus === 'granted' ? '📍 Ordenado por distancia' : '🌍 Mostrando todas las canchas'}
              </span>
            </div>
          )}
          {from === 'explorar' && (
            <div style={{ marginBottom: '16px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                background: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.25)',
              }}>
                📚 Catálogo completo (orden alfabético)
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, ciudad o país..."
              style={{ flex: 1, minWidth: '200px', maxWidth: '340px', padding: '9px 14px', borderRadius: '8px', border: 'none', fontSize: '13px', background: 'rgba(255,255,255,0.95)', color: '#333' }}
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', paddingTop: '60px', fontSize: '16px' }}>Cargando canchas...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingTop: '60px', fontSize: '15px' }}>
            {search ? 'No hay resultados para esa búsqueda.' : 'No hay sedes habilitadas por el momento.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {filtered.map(sede => {
              const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
              return (
                <div
                  key={sede.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/sede/${sede.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/sede/${sede.id}`);
                    }
                  }}
                  style={{
                  background: 'white', borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
                >
                  {/* Card header */}
                  <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: '20px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {sede.logo_url ? (
                      <img src={sede.logo_url} alt={`Logo ${sede.nombre}`}
                        style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'contain', background: 'white', padding: '6px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🏟️</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: '0 0 4px', color: 'white', fontSize: '15px', fontWeight: 800, lineHeight: 1.25, wordBreak: 'break-word' }}>{sede.nombre}</h3>
                      {(sede.ciudad || sede.pais) && (
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                          {[sede.ciudad, sede.pais].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    {/* Distance badge */}
                    {sede.distKm != null && (
                      <span style={{
                        flexShrink: 0, padding: '4px 8px', borderRadius: '10px',
                        background: 'rgba(74,222,128,0.2)', color: '#86efac',
                        fontSize: '11px', fontWeight: 700,
                        border: '1px solid rgba(74,222,128,0.3)',
                        whiteSpace: 'nowrap',
                      }}>
                        📍 {formatKm(sede.distKm)}
                      </span>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '16px 18px', flex: 1 }}>
                    {horario && (
                      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#555' }}>⏰ {horario}</p>
                    )}
                    {sede.descripcion && (
                      <p style={{ margin: 0, fontSize: '13px', color: '#777', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {sede.descripcion}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      padding: '12px 18px',
                      borderTop: '1px solid #f0f0f0',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#6366f1',
                      textAlign: 'center',
                    }}
                  >
                    Tocá la tarjeta para ver la sede
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
