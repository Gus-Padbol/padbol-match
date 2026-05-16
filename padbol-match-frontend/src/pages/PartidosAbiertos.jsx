import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import HubDeporteSelect from '../components/HubDeporteSelect';
import { IconGeroCheck } from '../components/icons/GeroIcons';
import PartidoAbiertoCard from '../components/PartidoAbiertoCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { DEPORTES_CANCHA_SEDE_KEYS } from '../constants/deportesCanchaSede';
import { readHubDeporteFilterPersisted, writeHubDeporteFilterToSession } from '../constants/hubDeporteSession';
import {
  HUB_BOTTOM_NAV_CONTENT_GAP_PX,
  HUB_NAV_HEIGHT_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

export default function PartidosAbiertos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [updatingSolicitudId, setUpdatingSolicitudId] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const hubDeporteHydratedRef = useRef(false);

  const deporteFiltro = String(searchParams.get('deporte') || '').trim().toLowerCase();

  const setDeporteFiltro = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key) next.set('deporte', key);
    else next.delete('deporte');
    setSearchParams(next, { replace: true });
    writeHubDeporteFilterToSession(key);
  };

  useEffect(() => {
    if (hubDeporteHydratedRef.current) return;
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    if (DEPORTES_CANCHA_SEDE_KEYS.includes(d)) {
      writeHubDeporteFilterToSession(d);
      hubDeporteHydratedRef.current = true;
      return;
    }
    const fromSession = readHubDeporteFilterPersisted();
    if (fromSession) {
      const next = new URLSearchParams(searchParams);
      next.set('deporte', fromSession);
      setSearchParams(next, { replace: true });
    }
    hubDeporteHydratedRef.current = true;
  }, [searchParams, setSearchParams]);

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

  const mainBottomPad =
    navDock === 'bottom'
      ? `calc(20px + ${HUB_NAV_HEIGHT_PX}px + ${HUB_BOTTOM_NAV_CONTENT_GAP_PX}px + env(safe-area-inset-bottom, 0px))`
      : `calc(20px + env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      style={{
        minHeight: '100dvh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Buscar partido" />
      <main
        style={{
          width: '100%',
          maxWidth: 460,
          margin: '0 auto',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 14,
          paddingBottom: mainBottomPad,
          boxSizing: 'border-box',
        }}
      >
        <HubDeporteSelect
          compact
          id="partidos-abiertos-deporte"
          value={deporteFiltro}
          onChange={setDeporteFiltro}
        />

        <div style={{ marginTop: 10 }}>
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
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 10px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(22,163,74,0.35)',
              }}
            >
              <IconGeroCheck size={30} style={{ color: '#fff' }} />
            </div>
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
              color: 'var(--text-primary)',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>
              No hay partidos disponibles. ¡Inicia uno!
            </h2>
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
                background: 'var(--accent)',
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
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
