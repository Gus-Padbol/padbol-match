import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import PartidoAbiertoCard from '../components/PartidoAbiertoCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

export default function PartidosAbiertos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [updatingSolicitudId, setUpdatingSolicitudId] = useState(null);

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

  const pedirUnirse = async (partido) => {
    if (!session?.user) {
      navigate('/login?redirect=/partidos-abiertos');
      return;
    }
    setJoiningId(partido.id);
    setMsg('');
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
      setMsg('Solicitud enviada. El capitán recibió la notificación para aceptar o rechazar.');
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
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Únete a un partido" />
      <main style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '18px 16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ color: '#fff', margin: 0, fontSize: 25 }}>Únete a un partido</h1>
            <p style={{ color: 'rgba(255,255,255,0.84)', margin: '5px 0 0', fontSize: 14 }}>Sumate a un equipo que necesita jugadores.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/armar-partido')}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '10px 12px',
              background: '#fff',
              color: '#4f46e5',
              fontWeight: 900,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Armar
          </button>
        </div>

        {msg ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, color: '#334155', fontSize: 13, fontWeight: 700 }}>
            {msg}
          </div>
        ) : null}

        {solicitudes.length > 0 ? (
          <section style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 12px 28px rgba(15,23,42,0.16)' }}>
            <h2 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: 17 }}>Solicitudes para tus partidos</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {solicitudes.map((s) => (
                <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
                  <strong style={{ display: 'block', color: '#0f172a', fontSize: 14 }}>{s.jugador_nombre}</strong>
                  <span style={{ display: 'block', color: '#64748b', fontSize: 12, marginTop: 2 }}>
                    Quiere jugar en {s.partido?.sede_nombre || 'tu partido'} · {String(s.partido?.hora || '').slice(0, 5)}
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => resolverSolicitud(s, 'aceptada')}
                      disabled={updatingSolicitudId === s.id}
                      style={{ flex: 1, border: 'none', borderRadius: 10, padding: 9, background: '#22c55e', color: '#fff', fontWeight: 900 }}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => resolverSolicitud(s, 'rechazada')}
                      disabled={updatingSolicitudId === s.id}
                      style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 10, padding: 9, background: '#fff', color: '#334155', fontWeight: 900 }}
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
          <p style={{ color: '#fff', textAlign: 'center', padding: 30 }}>Cargando partidos...</p>
        ) : partidos.length === 0 ? (
          <section style={{ background: '#fff', borderRadius: 20, padding: 22, textAlign: 'center', boxShadow: '0 16px 34px rgba(15,23,42,0.2)' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🤝</div>
            <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>Todavía no hay partidos para unirte</h2>
            <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 14 }}>Publica el primero y completa jugadores en minutos.</p>
            <button
              type="button"
              onClick={() => navigate('/armar-partido')}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '12px 16px',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: '#fff',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Armar el primero
            </button>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {partidos.map((p) => (
              <PartidoAbiertoCard key={p.id} partido={p} onJoin={pedirUnirse} joining={joiningId === p.id} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
