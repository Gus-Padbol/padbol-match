import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import PartidoAbiertoCard from '../components/PartidoAbiertoCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const HERO_BUSCAR =
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&q=80';

export default function PartidosAbiertos() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [updatingSolicitudId, setUpdatingSolicitudId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  const deporteFiltro = String(searchParams.get('deporte') || '').trim().toLowerCase();

  const setDeporteFiltro = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key) next.set('deporte', key);
    else next.delete('deporte');
    setSearchParams(next, { replace: true });
  };

  const cargar = useCallback(() => {
    setLoading(true);
    setMsg('');
    fetch(`${API_BASE}/api/partidos-abiertos`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data?.error || 'No se pudieron cargar los partidos');
        setPartidos(Array.isArray(data) ? data : []);
      })
      .catch((err) => setMsg(err.message || 'Error de red'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarSolicitudes = useCallback(async () => {
    if (!session?.user) {
      setSolicitudes([]);
      return;
    }
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token || session.access_token;
      const res = await fetch(`${API_BASE}/api/partidos-abiertos/mis-solicitudes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSolicitudes(Array.isArray(data) ? data : []);
    } catch {
      setSolicitudes([]);
    }
  }, [session]);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const partidosFiltrados = useMemo(() => {
    if (!deporteFiltro) return partidos;
    return partidos.filter((p) => String(p?.deporte || '').toLowerCase() === deporteFiltro);
  }, [partidos, deporteFiltro]);

  const pedirUnirse = async (partido) => {
    if (!session?.user) {
      navigate('/login?redirect=/partidos-abiertos');
      return;
    }
    setJoiningId(partido.id);
    setMsg('');
    setJoinSuccess(false);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token || session.access_token;
      const res = await fetch(`${API_BASE}/api/partidos-abiertos/${partido.id}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar la solicitud');
      setJoinSuccess(true);
      setMsg('');
    } catch (err) {
      setMsg(err.message || 'Error al enviar solicitud');
    } finally {
      setJoiningId(null);
    }
  };

  const resolverSolicitud = async (solicitud, estado) => {
    setUpdatingSolicitudId(solicitud.id);
    setMsg('');
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token || session.access_token;
      const res = await fetch(`${API_BASE}/api/partidos-abiertos/solicitudes/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar la solicitud');
      setMsg(estado === 'aceptada' ? 'Jugador aceptado. El partido fue actualizado.' : 'Solicitud rechazada.');
      cargar();
      await cargarSolicitudes();
    } catch (err) {
      setMsg(err.message || 'Error al gestionar solicitud');
    } finally {
      setUpdatingSolicitudId(null);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Buscar partido" />
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          height: 160,
          background: `#374151 url(${HERO_BUSCAR}) center/cover no-repeat`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h1 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 700, textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>
            Buscar partido
          </h1>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            style={{
              border: '1px solid rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
            }}
          >
            Filtros
          </button>
        </div>
      </div>

      <main style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '16px 16px 24px', boxSizing: 'border-box' }}>
        {showFilters ? (
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Elegir deporte</span>
            <div style={{ position: 'relative' }}>
              <select
                value={deporteFiltro}
                onChange={(e) => setDeporteFiltro(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  padding: '14px 40px 14px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 16,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                }}
              >
                <option value="">Todos</option>
                {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                }}
              >
                ▼
              </span>
            </div>
          </label>
        ) : null}

        {joinSuccess ? (
          <section
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 22,
              marginBottom: 16,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 10 }}>✓</div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 20, fontWeight: 700 }}>¡Te has unido con éxito!</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400 }}>
              El capitán verá tu solicitud. Te avisaremos cuando confirme tu cupo.
            </p>
            <button
              type="button"
              onClick={() => navigate('/mi-perfil')}
              style={{
                width: '100%',
                maxWidth: 280,
                padding: '14px 24px',
                borderRadius: 8,
                border: '2px solid #16A34A',
                background: 'transparent',
                color: '#16A34A',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              Ir a mis partidos
            </button>
          </section>
        ) : null}

        {msg ? (
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {msg}
          </div>
        ) : null}

        {solicitudes.length > 0 ? (
          <section
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>Solicitudes para tus partidos</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {solicitudes.map((s) => (
                <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>{s.jugador_nombre}</strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, fontWeight: 400 }}>
                    Quiere jugar en {s.partido?.sede_nombre || 'tu partido'} · {String(s.partido?.hora || '').slice(0, 5)}
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => resolverSolicitud(s, 'aceptada')}
                      disabled={updatingSolicitudId === s.id}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px 10px',
                        background: '#16A34A',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => resolverSolicitud(s, 'rechazada')}
                      disabled={updatingSolicitudId === s.id}
                      style={{
                        flex: 1,
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '12px 10px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 30, fontWeight: 400 }}>Cargando partidos...</p>
        ) : partidosFiltrados.length === 0 ? (
          <section
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>No hay partidos disponibles. ¡Inicia uno!</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400 }}>
              {deporteFiltro ? 'Prueba con otro deporte o sin filtro.' : 'Publica el primero y completa jugadores en minutos.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/armar-partido')}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '14px 24px',
                background: '#E11B22',
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              Armar partido
            </button>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {partidosFiltrados.map((p) => (
              <PartidoAbiertoCard key={p.id} partido={p} onJoin={pedirUnirse} joining={joiningId === p.id} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
