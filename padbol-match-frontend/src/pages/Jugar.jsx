import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import HubSponsorsTicker from '../components/HubSponsorsTicker';
import HubTercerTiempoSponsor from '../components/HubTercerTiempoSponsor';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { useHubSponsors } from '../hooks/useHubSponsors';
import useUserRole from '../hooks/useUserRole';
import './Jugar.css';

const IMG_RESERVA =
  'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80';
const IMG_BUSCAR =
  'https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=800&q=80';
const IMG_ARMAR =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80';

const opciones = [
  {
    title: 'Reservar cancha',
    body: 'Ya tengo equipo completo, quiero una cancha.',
    image: IMG_RESERVA,
    path: '/reservar',
  },
  {
    title: 'Buscar partido',
    body: 'Quiero unirme a un partido que ya existe.',
    image: IMG_BUSCAR,
    path: '/partidos-abiertos',
  },
  {
    title: 'Armar partido',
    body: 'Quiero crear un partido y sumar jugadores.',
    image: IMG_ARMAR,
    path: '/jugar/armar',
  },
];

const CARD_OVERLAY = 'rgba(180, 20, 20, 0.35)';

export default function Jugar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session, userProfile } = useAuth();
  const deporteQ = useMemo(() => {
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    return d ? `?deporte=${encodeURIComponent(d)}` : '';
  }, [searchParams]);

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { sedeId: hubSedeId, pais: hubPaisUsuario } = useUserRole(currentCliente);
  const paisParaSponsors = String(hubPaisUsuario || userProfile?.pais || '').trim();
  const { tercerTiempoSponsor, tickerSponsors } = useHubSponsors({
    sedeId: hubSedeId != null && Number.isFinite(Number(hubSedeId)) ? Number(hubSedeId) : null,
    pais: paisParaSponsors,
    enabled: true,
  });

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Jugar" />
      <main
        style={{
          width: '100%',
          maxWidth: 460,
          margin: '0 auto',
          padding: '12px 14px 16px',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            color: 'var(--text-primary)',
            margin: '0 0 12px',
            fontSize: 24,
            lineHeight: 1.15,
            fontWeight: 700,
          }}
        >
          ¡Vamos a jugar!
        </h1>
        <div style={{ display: 'grid', gap: 10 }}>
          {opciones.map((op) => (
            <button
              key={op.title}
              type="button"
              onClick={() => navigate(`${op.path}${deporteQ}`)}
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--bg-card)',
                padding: 0,
                overflow: 'hidden',
                boxShadow: 'var(--pm-shadow-card, 0 2px 8px rgba(0,0,0,0.08))',
                cursor: 'pointer',
                display: 'block',
              }}
            >
              <div
                className="jugar-card-media"
                style={{
                  backgroundImage: `url(${op.image})`,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: CARD_OVERLAY,
                  }}
                />
                <div className="jugar-card-copy">
                  <strong className="jugar-card-title">{op.title}</strong>
                  <span className="jugar-card-body">{op.body}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <HubTercerTiempoSponsor sponsor={tercerTiempoSponsor} />
        <HubSponsorsTicker sponsors={tickerSponsors} />
      </main>
      <BottomNav />
    </div>
  );
}
